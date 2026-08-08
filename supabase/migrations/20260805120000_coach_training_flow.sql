create extension if not exists pgcrypto;

create type public.training_group_level as enum ('iniciante', 'intermediário', 'avançado');
create type public.team_member_role as enum ('coach', 'athlete');
create type public.session_status as enum ('draft', 'published');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) >= 2),
  description text not null default '',
  level public.training_group_level not null,
  objective text not null check (char_length(btrim(objective)) >= 2),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.team_member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(btrim(slug)) >= 2),
  name text not null check (char_length(btrim(name)) >= 2),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) >= 2),
  status public.session_status not null default 'draft',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.session_templates(id) on delete cascade,
  name text not null check (char_length(btrim(name)) >= 2),
  kind text not null check (kind in ('warm-up', 'strength', 'conditioning', 'cooldown', 'custom')),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, position)
);

create table public.block_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.session_blocks(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (block_id, position)
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  block_item_id uuid not null unique references public.block_items(id) on delete cascade,
  kind text not null check (kind in ('sets-reps', 'timed', 'amrap', 'emom', 'for-time', 'intervals', 'qualitative')),
  rest_seconds integer check (rest_seconds is null or rest_seconds >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  minutes numeric(8, 2) check (minutes is null or minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prescription_sets (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  reps integer check (reps is null or reps > 0),
  reps_min integer check (reps_min is null or reps_min > 0),
  reps_max integer check (reps_max is null or reps_max >= reps_min),
  load_type text check (load_type is null or load_type in ('fixed', 'percentage-1rm')),
  load_value numeric(8, 2) check (load_value is null or load_value >= 0),
  effort_type text check (effort_type is null or effort_type in ('rpe', 'rir')),
  effort_value numeric(4, 2) check (effort_value is null or effort_value >= 0),
  distance_meters numeric(10, 2) check (distance_meters is null or distance_meters > 0),
  pace_seconds_per_km integer check (pace_seconds_per_km is null or pace_seconds_per_km > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prescription_id, set_number)
);

create table public.session_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.session_templates(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete cascade,
  scheduled_date date not null,
  status public.session_status not null default 'draft',
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_members_user_id_idx on public.team_members(user_id);
create index session_blocks_template_id_idx on public.session_blocks(template_id, position);
create index block_items_block_id_idx on public.block_items(block_id, position);
create index session_instances_team_date_idx on public.session_instances(team_id, scheduled_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_set_updated_at
before update on public.teams
for each row execute procedure public.set_updated_at();

create trigger session_templates_set_updated_at
before update on public.session_templates
for each row execute procedure public.set_updated_at();

create trigger team_members_set_updated_at
before update on public.team_members
for each row execute procedure public.set_updated_at();

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute procedure public.set_updated_at();

create trigger session_blocks_set_updated_at
before update on public.session_blocks
for each row execute procedure public.set_updated_at();

create trigger block_items_set_updated_at
before update on public.block_items
for each row execute procedure public.set_updated_at();

create trigger prescriptions_set_updated_at
before update on public.prescriptions
for each row execute procedure public.set_updated_at();

create trigger prescription_sets_set_updated_at
before update on public.prescription_sets
for each row execute procedure public.set_updated_at();

create trigger session_instances_set_updated_at
before update on public.session_instances
for each row execute procedure public.set_updated_at();

create or replace function public.add_team_creator_as_coach()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.created_by, 'coach')
  on conflict (team_id, user_id) do nothing;
  return new;
end;
$$;

create trigger teams_add_creator_as_coach
after insert on public.teams
for each row execute procedure public.add_team_creator_as_coach();

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_coach(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role = 'coach'
  );
$$;

create or replace function public.owns_session_template(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_templates
    where id = p_template_id
      and created_by = auth.uid()
  );
$$;

create or replace function public.create_session_template_with_content(
  p_title text,
  p_blocks jsonb,
  p_status public.session_status default 'draft'
)
returns public.session_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
  block_row public.session_blocks%rowtype;
  item_row public.block_items%rowtype;
  prescription_row public.prescriptions%rowtype;
  block_json jsonb;
  item_json jsonb;
  prescription_json jsonb;
  set_json jsonb;
  exercise_id uuid;
  block_position integer;
  item_position integer;
  set_number integer;
  exercise_slug text;
  exercise_name text;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if char_length(btrim(p_title)) < 2 then
    raise exception using message = 'O título da sessão é obrigatório.';
  end if;

  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) = 0 then
    raise exception using message = 'A sessão precisa ter pelo menos um bloco.';
  end if;

  insert into public.session_templates (title, status, created_by)
  values (btrim(p_title), p_status, auth.uid())
  returning * into template_row;

  for block_json, block_position in
    select value, (ordinality - 1)::integer
    from jsonb_array_elements(p_blocks) with ordinality
  loop
    insert into public.session_blocks (template_id, name, kind, position)
    values (
      template_row.id,
      btrim(block_json->>'name'),
      block_json->>'kind',
      block_position
    )
    returning * into block_row;

    if jsonb_typeof(block_json->'items') <> 'array' or jsonb_array_length(block_json->'items') = 0 then
      raise exception using message = 'Cada bloco precisa ter pelo menos um exercício.';
    end if;

    for item_json, item_position in
      select value, (ordinality - 1)::integer
      from jsonb_array_elements(block_json->'items') with ordinality
    loop
      exercise_slug := btrim(item_json->>'exercise_slug');
      exercise_name := btrim(item_json->>'exercise_name');

      if char_length(exercise_slug) < 2 or char_length(exercise_name) < 2 then
        raise exception using message = 'Cada exercício precisa de slug e nome.';
      end if;

      select id into exercise_id
      from public.exercises
      where slug = exercise_slug;

      if exercise_id is null then
        insert into public.exercises (slug, name, created_by)
        values (exercise_slug, exercise_name, auth.uid())
        on conflict (slug) do nothing;

        select id into exercise_id
        from public.exercises
        where slug = exercise_slug;
      end if;

      insert into public.block_items (block_id, exercise_id, position)
      values (block_row.id, exercise_id, item_position)
      returning * into item_row;

      prescription_json := item_json->'prescription';

      if jsonb_typeof(prescription_json) <> 'object' then
        raise exception using message = 'Cada exercício precisa de uma prescrição.';
      end if;

      insert into public.prescriptions (
        block_item_id,
        kind,
        rest_seconds,
        duration_seconds,
        minutes,
        notes
      )
      values (
        item_row.id,
        prescription_json->>'kind',
        nullif(prescription_json->>'rest_seconds', '')::integer,
        nullif(prescription_json->>'duration_seconds', '')::integer,
        nullif(prescription_json->>'minutes', '')::numeric,
        prescription_json->>'notes'
      )
      returning * into prescription_row;

      for set_json, set_number in
        select value, ordinality::integer
        from jsonb_array_elements(coalesce(prescription_json->'sets', '[]'::jsonb)) with ordinality
      loop
        insert into public.prescription_sets (
          prescription_id,
          set_number,
          reps,
          reps_min,
          reps_max,
          load_type,
          load_value,
          effort_type,
          effort_value,
          distance_meters,
          pace_seconds_per_km,
          duration_seconds
        )
        values (
          prescription_row.id,
          set_number,
          case when jsonb_typeof(set_json->'reps') = 'number' then (set_json->>'reps')::integer end,
          nullif(set_json->>'reps_min', '')::integer,
          nullif(set_json->>'reps_max', '')::integer,
          set_json->>'load_type',
          nullif(set_json->>'load_value', '')::numeric,
          set_json->>'effort_type',
          nullif(set_json->>'effort_value', '')::numeric,
          nullif(set_json->>'distance_meters', '')::numeric,
          nullif(set_json->>'pace_seconds_per_km', '')::integer,
          nullif(set_json->>'duration_seconds', '')::integer
        );
      end loop;
    end loop;
  end loop;

  return template_row;
end;
$$;

create or replace function public.apply_session_template_to_team(
  p_template_id uuid,
  p_team_id uuid,
  p_scheduled_date date,
  p_status public.session_status default 'draft'
)
returns public.session_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
  instance_row public.session_instances%rowtype;
  template_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente coaches da equipe podem aplicar sessões.';
  end if;

  if not exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and role = 'athlete'
  ) then
    raise exception using message = 'A equipe precisa ter pelo menos um atleta.';
  end if;

  select * into template_row
  from public.session_templates
  where id = p_template_id
    and created_by = auth.uid();

  if template_row.id is null then
    raise exception using message = 'Template de sessão não encontrado ou não autorizado.';
  end if;

  select jsonb_build_object(
    'template_id', template_row.id,
    'title', template_row.title,
    'blocks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', block_row.id,
            'name', block_row.name,
            'kind', block_row.kind,
            'position', block_row.position,
            'items', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', item_row.id,
                    'exercise_id', item_row.exercise_id,
                    'exercise_name', exercise_row.name,
                    'position', item_row.position,
                    'prescription', (
                      select jsonb_build_object(
                        'id', prescription_row.id,
                        'kind', prescription_row.kind,
                        'rest_seconds', prescription_row.rest_seconds,
                        'duration_seconds', prescription_row.duration_seconds,
                        'minutes', prescription_row.minutes,
                        'notes', prescription_row.notes,
                        'sets', coalesce(
                          (
                            select jsonb_agg(to_jsonb(set_row) - 'prescription_id' order by set_row.set_number)
                            from public.prescription_sets set_row
                            where set_row.prescription_id = prescription_row.id
                          ),
                          '[]'::jsonb
                        )
                      )
                      from public.prescriptions prescription_row
                      where prescription_row.block_item_id = item_row.id
                    )
                  )
                  order by item_row.position
                )
                from public.block_items item_row
                join public.exercises exercise_row on exercise_row.id = item_row.exercise_id
                where item_row.block_id = block_row.id
              ),
              '[]'::jsonb
            )
          )
          order by block_row.position
        )
        from public.session_blocks block_row
        where block_row.template_id = template_row.id
      ),
      '[]'::jsonb
    )
  ) into template_snapshot;

  insert into public.session_instances (
    template_id,
    team_id,
    scheduled_date,
    status,
    snapshot,
    created_by
  )
  values (
    template_row.id,
    p_team_id,
    p_scheduled_date,
    p_status,
    template_snapshot,
    auth.uid()
  )
  returning * into instance_row;

  return instance_row;
end;
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.exercises enable row level security;
alter table public.session_templates enable row level security;
alter table public.session_blocks enable row level security;
alter table public.block_items enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_sets enable row level security;
alter table public.session_instances enable row level security;

create policy "team members can read their teams"
on public.teams for select to authenticated
using (public.is_team_member(id));

create policy "authenticated users can create teams"
on public.teams for insert to authenticated
with check (created_by = auth.uid());

create policy "team coaches can update teams"
on public.teams for update to authenticated
using (public.is_team_coach(id))
with check (public.is_team_coach(id));

create policy "team coaches can archive teams"
on public.teams for delete to authenticated
using (public.is_team_coach(id));

create policy "team members can read membership"
on public.team_members for select to authenticated
using (public.is_team_member(team_id));

create policy "team coaches can manage membership"
on public.team_members for insert to authenticated
with check (public.is_team_coach(team_id));

create policy "team coaches can update membership"
on public.team_members for update to authenticated
using (public.is_team_coach(team_id))
with check (public.is_team_coach(team_id));

create policy "team coaches can remove membership"
on public.team_members for delete to authenticated
using (public.is_team_coach(team_id));

create policy "authenticated users can read exercises"
on public.exercises for select to authenticated
using (true);

create policy "authenticated users can create exercises"
on public.exercises for insert to authenticated
with check (created_by = auth.uid());

create policy "coaches can manage owned templates"
on public.session_templates for all to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "coaches can manage owned session blocks"
on public.session_blocks for all to authenticated
using (public.owns_session_template(template_id))
with check (public.owns_session_template(template_id));

create policy "coaches can manage owned block items"
on public.block_items for all to authenticated
using (
  exists (
    select 1
    from public.session_blocks block_row
    where block_row.id = block_id
      and public.owns_session_template(block_row.template_id)
  )
)
with check (
  exists (
    select 1
    from public.session_blocks block_row
    where block_row.id = block_id
      and public.owns_session_template(block_row.template_id)
  )
);

create policy "coaches can manage owned prescriptions"
on public.prescriptions for all to authenticated
using (
  exists (
    select 1
    from public.block_items item_row
    join public.session_blocks block_row on block_row.id = item_row.block_id
    where item_row.id = block_item_id
      and public.owns_session_template(block_row.template_id)
  )
)
with check (
  exists (
    select 1
    from public.block_items item_row
    join public.session_blocks block_row on block_row.id = item_row.block_id
    where item_row.id = block_item_id
      and public.owns_session_template(block_row.template_id)
  )
);

create policy "coaches can manage owned prescription sets"
on public.prescription_sets for all to authenticated
using (
  exists (
    select 1
    from public.prescriptions prescription_row
    join public.block_items item_row on item_row.id = prescription_row.block_item_id
    join public.session_blocks block_row on block_row.id = item_row.block_id
    where prescription_row.id = prescription_id
      and public.owns_session_template(block_row.template_id)
  )
)
with check (
  exists (
    select 1
    from public.prescriptions prescription_row
    join public.block_items item_row on item_row.id = prescription_row.block_item_id
    join public.session_blocks block_row on block_row.id = item_row.block_id
    where prescription_row.id = prescription_id
      and public.owns_session_template(block_row.template_id)
  )
);

create policy "team members can read session instances"
on public.session_instances for select to authenticated
using (public.is_team_member(team_id));

create policy "team coaches can create session instances"
on public.session_instances for insert to authenticated
with check (public.is_team_coach(team_id) and created_by = auth.uid());

create policy "team coaches can update session instances"
on public.session_instances for update to authenticated
using (public.is_team_coach(team_id))
with check (public.is_team_coach(team_id));

create policy "team coaches can delete session instances"
on public.session_instances for delete to authenticated
using (public.is_team_coach(team_id));

revoke all on function public.create_session_template_with_content(text, jsonb, public.session_status) from public;
grant execute on function public.create_session_template_with_content(text, jsonb, public.session_status) to authenticated;

revoke all on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status) from public;
grant execute on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status) to authenticated;

revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.is_team_coach(uuid) from public;
revoke all on function public.owns_session_template(uuid) from public;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_coach(uuid) to authenticated;
grant execute on function public.owns_session_template(uuid) to authenticated;
