-- Programas estruturados: agenda multi-semana, publicação imutável e entrega executável.
-- A biblioteca continua sendo a fonte de edição; compradores recebem snapshots.

alter table public.store_product_sessions
  alter column session_template_id drop not null;

-- O mesmo treino da biblioteca pode reaparecer em semanas/dias diferentes
-- (por exemplo, um protocolo de força repetido). A unicidade continua sendo
-- por posição dentro do programa.
alter table public.store_product_sessions
  drop constraint if exists store_product_sessions_product_id_session_template_id_key;

alter table public.store_product_sessions
  drop constraint if exists store_product_sessions_day_number_check;
alter table public.store_product_sessions
  add constraint store_product_sessions_day_number_check
  check (day_number between 1 and 7);

alter table public.store_product_sessions
  add column if not exists is_rest_day boolean not null default false;

alter table public.store_product_sessions
  drop constraint if exists store_product_sessions_template_or_rest_check;

alter table public.store_product_sessions
  add constraint store_product_sessions_template_or_rest_check
  check ((is_rest_day and session_template_id is null) or (not is_rest_day and session_template_id is not null));

create table public.store_program_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  unique (product_id, version_number)
);

create index store_program_versions_product_idx
  on public.store_program_versions(product_id, version_number desc);

alter table public.training_program_access
  add column if not exists version_id uuid references public.store_program_versions(id) on delete restrict;

create table public.training_program_deliveries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete restrict,
  version_id uuid not null references public.store_program_versions(id) on delete restrict,
  coach_id uuid not null references auth.users(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete cascade,
  athlete_id uuid references auth.users(id) on delete cascade,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create index training_program_deliveries_team_idx
  on public.training_program_deliveries(team_id, status, start_date);
create index training_program_deliveries_athlete_idx
  on public.training_program_deliveries(athlete_id, status, start_date);
create unique index training_program_deliveries_target_unique
  on public.training_program_deliveries(version_id, team_id, coalesce(athlete_id, '00000000-0000-0000-0000-000000000000'::uuid), start_date);

alter table public.training_program_access
  add column if not exists delivery_id uuid references public.training_program_deliveries(id) on delete set null;

create table public.training_program_delivery_sessions (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.training_program_deliveries(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  day_number integer not null check (day_number between 1 and 7),
  scheduled_date date not null,
  is_rest_day boolean not null default false,
  title text not null check (char_length(btrim(title)) >= 2),
  snapshot jsonb check (snapshot is null or jsonb_typeof(snapshot) = 'object'),
  session_instance_id uuid,
  created_at timestamptz not null default now(),
  unique (delivery_id, week_number, day_number),
  check ((is_rest_day and snapshot is null) or (not is_rest_day and snapshot is not null))
);

create index training_program_delivery_sessions_delivery_idx
  on public.training_program_delivery_sessions(delivery_id, week_number, day_number);

alter table public.session_instances
  add column if not exists program_delivery_session_id uuid references public.training_program_delivery_sessions(id) on delete set null;

alter table public.training_program_delivery_sessions
  add constraint training_program_delivery_sessions_instance_fk
  foreign key (session_instance_id) references public.session_instances(id) on delete set null;

create unique index session_instances_program_delivery_unique
  on public.session_instances(program_delivery_session_id)
  where program_delivery_session_id is not null;

alter table public.store_program_versions enable row level security;
alter table public.training_program_deliveries enable row level security;
alter table public.training_program_delivery_sessions enable row level security;

create policy "program parties can read deliveries"
on public.training_program_deliveries for select to authenticated
using (
  coach_id = auth.uid()
  or (athlete_id = auth.uid())
  or exists (
    select 1 from public.team_members member_row
    where member_row.team_id = training_program_deliveries.team_id
      and member_row.user_id = auth.uid()
  )
  or public.is_platform_owner()
);

create policy "program parties can read delivery sessions"
on public.training_program_delivery_sessions for select to authenticated
using (
  exists (
    select 1 from public.training_program_deliveries delivery_row
    where delivery_row.id = training_program_delivery_sessions.delivery_id
      and (
        delivery_row.coach_id = auth.uid()
        or delivery_row.athlete_id = auth.uid()
        or exists (
          select 1 from public.team_members member_row
          where member_row.team_id = delivery_row.team_id
            and member_row.user_id = auth.uid()
        )
        or public.is_platform_owner()
      )
  )
);

-- ---------------------------------------------------------------------------
-- Schedule and version helpers
-- ---------------------------------------------------------------------------

create or replace function public.get_coach_store_product_schedule(p_product_id uuid)
returns table (
  week_number integer,
  day_number integer,
  is_rest_day boolean,
  session_template_id uuid,
  session_title text,
  session_status public.session_status
)
language sql
stable
security definer
set search_path = public
as $$
  select
    schedule_row.week_number,
    schedule_row.day_number,
    schedule_row.is_rest_day,
    schedule_row.session_template_id,
    template_row.title,
    template_row.status
  from public.store_product_sessions schedule_row
  left join public.session_templates template_row
    on template_row.id = schedule_row.session_template_id
  join public.store_products product_row
    on product_row.id = schedule_row.product_id
  where schedule_row.product_id = p_product_id
    and (product_row.seller_coach_id = auth.uid() or public.is_platform_owner())
  order by schedule_row.week_number, schedule_row.day_number;
$$;

create or replace function public.validate_store_program_schedule(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_count integer;
  active_count integer;
  product_row public.store_products%rowtype;
begin
  select * into product_row from public.store_products where id = p_product_id;
  if product_row.id is null then
    raise exception using message = 'Produto não encontrado.';
  end if;
  if char_length(btrim(product_row.title)) < 2
     or char_length(btrim(product_row.short_description)) < 8
     or product_row.price_cents <= 0 then
    raise exception using message = 'O produto precisa de título, resumo e preço válidos.';
  end if;

  select count(*)::integer, count(*) filter (where not is_rest_day)::integer
    into schedule_count, active_count
  from public.store_product_sessions
  where product_id = p_product_id;

  if schedule_count = 0 or active_count = 0 then
    raise exception using message = 'O programa precisa ter ao menos uma sessão de treino.';
  end if;

  if exists (
    select 1
    from public.store_product_sessions schedule_row
    left join public.session_templates template_row on template_row.id = schedule_row.session_template_id
    where schedule_row.product_id = p_product_id
      and not schedule_row.is_rest_day
      and (
        template_row.id is null
        or template_row.created_by <> (select seller_coach_id from public.store_products where id = p_product_id)
        or template_row.status <> 'published'
      )
  ) then
    raise exception using message = 'Todas as sessões precisam ser templates publicados do coach vendedor.';
  end if;
end;
$$;

create or replace function public.create_store_training_program(
  p_title text,
  p_slug text,
  p_description text,
  p_short_description text,
  p_cover_image_url text,
  p_price_cents integer,
  p_category public.store_product_category,
  p_level public.store_product_level,
  p_duration_weeks integer,
  p_schedule jsonb
)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.store_products%rowtype;
  day_json jsonb;
  template_id uuid;
  week_value integer;
  day_value integer;
  rest_value boolean;
begin
  if auth.uid() is null or (not public.is_coach() and not public.is_platform_owner()) then
    raise exception using message = 'Somente coaches podem criar produtos.';
  end if;

  if char_length(btrim(p_title)) < 2 or char_length(btrim(p_short_description)) < 8 then
    raise exception using message = 'Preencha título e resumo do programa.';
  end if;
  if p_price_cents is null or p_price_cents <= 0 then
    raise exception using message = 'O preço precisa ser maior que zero.';
  end if;
  if p_duration_weeks is not null and p_duration_weeks <= 0 then
    raise exception using message = 'A duração precisa ser maior que zero.';
  end if;
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) = 0 then
    raise exception using message = 'Adicione ao menos um dia ao programa.';
  end if;

  insert into public.store_products (
    seller_coach_id, type, title, slug, description, short_description, cover_image_url,
    price_cents, category, level, duration_weeks
  ) values (
    auth.uid(), 'training_program', btrim(p_title), lower(btrim(p_slug)),
    coalesce(btrim(p_description), ''), btrim(p_short_description), nullif(btrim(p_cover_image_url), ''),
    p_price_cents, p_category, p_level, p_duration_weeks
  ) returning * into product_row;

  for day_json in select value from jsonb_array_elements(p_schedule)
  loop
    week_value := (day_json->>'week_number')::integer;
    day_value := (day_json->>'day_number')::integer;
    rest_value := coalesce((day_json->>'is_rest_day')::boolean, false);
    template_id := nullif(day_json->>'session_template_id', '')::uuid;

    if week_value <= 0 or day_value not between 1 and 7 then
      raise exception using message = 'Semana ou dia inválido no programa.';
    end if;
    if rest_value and template_id is not null then
      raise exception using message = 'Dia de descanso não pode ter treino vinculado.';
    end if;
    if not rest_value and template_id is null then
      raise exception using message = 'Cada dia de treino precisa de um template.';
    end if;
    if template_id is not null and not exists (
      select 1 from public.session_templates
      where id = template_id and created_by = auth.uid() and status = 'published'
    ) then
      raise exception using message = 'O treino selecionado não pertence ao coach ou não está publicado.';
    end if;

    insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number, is_rest_day)
    values (product_row.id, template_id, week_value, day_value, rest_value);
  end loop;

  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (product_row.id, auth.uid(), 'PRODUCT_CREATED', to_jsonb(product_row));

  return product_row;
exception
  when unique_violation then
    raise exception using message = 'Já existe um produto com este slug ou dois dias repetidos.';
end;
$$;

create or replace function public.update_store_training_program(
  p_product_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_short_description text,
  p_cover_image_url text,
  p_price_cents integer,
  p_category public.store_product_category,
  p_level public.store_product_level,
  p_duration_weeks integer,
  p_schedule jsonb
)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_row public.store_products%rowtype;
  product_row public.store_products%rowtype;
  day_json jsonb;
  template_id uuid;
  week_value integer;
  day_value integer;
  rest_value boolean;
begin
  select * into previous_row from public.store_products
  where id = p_product_id and seller_coach_id = auth.uid();
  if previous_row.id is null or previous_row.status = 'archived' then
    raise exception using message = 'Produto não encontrado ou não autorizado.';
  end if;
  if char_length(btrim(p_title)) < 2 or char_length(btrim(p_short_description)) < 8 then
    raise exception using message = 'Preencha título e resumo do programa.';
  end if;
  if p_price_cents is null or p_price_cents <= 0 then
    raise exception using message = 'O preço precisa ser maior que zero.';
  end if;
  if p_duration_weeks is not null and p_duration_weeks <= 0 then
    raise exception using message = 'A duração precisa ser maior que zero.';
  end if;
  product_row := previous_row;

  update public.store_products
  set title = btrim(p_title), slug = lower(btrim(p_slug)), description = coalesce(btrim(p_description), ''),
      short_description = btrim(p_short_description), cover_image_url = nullif(btrim(p_cover_image_url), ''),
      price_cents = p_price_cents, category = p_category, level = p_level,
      duration_weeks = p_duration_weeks, status = 'draft'
  where id = p_product_id
  returning * into product_row;

  delete from public.store_product_sessions where product_id = p_product_id;

  -- Reusa a lógica de schedule sem criar outro produto.
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) = 0 then
    raise exception using message = 'Adicione ao menos um dia ao programa.';
  end if;
  for day_json in select value from jsonb_array_elements(p_schedule)
  loop
    week_value := (day_json->>'week_number')::integer;
    day_value := (day_json->>'day_number')::integer;
    rest_value := coalesce((day_json->>'is_rest_day')::boolean, false);
    template_id := nullif(day_json->>'session_template_id', '')::uuid;
    if week_value <= 0 or day_value not between 1 and 7 then
      raise exception using message = 'Semana ou dia inválido no programa.';
    end if;
    if rest_value <> (template_id is null) then
      raise exception using message = 'Cada dia deve ser descanso ou possuir exatamente um treino.';
    end if;
    if template_id is not null and not exists (
      select 1 from public.session_templates where id = template_id and created_by = auth.uid() and status = 'published'
    ) then
      raise exception using message = 'O treino selecionado não pertence ao coach ou não está publicado.';
    end if;
    insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number, is_rest_day)
    values (p_product_id, template_id, week_value, day_value, rest_value);
  end loop;

  insert into public.store_product_audit (product_id, actor_id, action, previous_value, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_UPDATED', to_jsonb(previous_row), to_jsonb(product_row));
  return product_row;
exception
  when unique_violation then
    raise exception using message = 'Já existe um produto com este slug ou dois dias repetidos.';
end;
$$;

create or replace function public.submit_store_product_review(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare product_row public.store_products%rowtype;
begin
  select * into product_row from public.store_products where id = p_product_id and seller_coach_id = auth.uid();
  if product_row.id is null or product_row.status not in ('draft', 'review') then
    raise exception using message = 'Produto não encontrado ou não pode ser enviado para análise.';
  end if;
  perform public.validate_store_program_schedule(p_product_id);
  update public.store_products set status = 'review' where id = p_product_id returning * into product_row;
  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_SUBMITTED_FOR_REVIEW', to_jsonb(product_row));
  return product_row;
end;
$$;

-- Cria snapshot completo apenas dentro de funções protegidas; nunca é exposto por SELECT público.
create or replace function public.create_store_program_version_internal(p_product_id uuid, p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_id uuid;
  next_version integer;
  snapshot_value jsonb;
begin
  perform public.validate_store_program_schedule(p_product_id);
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.store_program_versions where product_id = p_product_id;

  select jsonb_build_object(
    'schema_version', 1,
    'sessions', coalesce(jsonb_agg(
      jsonb_build_object(
        'week_number', schedule_row.week_number,
        'day_number', schedule_row.day_number,
        'is_rest_day', schedule_row.is_rest_day,
        'template_id', schedule_row.session_template_id,
        'title', case when schedule_row.is_rest_day then 'Descanso' else template_row.title end,
        'snapshot', case when schedule_row.is_rest_day then null else public.build_template_snapshot(schedule_row.session_template_id) end
      ) order by schedule_row.week_number, schedule_row.day_number
    ), '[]'::jsonb)
  ) into snapshot_value
  from public.store_product_sessions schedule_row
  left join public.session_templates template_row on template_row.id = schedule_row.session_template_id
  where schedule_row.product_id = p_product_id;

  insert into public.store_program_versions (product_id, version_number, snapshot, created_by)
  values (p_product_id, next_version, snapshot_value, p_actor_id)
  returning id into version_id;
  return version_id;
end;
$$;

create or replace function public.approve_store_product(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare product_row public.store_products%rowtype; version_id uuid;
begin
  if not public.is_platform_owner() then
    raise exception using message = 'Somente administradores podem aprovar produtos.';
  end if;
  select * into product_row from public.store_products where id = p_product_id and status = 'review' for update;
  if product_row.id is null then raise exception using message = 'Produto não encontrado ou fora da fila de análise.'; end if;
  version_id := public.create_store_program_version_internal(p_product_id, auth.uid());
  update public.store_products set status = 'published' where id = p_product_id returning * into product_row;
  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_APPROVED', jsonb_build_object('product', to_jsonb(product_row), 'version_id', version_id));
  return product_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delivery: cria sessões publicadas a partir do snapshot e usa o executor existente.
-- ---------------------------------------------------------------------------

create or replace function public.create_training_program_delivery(
  p_product_id uuid,
  p_team_id uuid default null,
  p_athlete_id uuid default null,
  p_start_date date default current_date
)
returns public.training_program_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.store_products%rowtype;
  version_row public.store_program_versions%rowtype;
  delivery_row public.training_program_deliveries%rowtype;
  delivery_session_row public.training_program_delivery_sessions%rowtype;
  session_json jsonb;
  target_team_id uuid := p_team_id;
  session_date date;
begin
  select * into product_row from public.store_products where id = p_product_id and status = 'published';
  if product_row.id is null or product_row.seller_coach_id <> auth.uid() then
    raise exception using message = 'Produto publicado não encontrado ou não autorizado.';
  end if;
  select * into version_row from public.store_program_versions
  where product_id = p_product_id order by version_number desc limit 1;
  if version_row.id is null then raise exception using message = 'Programa sem versão publicada.'; end if;

  if p_team_id is not null and not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente o coach da equipe pode criar uma entrega.';
  end if;
  if p_athlete_id is not null and p_team_id is not null and not exists (
    select 1 from public.team_members where team_id = p_team_id and user_id = p_athlete_id and role = 'athlete'
  ) then
    raise exception using message = 'O atleta não pertence à equipe selecionada.';
  end if;
  if p_team_id is null and p_athlete_id is not null and not exists (
    select 1
    from public.team_members athlete_member
    join public.team_members coach_member
      on coach_member.team_id = athlete_member.team_id
     and coach_member.user_id = auth.uid()
     and coach_member.role = 'coach'
    where athlete_member.user_id = p_athlete_id
      and athlete_member.role = 'athlete'
  ) then
    raise exception using message = 'O atleta não está vinculado a uma equipe autorizada deste coach.';
  end if;
  if p_team_id is null and p_athlete_id is null then
    raise exception using message = 'Selecione uma equipe ou atleta para a entrega.';
  end if;

  if target_team_id is null then
    insert into public.teams (name, description, level, objective, created_by)
    values (
      left('Programa privado · ' || product_row.title, 120),
      'Equipe privada criada para uma entrega individual.',
      'iniciante', 'Entrega individual de programa', auth.uid()
    ) returning id into target_team_id;
    insert into public.team_members (team_id, user_id, role)
    values (target_team_id, p_athlete_id, 'athlete') on conflict (team_id, user_id) do nothing;
  end if;

  insert into public.training_program_deliveries (product_id, version_id, coach_id, team_id, athlete_id, start_date, created_by)
  values (p_product_id, version_row.id, auth.uid(), target_team_id, p_athlete_id, coalesce(p_start_date, current_date), auth.uid())
  returning * into delivery_row;

  for session_json in select value from jsonb_array_elements(version_row.snapshot->'sessions')
  loop
    session_date := delivery_row.start_date
      + (((session_json->>'week_number')::integer - 1) * 7)
      + ((session_json->>'day_number')::integer - 1);
    insert into public.training_program_delivery_sessions (
      delivery_id, week_number, day_number, scheduled_date, is_rest_day, title, snapshot
    ) values (
      delivery_row.id,
      (session_json->>'week_number')::integer,
      (session_json->>'day_number')::integer,
      session_date,
      coalesce((session_json->>'is_rest_day')::boolean, false),
      coalesce(session_json->>'title', 'Sessão'),
      session_json->'snapshot'
    ) returning * into delivery_session_row;

    if not delivery_session_row.is_rest_day then
      insert into public.session_instances (
        template_id, team_id, scheduled_date, status, snapshot, created_by, program_delivery_session_id
      ) values (
        (session_json->>'template_id')::uuid, target_team_id, session_date, 'published',
        delivery_session_row.snapshot, auth.uid(), delivery_session_row.id
      );
      update public.training_program_delivery_sessions
      set session_instance_id = (select id from public.session_instances where program_delivery_session_id = delivery_session_row.id)
      where id = delivery_session_row.id;
    end if;
  end loop;

  return delivery_row;
end;
$$;

-- Entrega individual automática após compra. É chamada somente pelo settlement do webhook.
create or replace function public.populate_program_delivery_sessions(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare delivery_row public.training_program_deliveries%rowtype; version_row public.store_program_versions%rowtype; item jsonb; ds public.training_program_delivery_sessions%rowtype; target_date date;
begin
  select * into delivery_row from public.training_program_deliveries where id = p_delivery_id;
  select * into version_row from public.store_program_versions where id = delivery_row.version_id;
  for item in select value from jsonb_array_elements(version_row.snapshot->'sessions') loop
    target_date := delivery_row.start_date + (((item->>'week_number')::integer - 1) * 7) + ((item->>'day_number')::integer - 1);
    insert into public.training_program_delivery_sessions (delivery_id, week_number, day_number, scheduled_date, is_rest_day, title, snapshot)
    values (delivery_row.id, (item->>'week_number')::integer, (item->>'day_number')::integer, target_date, coalesce((item->>'is_rest_day')::boolean, false), coalesce(item->>'title', 'Sessão'), item->'snapshot')
    on conflict (delivery_id, week_number, day_number) do nothing
    returning * into ds;
    if ds.id is not null and not ds.is_rest_day then
      insert into public.session_instances (template_id, team_id, scheduled_date, status, snapshot, created_by, program_delivery_session_id)
      values ((item->>'template_id')::uuid, delivery_row.team_id, target_date, 'published', ds.snapshot, delivery_row.coach_id, ds.id)
      on conflict (program_delivery_session_id) do nothing;
      update public.training_program_delivery_sessions
      set session_instance_id = (select id from public.session_instances where program_delivery_session_id = ds.id)
      where id = ds.id;
    end if;
  end loop;
end;
$$;

create or replace function public.grant_store_program_delivery(
  p_product_id uuid,
  p_version_id uuid,
  p_buyer_id uuid,
  p_coach_id uuid,
  p_start_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare team_id uuid; delivery_id uuid; product_title text;
begin
  select title into product_title from public.store_products where id = p_product_id;
  insert into public.teams (name, description, level, objective, created_by)
  values (left('Programa · ' || product_title, 120), 'Entrega privada de programa comprado.', 'iniciante', 'Programa comprado', p_coach_id)
  returning id into team_id;
  insert into public.team_members (team_id, user_id, role)
  values (team_id, p_buyer_id, 'athlete') on conflict (team_id, user_id) do nothing;
  insert into public.training_program_deliveries (product_id, version_id, coach_id, team_id, athlete_id, start_date, created_by)
  values (p_product_id, p_version_id, p_coach_id, team_id, p_buyer_id, coalesce(p_start_date, current_date), p_coach_id)
  returning id into delivery_id;
  perform public.populate_program_delivery_sessions(delivery_id);
  return delivery_id;
end;
$$;

-- A função existente de settlement passa a guardar a versão e criar a entrega privada.
create or replace function public.settle_store_order(
  p_provider_payment_id text,
  p_amount_cents integer,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare intent_row public.store_payment_intents%rowtype; order_row public.store_orders%rowtype; item_row public.store_order_items%rowtype; product_row public.store_products%rowtype; version_id uuid; access_id uuid;
begin
  select * into intent_row from public.store_payment_intents where provider = 'mercado_pago' and provider_payment_id = p_provider_payment_id for update;
  if intent_row.id is null or intent_row.amount_cents <> p_amount_cents then raise exception using message = 'Intenção de compra inválida.'; end if;
  select * into order_row from public.store_orders where id = intent_row.order_id for update;
  if order_row.id is null or order_row.status = 'cancelled' then raise exception using message = 'Pedido não encontrado ou cancelado.'; end if;
  -- Reentrega do mesmo webhook é sucesso, sem criar uma nova equipe ou sessão.
  if order_row.status = 'paid' then return order_row.id; end if;
  select * into item_row from public.store_order_items where order_id = order_row.id limit 1;
  -- Uma edição posterior do catálogo não apaga o direito de uma compra já iniciada.
  select * into product_row from public.store_products where id = item_row.product_id;
  select id into version_id from public.store_program_versions where product_id = product_row.id order by version_number desc limit 1;
  update public.store_payment_intents set status = 'approved' where id = intent_row.id;
  update public.store_orders set status = 'paid', provider_payment_id = p_provider_payment_id, paid_at = coalesce(p_paid_at, now()) where id = order_row.id;
  insert into public.training_program_access (user_id, product_id, order_id, version_id)
  values (order_row.buyer_id, item_row.product_id, order_row.id, version_id)
  on conflict (user_id, product_id) do update set order_id = excluded.order_id, version_id = excluded.version_id, revoked_at = null
  returning id into access_id;
  if version_id is not null and not exists (
    select 1 from public.training_program_access where id = access_id and delivery_id is not null
  ) then
    update public.training_program_access
    set delivery_id = public.grant_store_program_delivery(product_row.id, version_id, order_row.buyer_id, product_row.seller_coach_id)
    where id = access_id and delivery_id is null;
  end if;
  return order_row.id;
end;
$$;

-- Leitura do comprador usa o snapshot da versão, não a biblioteca viva.
create or replace function public.list_my_training_programs()
returns table (access_id uuid, product_id uuid, order_id uuid, title text, seller_coach_id uuid, seller_display_name text, duration_weeks integer, granted_at timestamptz, sessions jsonb)
language sql stable security definer set search_path = public
as $$
  select access_row.id, access_row.product_id, access_row.order_id, order_row_product.title, order_row_product.seller_coach_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))), order_row_product.duration_weeks, access_row.granted_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', ds.id, 'week_number', ds.week_number, 'day_number', ds.day_number, 'title', ds.title, 'is_rest_day', ds.is_rest_day, 'session_instance_id', ds.session_instance_id) order by ds.week_number, ds.day_number) from public.training_program_delivery_sessions ds join public.training_program_deliveries d on d.id = ds.delivery_id where d.id = access_row.delivery_id),
      (select jsonb_agg(jsonb_build_object('id', concat(access_row.product_id::text, ':', item->>'week_number', ':', item->>'day_number'), 'week_number', (item->>'week_number')::integer, 'day_number', (item->>'day_number')::integer, 'title', item->>'title', 'is_rest_day', coalesce((item->>'is_rest_day')::boolean, false)) order by (item->>'week_number')::integer, (item->>'day_number')::integer) from jsonb_array_elements(version_row.snapshot->'sessions') item), '[]'::jsonb) as sessions
  from public.training_program_access access_row
  join public.store_products order_row_product on order_row_product.id = access_row.product_id
  join auth.users user_row on user_row.id = order_row_product.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = order_row_product.seller_coach_id
  left join public.store_program_versions version_row on version_row.id = access_row.version_id
  where access_row.user_id = auth.uid() and access_row.revoked_at is null;
$$;

-- As três funções abaixo são "language sql" e já usam o schema final de
-- "objective"/"day_type"; por serem checadas na criação (não em runtime),
-- as colunas precisam existir aqui, mesmo com o backfill completo só
-- rodando na seção "Programa-base relativo" mais adiante neste arquivo.
alter table public.store_products
  add column if not exists objective text not null default '';
alter table public.store_product_sessions
  add column if not exists day_type text;

drop function if exists public.list_coach_store_products();
create function public.list_coach_store_products()
returns table (
  id uuid, seller_coach_id uuid, type public.store_product_type, title text, slug text,
  description text, short_description text, cover_image_url text, session_template_id uuid,
  price_cents integer, category public.store_product_category, objective text,
  level public.store_product_level, duration_weeks integer, status public.store_product_status,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select product_row.id, product_row.seller_coach_id, product_row.type, product_row.title, product_row.slug,
    product_row.description, product_row.short_description, product_row.cover_image_url,
    (select session_template_id from public.store_product_sessions where product_id = product_row.id and day_type = 'training' order by week_number, day_number limit 1),
    product_row.price_cents, product_row.category, product_row.objective, product_row.level,
    product_row.duration_weeks, product_row.status, product_row.created_at, product_row.updated_at
  from public.store_products product_row
  where product_row.seller_coach_id = auth.uid() or public.is_platform_owner()
  order by product_row.updated_at desc;
$$;

drop function if exists public.list_store_products(public.store_product_category);
create function public.list_store_products(p_category public.store_product_category default null)
returns table (
  id uuid, seller_coach_id uuid, seller_display_name text, type public.store_product_type, title text,
  slug text, short_description text, cover_image_url text, price_cents integer,
  category public.store_product_category, objective text, level public.store_product_level,
  duration_weeks integer, status public.store_product_status, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select product_row.id, product_row.seller_coach_id, coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))), product_row.type,
    product_row.title, product_row.slug, product_row.short_description, product_row.cover_image_url,
    product_row.price_cents, product_row.category, product_row.objective, product_row.level,
    product_row.duration_weeks, product_row.status, product_row.created_at
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where product_row.status = 'published' and (p_category is null or product_row.category = p_category)
  order by product_row.created_at desc;
$$;

drop function if exists public.get_store_product(text);
create function public.get_store_product(p_slug text)
returns table (
  id uuid, seller_coach_id uuid, seller_display_name text, type public.store_product_type, title text,
  slug text, description text, short_description text, cover_image_url text, price_cents integer,
  category public.store_product_category, objective text, level public.store_product_level,
  duration_weeks integer, status public.store_product_status, sessions jsonb
)
language sql stable security definer set search_path = public
as $$
  select product_row.id, product_row.seller_coach_id, coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))), product_row.type,
    product_row.title, product_row.slug, product_row.description, product_row.short_description, product_row.cover_image_url,
    product_row.price_cents, product_row.category, product_row.objective, product_row.level, product_row.duration_weeks, product_row.status,
    coalesce((select jsonb_agg(jsonb_build_object('id', product_session_row.id, 'week_number', product_session_row.week_number, 'day_number', product_session_row.day_number, 'day_type', product_session_row.day_type, 'title', case product_session_row.day_type when 'training' then template_row.title when 'rest' then 'Descanso' when 'recovery' then 'Recuperação' when 'assessment' then 'Avaliação' else 'Sem programação' end) order by product_session_row.week_number, product_session_row.day_number)
      from public.store_product_sessions product_session_row left join public.session_templates template_row on template_row.id = product_session_row.session_template_id where product_session_row.product_id = product_row.id), '[]'::jsonb)
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where product_row.slug = lower(btrim(p_slug)) and (product_row.status = 'published' or product_row.seller_coach_id = auth.uid() or public.is_platform_owner());
$$;

revoke all on function public.get_coach_store_product_schedule(uuid) from public;
revoke all on function public.validate_store_program_schedule(uuid) from public;
-- Os RPCs do MVP permanecem no catálogo histórico, mas não podem contornar o schedule
-- multi-sessão e a regra de voltar para draft ao editar.
revoke all on function public.create_store_training_product(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid) from public;
revoke all on function public.update_store_training_product(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid) from public;
revoke all on function public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb) from public;
revoke all on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb) from public;
revoke all on function public.create_store_program_version_internal(uuid, uuid) from public;
revoke all on function public.create_training_program_delivery(uuid, uuid, uuid, date) from public;
revoke all on function public.grant_store_program_delivery(uuid, uuid, uuid, uuid, date) from public;
revoke all on function public.populate_program_delivery_sessions(uuid) from public;
revoke all on function public.settle_store_order(text, integer, timestamptz) from public;
revoke all on function public.list_my_training_programs() from public;

grant execute on function public.get_coach_store_product_schedule(uuid) to authenticated;
grant execute on function public.list_coach_store_products() to authenticated;
grant execute on function public.list_store_products(public.store_product_category) to authenticated;
grant execute on function public.get_store_product(text) to authenticated;
grant execute on function public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb) to authenticated;
grant execute on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb) to authenticated;
grant execute on function public.create_training_program_delivery(uuid, uuid, uuid, date) to authenticated;
grant execute on function public.list_my_training_programs() to authenticated;
grant execute on function public.settle_store_order(text, integer, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Programa-base relativo: duração obrigatória, sete dias por semana e cinco
-- tipos de dia. Datas só existem nas instâncias de entrega do aluno.
-- ---------------------------------------------------------------------------

alter table public.store_products
  add column if not exists objective text not null default '';

update public.store_products product_row
set duration_weeks = coalesce(
  product_row.duration_weeks,
  (select greatest(coalesce(max(session_row.week_number), 1), 1) from public.store_product_sessions session_row where session_row.product_id = product_row.id),
  1
),
objective = case when char_length(btrim(product_row.objective)) >= 2 then product_row.objective else initcap(replace(product_row.category::text, '_', ' ')) end
where product_row.type = 'training_program';

alter table public.store_products
  drop constraint if exists store_products_training_program_duration_check;
alter table public.store_products
  add constraint store_products_training_program_duration_check
  check (type <> 'training_program' or duration_weeks is not null and duration_weeks > 0);
alter table public.store_products
  add constraint store_products_training_program_objective_check
  check (type <> 'training_program' or char_length(btrim(objective)) >= 2);

alter table public.store_product_sessions
  add column if not exists day_type text;
update public.store_product_sessions
set day_type = case when is_rest_day then 'rest' else 'training' end
where day_type is null;
alter table public.store_product_sessions
  alter column day_type set not null;
alter table public.store_product_sessions
  drop constraint if exists store_product_sessions_day_type_check;
alter table public.store_product_sessions
  add constraint store_product_sessions_day_type_check
  check (day_type in ('training', 'rest', 'recovery', 'assessment', 'unprogrammed'));
alter table public.store_product_sessions
  drop constraint if exists store_product_sessions_template_or_rest_check;
alter table public.store_product_sessions
  add constraint store_product_sessions_template_for_day_type_check
  check (
    (day_type = 'training' and session_template_id is not null and not is_rest_day)
    or (day_type <> 'training' and session_template_id is null and is_rest_day)
  );

-- Produtos anteriores ganham posições explícitas sem transformar dias relativos
-- em datas. O preenchimento é sempre "Sem programação".
insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number, is_rest_day, day_type)
select product_row.id, null, generated_weeks.week_number, generated_days.day_number, true, 'unprogrammed'
from public.store_products product_row
cross join lateral generate_series(1, product_row.duration_weeks) as generated_weeks(week_number)
cross join lateral generate_series(1, 7) as generated_days(day_number)
where product_row.type = 'training_program'
  and not exists (
    select 1 from public.store_product_sessions existing_row
    where existing_row.product_id = product_row.id
      and existing_row.week_number = generated_weeks.week_number
      and existing_row.day_number = generated_days.day_number
  );

alter table public.training_program_delivery_sessions
  add column if not exists day_type text;
update public.training_program_delivery_sessions
set day_type = case when is_rest_day then 'rest' else 'training' end
where day_type is null;
alter table public.training_program_delivery_sessions
  alter column day_type set not null;
alter table public.training_program_delivery_sessions
  drop constraint if exists training_program_delivery_sessions_day_type_check;
alter table public.training_program_delivery_sessions
  add constraint training_program_delivery_sessions_day_type_check
  check (day_type in ('training', 'rest', 'recovery', 'assessment', 'unprogrammed'));
alter table public.training_program_delivery_sessions
  drop constraint if exists training_program_delivery_sessions_check;
alter table public.training_program_delivery_sessions
  add constraint training_program_delivery_sessions_snapshot_for_day_type_check
  check ((day_type = 'training' and snapshot is not null and not is_rest_day) or (day_type <> 'training' and snapshot is null and is_rest_day));

-- A data escolhida pelo atleta fica no pedido, antes do webhook. O webhook só
-- relê esse valor persistido; nunca confia em um payload externo para agendar.
alter table public.store_orders
  add column if not exists program_start_date date;
update public.store_orders set program_start_date = coalesce(program_start_date, created_at::date, current_date);
alter table public.store_orders
  alter column program_start_date set not null;

-- O formato antigo de snapshot é elevado uma única vez. Versões novas usam os
-- metadados congelados abaixo, então edição futura do catálogo não reescreve
-- histórico de quem já comprou.
update public.store_program_versions version_row
set snapshot = jsonb_build_object(
  'schema_version', 2,
  'product', jsonb_build_object(
    'title', product_row.title,
    'slug', product_row.slug,
    'description', product_row.description,
    'short_description', product_row.short_description,
    'cover_image_url', product_row.cover_image_url,
    'price_cents', product_row.price_cents,
    'category', product_row.category,
    'objective', product_row.objective,
    'level', product_row.level,
    -- A duração de uma versão histórica pertence ao snapshot. O catálogo pode
    -- já estar na v2 com outra duração quando este upgrade for aplicado.
    'duration_weeks', coalesce(
      (
        select max(nullif(item.value->>'week_number', '')::integer)
        from jsonb_array_elements(coalesce(version_row.snapshot->'sessions', '[]'::jsonb)) item(value)
      ),
      nullif(version_row.snapshot->'product'->>'duration_weeks', '')::integer,
      1
    ),
    'seller_coach_id', product_row.seller_coach_id
  ),
  'sessions', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'week_number', (item.value->>'week_number')::integer,
        'day_number', (item.value->>'day_number')::integer,
        'day_type', case when coalesce((item.value->>'is_rest_day')::boolean, false) then 'rest' else 'training' end,
        'template_id', item.value->'template_id',
        'title', coalesce(item.value->>'title', case when coalesce((item.value->>'is_rest_day')::boolean, false) then 'Descanso' else 'Treino' end),
        'snapshot', item.value->'snapshot'
      ) order by (item.value->>'week_number')::integer, (item.value->>'day_number')::integer
    ) from jsonb_array_elements(version_row.snapshot->'sessions') item
  ), '[]'::jsonb)
)
from public.store_products product_row
where product_row.id = version_row.product_id;

drop function if exists public.get_coach_store_product_schedule(uuid);
create function public.get_coach_store_product_schedule(p_product_id uuid)
returns table (week_number integer, day_number integer, day_type text, session_template_id uuid, session_title text, session_status public.session_status)
language sql stable security definer set search_path = public
as $$
  select schedule_row.week_number, schedule_row.day_number, schedule_row.day_type, schedule_row.session_template_id, template_row.title, template_row.status
  from public.store_product_sessions schedule_row
  left join public.session_templates template_row on template_row.id = schedule_row.session_template_id
  join public.store_products product_row on product_row.id = schedule_row.product_id
  where schedule_row.product_id = p_product_id
    and (product_row.seller_coach_id = auth.uid() or public.is_platform_owner())
  order by schedule_row.week_number, schedule_row.day_number;
$$;

create or replace function public.validate_store_program_schedule(p_product_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare product_row public.store_products%rowtype; schedule_count integer; training_count integer;
begin
  select * into product_row from public.store_products where id = p_product_id;
  if product_row.id is null then raise exception using message = 'Produto não encontrado.'; end if;
  if char_length(btrim(product_row.title)) < 2 or char_length(btrim(product_row.short_description)) < 8 or char_length(btrim(product_row.objective)) < 2 or product_row.price_cents <= 0 or product_row.duration_weeks is null or product_row.duration_weeks < 1 then
    raise exception using message = 'O produto precisa de título, resumo, objetivo, preço e duração válidos.';
  end if;
  select count(*)::integer, count(*) filter (where day_type = 'training')::integer into schedule_count, training_count
  from public.store_product_sessions where product_id = p_product_id;
  if schedule_count <> product_row.duration_weeks * 7 then raise exception using message = 'O programa precisa conter os 7 dias de cada semana.'; end if;
  if training_count = 0 then raise exception using message = 'O programa precisa ter ao menos uma sessão de treino.'; end if;
  if exists (select 1 from public.store_product_sessions where product_id = p_product_id and (week_number < 1 or week_number > product_row.duration_weeks or day_number not between 1 and 7)) then
    raise exception using message = 'A estrutura contém uma semana ou dia fora da duração.';
  end if;
  if exists (
    select 1 from public.store_product_sessions schedule_row
    left join public.session_templates template_row on template_row.id = schedule_row.session_template_id
    where schedule_row.product_id = p_product_id and schedule_row.day_type = 'training'
      and (template_row.id is null or template_row.status <> 'published' or (template_row.created_by <> product_row.seller_coach_id and not public.is_platform_owner()))
  ) then raise exception using message = 'Todas as sessões precisam ser templates publicados e autorizados.'; end if;
end;
$$;

drop function if exists public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb);
create function public.create_store_training_program(
  p_title text, p_slug text, p_description text, p_short_description text, p_cover_image_url text,
  p_price_cents integer, p_category public.store_product_category, p_objective text, p_level public.store_product_level,
  p_duration_weeks integer, p_schedule jsonb
) returns public.store_products language plpgsql security definer set search_path = public
as $$
declare product_row public.store_products%rowtype; day_json jsonb; template_id uuid; week_value integer; day_value integer; day_type_value text;
begin
  if auth.uid() is null or (not public.is_coach() and not public.is_platform_owner()) then raise exception using message = 'Somente coaches podem criar produtos.'; end if;
  if char_length(btrim(p_title)) < 2 or char_length(btrim(p_short_description)) < 8 or char_length(btrim(p_objective)) < 2 then raise exception using message = 'Preencha título, resumo e objetivo do programa.'; end if;
  if p_price_cents is null or p_price_cents <= 0 then raise exception using message = 'O preço precisa ser maior que zero.'; end if;
  if p_duration_weeks is null or p_duration_weeks < 1 then raise exception using message = 'A duração precisa ser um número positivo de semanas.'; end if;
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) <> p_duration_weeks * 7 then raise exception using message = 'A duração precisa gerar os 7 dias de cada semana.'; end if;
  insert into public.store_products (seller_coach_id, type, title, slug, description, short_description, cover_image_url, price_cents, category, objective, level, duration_weeks)
  values (auth.uid(), 'training_program', btrim(p_title), lower(btrim(p_slug)), coalesce(btrim(p_description), ''), btrim(p_short_description), nullif(btrim(p_cover_image_url), ''), p_price_cents, p_category, btrim(p_objective), p_level, p_duration_weeks) returning * into product_row;
  for day_json in select value from jsonb_array_elements(p_schedule) loop
    week_value := (day_json->>'week_number')::integer; day_value := (day_json->>'day_number')::integer; day_type_value := day_json->>'day_type'; template_id := nullif(day_json->>'session_template_id', '')::uuid;
    if week_value not between 1 and p_duration_weeks or day_value not between 1 and 7 or day_type_value not in ('training', 'rest', 'recovery', 'assessment', 'unprogrammed') then raise exception using message = 'Semana, dia ou tipo de dia inválido.'; end if;
    if (day_type_value = 'training') <> (template_id is not null) then raise exception using message = 'Somente dias de treino podem ter treino vinculado.'; end if;
    if template_id is not null and not exists (select 1 from public.session_templates where id = template_id and status = 'published' and (created_by = auth.uid() or public.is_platform_owner())) then raise exception using message = 'O treino selecionado não pertence ao coach ou não está publicado.'; end if;
    insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number, is_rest_day, day_type) values (product_row.id, template_id, week_value, day_value, day_type_value <> 'training', day_type_value);
  end loop;
  perform public.validate_store_program_schedule(product_row.id);
  insert into public.store_product_audit (product_id, actor_id, action, new_value) values (product_row.id, auth.uid(), 'PRODUCT_CREATED', to_jsonb(product_row));
  return product_row;
exception when unique_violation then raise exception using message = 'Há dias repetidos no programa.';
end;
$$;

drop function if exists public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb);
create function public.update_store_training_program(
  p_product_id uuid, p_title text, p_slug text, p_description text, p_short_description text, p_cover_image_url text,
  p_price_cents integer, p_category public.store_product_category, p_objective text, p_level public.store_product_level,
  p_duration_weeks integer, p_schedule jsonb
) returns public.store_products language plpgsql security definer set search_path = public
as $$
declare previous_row public.store_products%rowtype; product_row public.store_products%rowtype; day_json jsonb; template_id uuid; week_value integer; day_value integer; day_type_value text;
begin
  select * into previous_row from public.store_products where id = p_product_id and (seller_coach_id = auth.uid() or public.is_platform_owner());
  if previous_row.id is null or previous_row.status = 'archived' then raise exception using message = 'Produto não encontrado ou não autorizado.'; end if;
  if char_length(btrim(p_title)) < 2 or char_length(btrim(p_short_description)) < 8 or char_length(btrim(p_objective)) < 2 or p_price_cents is null or p_price_cents <= 0 then raise exception using message = 'Preencha os dados comerciais válidos.'; end if;
  if p_duration_weeks is null or p_duration_weeks < 1 or jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) <> p_duration_weeks * 7 then raise exception using message = 'A duração precisa gerar os 7 dias de cada semana.'; end if;
  update public.store_products set title = btrim(p_title), slug = lower(btrim(p_slug)), description = coalesce(btrim(p_description), ''), short_description = btrim(p_short_description), cover_image_url = nullif(btrim(p_cover_image_url), ''), price_cents = p_price_cents, category = p_category, objective = btrim(p_objective), level = p_level, duration_weeks = p_duration_weeks, status = 'draft' where id = p_product_id returning * into product_row;
  delete from public.store_product_sessions where product_id = p_product_id;
  for day_json in select value from jsonb_array_elements(p_schedule) loop
    week_value := (day_json->>'week_number')::integer; day_value := (day_json->>'day_number')::integer; day_type_value := day_json->>'day_type'; template_id := nullif(day_json->>'session_template_id', '')::uuid;
    if week_value not between 1 and p_duration_weeks or day_value not between 1 and 7 or day_type_value not in ('training', 'rest', 'recovery', 'assessment', 'unprogrammed') or ((day_type_value = 'training') <> (template_id is not null)) then raise exception using message = 'Semana, dia ou tipo de dia inválido.'; end if;
    if template_id is not null and not exists (select 1 from public.session_templates where id = template_id and status = 'published' and (created_by = product_row.seller_coach_id or public.is_platform_owner())) then raise exception using message = 'O treino selecionado não pertence ao coach ou não está publicado.'; end if;
    insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number, is_rest_day, day_type) values (p_product_id, template_id, week_value, day_value, day_type_value <> 'training', day_type_value);
  end loop;
  perform public.validate_store_program_schedule(p_product_id);
  insert into public.store_product_audit (product_id, actor_id, action, previous_value, new_value) values (p_product_id, auth.uid(), 'PRODUCT_UPDATED', to_jsonb(previous_row), to_jsonb(product_row));
  return product_row;
exception when unique_violation then raise exception using message = 'Há dias repetidos no programa.';
end;
$$;

create or replace function public.create_store_program_version_internal(p_product_id uuid, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare version_id uuid; next_version integer; snapshot_value jsonb; product_row public.store_products%rowtype;
begin
  perform public.validate_store_program_schedule(p_product_id);
  select * into product_row from public.store_products where id = p_product_id;
  select coalesce(max(version_number), 0) + 1 into next_version from public.store_program_versions where product_id = p_product_id;
  select jsonb_build_object(
    'schema_version', 2,
    'product', jsonb_build_object('title', product_row.title, 'slug', product_row.slug, 'description', product_row.description, 'short_description', product_row.short_description, 'cover_image_url', product_row.cover_image_url, 'price_cents', product_row.price_cents, 'category', product_row.category, 'objective', product_row.objective, 'level', product_row.level, 'duration_weeks', product_row.duration_weeks, 'seller_coach_id', product_row.seller_coach_id),
    'sessions', coalesce(jsonb_agg(jsonb_build_object('week_number', schedule_row.week_number, 'day_number', schedule_row.day_number, 'day_type', schedule_row.day_type, 'template_id', schedule_row.session_template_id, 'title', case schedule_row.day_type when 'training' then template_row.title when 'rest' then 'Descanso' when 'recovery' then 'Recuperação' when 'assessment' then 'Avaliação' else 'Sem programação' end, 'snapshot', case when schedule_row.day_type = 'training' then public.build_template_snapshot(schedule_row.session_template_id) else null end) order by schedule_row.week_number, schedule_row.day_number), '[]'::jsonb)
  ) into snapshot_value from public.store_product_sessions schedule_row left join public.session_templates template_row on template_row.id = schedule_row.session_template_id where schedule_row.product_id = p_product_id;
  insert into public.store_program_versions (product_id, version_number, snapshot, created_by) values (p_product_id, next_version, snapshot_value, p_actor_id) returning id into version_id;
  return version_id;
end;
$$;

create or replace function public.populate_program_delivery_sessions(p_delivery_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare delivery_row public.training_program_deliveries%rowtype; version_row public.store_program_versions%rowtype; item jsonb; ds public.training_program_delivery_sessions%rowtype; target_date date; item_type text;
begin
  select * into delivery_row from public.training_program_deliveries where id = p_delivery_id;
  select * into version_row from public.store_program_versions where id = delivery_row.version_id;
  if delivery_row.id is null or version_row.id is null then raise exception using message = 'Entrega ou versão não encontrada.'; end if;
  for item in select value from jsonb_array_elements(version_row.snapshot->'sessions') loop
    item_type := coalesce(item->>'day_type', case when coalesce((item->>'is_rest_day')::boolean, false) then 'rest' else 'training' end);
    target_date := delivery_row.start_date + (((item->>'week_number')::integer - 1) * 7) + ((item->>'day_number')::integer - 1);
    insert into public.training_program_delivery_sessions (delivery_id, week_number, day_number, scheduled_date, is_rest_day, day_type, title, snapshot)
    values (delivery_row.id, (item->>'week_number')::integer, (item->>'day_number')::integer, target_date, item_type <> 'training', item_type, coalesce(item->>'title', 'Sessão'), case when item_type = 'training' then item->'snapshot' else null end)
    on conflict (delivery_id, week_number, day_number) do nothing returning * into ds;
    if ds.id is not null and ds.day_type = 'training' then
      insert into public.session_instances (template_id, team_id, scheduled_date, status, snapshot, created_by, program_delivery_session_id)
      values ((item->>'template_id')::uuid, delivery_row.team_id, target_date, 'published', ds.snapshot, delivery_row.coach_id, ds.id)
      on conflict (program_delivery_session_id) do nothing;
      update public.training_program_delivery_sessions set session_instance_id = (select id from public.session_instances where program_delivery_session_id = ds.id) where id = ds.id;
    end if;
  end loop;
end;
$$;

-- Entrega manual do coach também instancia a mesma versão imutável; não há
-- caminho alternativo que grave uma data no programa-base.
create or replace function public.create_training_program_delivery(
  p_product_id uuid,
  p_team_id uuid default null,
  p_athlete_id uuid default null,
  p_start_date date default current_date
)
returns public.training_program_deliveries
language plpgsql security definer set search_path = public
as $$
declare product_row public.store_products%rowtype; version_row public.store_program_versions%rowtype; delivery_row public.training_program_deliveries%rowtype; target_team_id uuid := p_team_id;
begin
  select * into product_row from public.store_products where id = p_product_id and status = 'published';
  if product_row.id is null or (product_row.seller_coach_id <> auth.uid() and not public.is_platform_owner()) then raise exception using message = 'Produto publicado não encontrado ou não autorizado.'; end if;
  select * into version_row from public.store_program_versions where product_id = p_product_id order by version_number desc limit 1;
  if version_row.id is null then raise exception using message = 'Programa sem versão publicada.'; end if;
  if p_team_id is not null and not public.is_team_coach(p_team_id) and not public.is_platform_owner() then raise exception using message = 'Somente o coach da equipe pode criar uma entrega.'; end if;
  if p_athlete_id is not null and p_team_id is not null and not exists (select 1 from public.team_members where team_id = p_team_id and user_id = p_athlete_id and role = 'athlete') then raise exception using message = 'O atleta não pertence à equipe selecionada.'; end if;
  if p_team_id is null and p_athlete_id is not null and not exists (
    select 1 from public.team_members athlete_member join public.team_members coach_member on coach_member.team_id = athlete_member.team_id and coach_member.user_id = auth.uid() and coach_member.role = 'coach'
    where athlete_member.user_id = p_athlete_id and athlete_member.role = 'athlete'
  ) and not public.is_platform_owner() then raise exception using message = 'O atleta não está vinculado a uma equipe autorizada deste coach.'; end if;
  if p_team_id is null and p_athlete_id is null then raise exception using message = 'Selecione uma equipe ou atleta para a entrega.'; end if;
  if target_team_id is null then
    insert into public.teams (name, description, level, objective, created_by) values (left('Programa privado · ' || product_row.title, 120), 'Equipe privada criada para uma entrega individual.', 'iniciante', 'Entrega individual de programa', auth.uid()) returning id into target_team_id;
    insert into public.team_members (team_id, user_id, role) values (target_team_id, p_athlete_id, 'athlete') on conflict (team_id, user_id) do nothing;
  end if;
  insert into public.training_program_deliveries (product_id, version_id, coach_id, team_id, athlete_id, start_date, created_by)
  values (p_product_id, version_row.id, product_row.seller_coach_id, target_team_id, p_athlete_id, coalesce(p_start_date, current_date), auth.uid()) returning * into delivery_row;
  perform public.populate_program_delivery_sessions(delivery_row.id);
  return delivery_row;
end;
$$;

create or replace function public.settle_store_order(p_provider_payment_id text, p_amount_cents integer, p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path = public
as $$
declare intent_row public.store_payment_intents%rowtype; order_row public.store_orders%rowtype; item_row public.store_order_items%rowtype; product_row public.store_products%rowtype; version_id uuid; access_id uuid;
begin
  select * into intent_row from public.store_payment_intents where provider = 'mercado_pago' and provider_payment_id = p_provider_payment_id for update;
  if intent_row.id is null or intent_row.amount_cents <> p_amount_cents then raise exception using message = 'Intenção de compra inválida.'; end if;
  select * into order_row from public.store_orders where id = intent_row.order_id for update;
  if order_row.id is null or order_row.status = 'cancelled' then raise exception using message = 'Pedido não encontrado ou cancelado.'; end if;
  if order_row.status = 'paid' then return order_row.id; end if;
  select * into item_row from public.store_order_items where order_id = order_row.id limit 1;
  select * into product_row from public.store_products where id = item_row.product_id;
  select id into version_id from public.store_program_versions where product_id = product_row.id order by version_number desc limit 1;
  if version_id is null then raise exception using message = 'Programa publicado sem versão imutável.'; end if;
  update public.store_payment_intents set status = 'approved' where id = intent_row.id;
  update public.store_orders set status = 'paid', provider_payment_id = p_provider_payment_id, paid_at = coalesce(p_paid_at, now()) where id = order_row.id;
  insert into public.training_program_access (user_id, product_id, order_id, version_id) values (order_row.buyer_id, item_row.product_id, order_row.id, version_id)
  on conflict (user_id, product_id) do update set order_id = excluded.order_id, version_id = excluded.version_id, revoked_at = null returning id into access_id;
  if not exists (select 1 from public.training_program_access where id = access_id and delivery_id is not null) then
    update public.training_program_access set delivery_id = public.grant_store_program_delivery(product_row.id, version_id, order_row.buyer_id, product_row.seller_coach_id, order_row.program_start_date) where id = access_id and delivery_id is null;
  end if;
  return order_row.id;
end;
$$;

create or replace function public.list_my_training_programs()
returns table (access_id uuid, product_id uuid, order_id uuid, title text, seller_coach_id uuid, seller_display_name text, duration_weeks integer, granted_at timestamptz, sessions jsonb)
language sql stable security definer set search_path = public
as $$
  select access_row.id, access_row.product_id, access_row.order_id,
    coalesce(version_row.snapshot->'product'->>'title', product_row.title), product_row.seller_coach_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))),
    coalesce(
      (
        select max(nullif(snapshot_item.value->>'week_number', '')::integer)
        from jsonb_array_elements(coalesce(version_row.snapshot->'sessions', '[]'::jsonb)) snapshot_item(value)
      ),
      nullif(version_row.snapshot->'product'->>'duration_weeks', '')::integer,
      1
    ), access_row.granted_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', ds.id, 'week_number', ds.week_number, 'day_number', ds.day_number, 'day_type', ds.day_type, 'scheduled_date', ds.scheduled_date, 'title', ds.title, 'session_instance_id', ds.session_instance_id) order by ds.week_number, ds.day_number) from public.training_program_delivery_sessions ds where ds.delivery_id = access_row.delivery_id), '[]'::jsonb)
  from public.training_program_access access_row
  join public.store_products product_row on product_row.id = access_row.product_id
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  left join public.store_program_versions version_row on version_row.id = access_row.version_id
  where access_row.user_id = auth.uid() and access_row.revoked_at is null;
$$;

revoke all on function public.get_coach_store_product_schedule(uuid) from public;
revoke all on function public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) from public;
revoke all on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) from public;
grant execute on function public.get_coach_store_product_schedule(uuid) to authenticated;
grant execute on function public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) to authenticated;
grant execute on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Correções de entrega: versão congelada no pedido, legado W×7 e agenda real.
-- ---------------------------------------------------------------------------

-- A versão comercial é escolhida uma única vez, quando o PIX é iniciado. A
-- coluna permanece nullable para pedidos físicos/legados, mas todo checkout de
-- programa novo a preenche e o settlement exige a associação produto-versão.
alter table public.store_orders
  add column if not exists program_version_id uuid references public.store_program_versions(id) on delete restrict;

create index if not exists store_orders_program_version_idx
  on public.store_orders(program_version_id)
  where program_version_id is not null;

-- Para pedidos já pagos, a fonte de verdade é o acesso/delivery existente. Para
-- pendentes criados antes desta migration, congela-se a versão então publicada
-- uma única vez; o webhook posterior jamais consulta "a última versão".
update public.store_orders order_row
set program_version_id = access_row.version_id
from public.training_program_access access_row
where order_row.program_version_id is null
  and access_row.order_id = order_row.id
  and access_row.version_id is not null;

update public.store_orders order_row
set program_version_id = version_row.id
from public.store_order_items item_row
join lateral (
  select candidate.id
  from public.store_program_versions candidate
  where candidate.product_id = item_row.product_id
  order by candidate.version_number desc
  limit 1
) version_row on true
where order_row.program_version_id is null
  and item_row.order_id = order_row.id;

-- Completa versões históricas sem substituir snapshots de treino existentes.
-- Cada posição ausente é explicitamente armazenada como "Sem programação".
update public.store_program_versions version_row
set snapshot = jsonb_set(
  jsonb_set(version_row.snapshot, '{schema_version}', '2'::jsonb, true),
  '{sessions}',
  normalized.sessions,
  true
)
from public.store_products product_row,
  -- O alias-alvo do UPDATE não é visível dentro de um JOIN...ON no FROM (42P01)
  -- nem dentro de LATERAL aninhado (42P10); um item separado por vírgula,
  -- correlacionado apenas no WHERE, reexpõe o snapshot atual como range table normal.
  public.store_program_versions source_version,
  lateral (
  select coalesce(jsonb_agg(
    case
      when legacy.item is null then jsonb_build_object(
        'week_number', generated_week.week_number,
        'day_number', generated_day.day_number,
        'day_type', 'unprogrammed',
        'template_id', null,
        'title', 'Sem programação',
        'snapshot', null
      )
      else jsonb_build_object(
        'week_number', generated_week.week_number,
        'day_number', generated_day.day_number,
        'day_type', coalesce(
          legacy.item->>'day_type',
          case when coalesce((legacy.item->>'is_rest_day')::boolean, false) then 'rest' else 'training' end
        ),
        'template_id', coalesce(legacy.item->'template_id', 'null'::jsonb),
        'title', coalesce(
          legacy.item->>'title',
          case when coalesce((legacy.item->>'is_rest_day')::boolean, false) then 'Descanso' else 'Treino' end
        ),
        'snapshot', coalesce(legacy.item->'snapshot', 'null'::jsonb)
      )
    end
    order by generated_week.week_number, generated_day.day_number
  ), '[]'::jsonb) as sessions
  from generate_series(
    1,
    greatest(coalesce(
      (
        select max(nullif(snapshot_item.value->>'week_number', '')::integer)
        from jsonb_array_elements(coalesce(source_version.snapshot->'sessions', '[]'::jsonb)) snapshot_item(value)
      ),
      nullif(source_version.snapshot->'product'->>'duration_weeks', '')::integer,
      1
    ), 1)
  ) as generated_week(week_number)
  cross join generate_series(1, 7) as generated_day(day_number)
  left join lateral (
    select legacy_value.value as item
    from jsonb_array_elements(coalesce(source_version.snapshot->'sessions', '[]'::jsonb)) legacy_value(value)
    where (legacy_value.value->>'week_number')::integer = generated_week.week_number
      and (legacy_value.value->>'day_number')::integer = generated_day.day_number
    limit 1
  ) legacy on true
) normalized
where product_row.id = version_row.product_id
  and source_version.id = version_row.id;

-- Entregas já instanciadas recebem a mesma grade W×7 sem reescrever sessões ou
-- snapshots existentes. As datas continuam derivadas exclusivamente da data de
-- início de cada entrega.
insert into public.training_program_delivery_sessions (
  delivery_id, week_number, day_number, scheduled_date, is_rest_day, day_type, title, snapshot
)
select
  delivery_row.id,
  generated_week.week_number,
  generated_day.day_number,
  delivery_row.start_date + ((generated_week.week_number - 1) * 7) + (generated_day.day_number - 1),
  true,
  'unprogrammed',
  'Sem programação',
  null
from public.training_program_deliveries delivery_row
join public.store_program_versions version_row on version_row.id = delivery_row.version_id
cross join lateral generate_series(
  1,
  greatest(coalesce(
    (
      select max(nullif(snapshot_item.value->>'week_number', '')::integer)
      from jsonb_array_elements(coalesce(version_row.snapshot->'sessions', '[]'::jsonb)) snapshot_item(value)
    ),
    nullif(version_row.snapshot->'product'->>'duration_weeks', '')::integer,
    1
  ), 1)
) as generated_week(week_number)
cross join generate_series(1, 7) as generated_day(day_number)
where not exists (
  select 1
  from public.training_program_delivery_sessions existing_row
  where existing_row.delivery_id = delivery_row.id
    and existing_row.week_number = generated_week.week_number
    and existing_row.day_number = generated_day.day_number
);

create or replace function public.grant_store_program_delivery(
  p_product_id uuid,
  p_version_id uuid,
  p_buyer_id uuid,
  p_coach_id uuid,
  p_start_date date default current_date
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare team_id uuid; delivery_id uuid; product_title text;
begin
  select title into product_title from public.store_products where id = p_product_id;
  if product_title is null or not exists (
    select 1 from public.store_program_versions
    where id = p_version_id and product_id = p_product_id
  ) then
    raise exception using message = 'Versão de programa inválida para esta compra.';
  end if;
  insert into public.teams (name, description, level, objective, created_by)
  values (left('Programa · ' || product_title, 120), 'Entrega privada de programa comprado.', 'iniciante', 'Programa comprado', p_coach_id)
  returning id into team_id;
  insert into public.team_members (team_id, user_id, role)
  values (team_id, p_buyer_id, 'athlete') on conflict (team_id, user_id) do nothing;
  insert into public.training_program_deliveries (product_id, version_id, coach_id, team_id, athlete_id, start_date, created_by)
  values (p_product_id, p_version_id, p_coach_id, team_id, p_buyer_id, p_start_date, p_coach_id)
  returning id into delivery_id;
  perform public.populate_program_delivery_sessions(delivery_id);
  return delivery_id;
end;
$$;

create or replace function public.settle_store_order(
  p_provider_payment_id text,
  p_amount_cents integer,
  p_paid_at timestamptz
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  intent_row public.store_payment_intents%rowtype;
  order_row public.store_orders%rowtype;
  item_row public.store_order_items%rowtype;
  product_row public.store_products%rowtype;
  version_row public.store_program_versions%rowtype;
  access_id uuid;
begin
  select * into intent_row
  from public.store_payment_intents
  where provider = 'mercado_pago' and provider_payment_id = p_provider_payment_id
  for update;
  if intent_row.id is null or intent_row.amount_cents <> p_amount_cents then
    raise exception using message = 'Intenção de compra inválida.';
  end if;

  select * into order_row from public.store_orders where id = intent_row.order_id for update;
  if order_row.id is null or order_row.status = 'cancelled' then
    raise exception using message = 'Pedido não encontrado ou cancelado.';
  end if;
  if order_row.status = 'paid' then return order_row.id; end if;

  select * into item_row from public.store_order_items where order_id = order_row.id limit 1;
  if item_row.id is null or order_row.program_version_id is null then
    raise exception using message = 'Pedido sem versão de programa congelada.';
  end if;
  select * into product_row from public.store_products where id = item_row.product_id;
  select * into version_row
  from public.store_program_versions
  where id = order_row.program_version_id
    and product_id = item_row.product_id;
  if product_row.id is null or version_row.id is null then
    raise exception using message = 'Versão congelada não pertence ao produto do pedido.';
  end if;

  update public.store_payment_intents set status = 'approved' where id = intent_row.id;
  update public.store_orders
  set status = 'paid', provider_payment_id = p_provider_payment_id, paid_at = coalesce(p_paid_at, now())
  where id = order_row.id;

  insert into public.training_program_access (user_id, product_id, order_id, version_id)
  values (order_row.buyer_id, item_row.product_id, order_row.id, version_row.id)
  on conflict (user_id, product_id) do update
  set
    order_id = case when public.training_program_access.delivery_id is null then excluded.order_id else public.training_program_access.order_id end,
    version_id = case when public.training_program_access.delivery_id is null then excluded.version_id else public.training_program_access.version_id end,
    revoked_at = null
  returning id into access_id;

  if not exists (
    select 1 from public.training_program_access
    where id = access_id and delivery_id is not null
  ) then
    update public.training_program_access
    set delivery_id = public.grant_store_program_delivery(
      product_row.id,
      version_row.id,
      order_row.buyer_id,
      product_row.seller_coach_id,
      order_row.program_start_date
    )
    where id = access_id and delivery_id is null;
  end if;
  return order_row.id;
end;
$$;

-- A agenda do atleta combina sessões treináveis com os outros quatro tipos de
-- dia da instância. O catálogo/modelo-base não participa desta leitura.
create or replace function public.list_athlete_calendar_entries(
  p_from date,
  p_to date
)
returns table (
  id uuid,
  entry_type text,
  template_id uuid,
  team_id uuid,
  scheduled_date date,
  status public.session_status,
  state public.session_instance_state,
  snapshot jsonb,
  coach_note text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  day_type text,
  title text,
  session_instance_id uuid
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using message = 'Informe um intervalo de calendário válido.';
  end if;

  return query
  select
    instance_row.id,
    'session'::text,
    instance_row.template_id,
    instance_row.team_id,
    instance_row.scheduled_date,
    instance_row.status,
    instance_row.state,
    instance_row.snapshot,
    instance_row.coach_note,
    instance_row.created_by,
    instance_row.created_at,
    instance_row.updated_at,
    'training'::text,
    coalesce(instance_row.snapshot->>'title', 'Sessão FitBlock'),
    instance_row.id
  from public.list_athlete_calendar(p_from, p_to) instance_row

  union all

  select
    delivery_session_row.id,
    'program_day'::text,
    null::uuid,
    delivery_row.team_id,
    delivery_session_row.scheduled_date,
    null::public.session_status,
    null::public.session_instance_state,
    null::jsonb,
    ''::text,
    delivery_row.created_by,
    delivery_session_row.created_at,
    delivery_session_row.created_at,
    delivery_session_row.day_type,
    delivery_session_row.title,
    null::uuid
  from public.training_program_delivery_sessions delivery_session_row
  join public.training_program_deliveries delivery_row on delivery_row.id = delivery_session_row.delivery_id
  where delivery_session_row.day_type <> 'training'
    and delivery_row.status = 'active'
    and delivery_session_row.scheduled_date between p_from and p_to
    and (
      delivery_row.athlete_id = auth.uid()
      or exists (
        select 1 from public.team_members member_row
        where member_row.team_id = delivery_row.team_id
          and member_row.user_id = auth.uid()
          and member_row.role = 'athlete'
      )
    )
  order by 5, 2, 1;
end;
$$;

-- O owner recebe todos os dados comerciais e a grade pelo RPC já protegido de
-- schedule, antes de aprovar ou devolver o produto para rascunho.
drop function if exists public.list_store_products_for_review();
create function public.list_store_products_for_review()
returns table (
  id uuid,
  seller_coach_id uuid,
  seller_display_name text,
  title text,
  slug text,
  description text,
  short_description text,
  price_cents integer,
  category public.store_product_category,
  objective text,
  level public.store_product_level,
  duration_weeks integer,
  status public.store_product_status,
  updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    product_row.id,
    product_row.seller_coach_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))),
    product_row.title,
    product_row.slug,
    product_row.description,
    product_row.short_description,
    product_row.price_cents,
    product_row.category,
    product_row.objective,
    product_row.level,
    product_row.duration_weeks,
    product_row.status,
    product_row.updated_at
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where public.is_platform_owner()
    and product_row.status = 'review'
  order by product_row.updated_at asc;
$$;

revoke all on function public.grant_store_program_delivery(uuid, uuid, uuid, uuid, date) from public;
revoke all on function public.settle_store_order(text, integer, timestamptz) from public;
revoke all on function public.list_athlete_calendar_entries(date, date) from public;
revoke all on function public.list_store_products_for_review() from public;
grant execute on function public.list_athlete_calendar_entries(date, date) to authenticated;
grant execute on function public.list_store_products_for_review() to authenticated;
grant execute on function public.settle_store_order(text, integer, timestamptz) to service_role;

comment on column public.store_orders.program_version_id is
  'Versão imutável capturada na abertura do checkout PIX; o settlement não seleciona a versão atual do catálogo.';
comment on function public.list_athlete_calendar_entries(date, date) is
  'Agenda do atleta: sessões treináveis e dias não executáveis de entregas datadas e autorizadas.';

notify pgrst, 'reload schema';
