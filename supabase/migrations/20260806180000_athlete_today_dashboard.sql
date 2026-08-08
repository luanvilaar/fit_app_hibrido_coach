-- Execução do treino pelo atleta: progresso por sessão, resultados de série, check-in diário
-- e nota do coach. Sem estas tabelas a aba Hoje não tem como sair de dados locais:
-- session_instances.state é do time inteiro, não do atleta.

-- 1. Mensagem do coach na instância de calendário (o template é compartilhado entre instâncias).
alter table public.session_instances
  add column if not exists coach_note text not null default '';

comment on column public.session_instances.coach_note is
  'Mensagem do coach para esta sessão, exibida na aba Hoje do atleta.';

-- 2. Progresso da sessão por atleta.
do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'athlete_session_state') then
    create type public.athlete_session_state as enum (
      'started',
      'completed',
      'partially_completed',
      'skipped'
    );
  end if;
end;
$$;

create table if not exists public.athlete_session_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.session_instances(id) on delete cascade,
  athlete_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  state public.athlete_session_state not null default 'started',
  completed_block_ids uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, athlete_id)
);

create index if not exists athlete_session_progress_athlete_idx
  on public.athlete_session_progress (athlete_id, state);

drop trigger if exists athlete_session_progress_set_updated_at on public.athlete_session_progress;
create trigger athlete_session_progress_set_updated_at
before update on public.athlete_session_progress
for each row execute procedure public.set_updated_at();

comment on table public.athlete_session_progress is
  'Execução de uma sessão publicada por um atleta específico; alimenta o resumo semanal e a sequência.';
comment on column public.athlete_session_progress.completed_block_ids is
  'Ids de bloco do snapshot já concluídos; o snapshot é congelado, então não há FK para session_blocks.';

-- 3. Resultado de cada série executada.
-- block_item_id vem do snapshot congelado e não tem FK: o template original pode ser
-- substituído pela edição da sessão, e o histórico do atleta precisa sobreviver a isso.
create table if not exists public.athlete_set_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.session_instances(id) on delete cascade,
  athlete_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  block_item_id uuid not null,
  set_number integer not null check (set_number > 0),
  reps numeric(6, 2) check (reps is null or reps >= 0),
  load_kg numeric(8, 2) check (load_kg is null or load_kg >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, athlete_id, block_item_id, set_number)
);

create index if not exists athlete_set_results_session_idx
  on public.athlete_set_results (session_id, athlete_id);

drop trigger if exists athlete_set_results_set_updated_at on public.athlete_set_results;
create trigger athlete_set_results_set_updated_at
before update on public.athlete_set_results
for each row execute procedure public.set_updated_at();

comment on table public.athlete_set_results is
  'Repetições e carga registradas pelo atleta em cada série prescrita de uma sessão.';

-- 4. Check-in diário que dá origem ao card de prontidão.
-- Escalas 1-5: sono e energia quanto maior melhor; dor muscular é invertida na prontidão.
create table if not exists public.athlete_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  sleep_score smallint not null check (sleep_score between 1 and 5),
  energy_score smallint not null check (energy_score between 1 and 5),
  soreness_score smallint not null check (soreness_score between 1 and 5),
  readiness numeric(3, 2) generated always as (
    round((sleep_score + energy_score + (6 - soreness_score))::numeric / 3, 2)
  ) stored,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, checkin_date)
);

create index if not exists athlete_daily_checkins_athlete_idx
  on public.athlete_daily_checkins (athlete_id, checkin_date desc);

drop trigger if exists athlete_daily_checkins_set_updated_at on public.athlete_daily_checkins;
create trigger athlete_daily_checkins_set_updated_at
before update on public.athlete_daily_checkins
for each row execute procedure public.set_updated_at();

comment on column public.athlete_daily_checkins.soreness_score is
  'Dor muscular de 1 (nenhuma) a 5 (muita); entra invertida no cálculo de prontidão.';
comment on column public.athlete_daily_checkins.readiness is
  'Prontidão de 1 a 5 derivada de sono, energia e dor muscular.';

-- 5. RLS: o atleta gerencia os próprios registros, o coach da equipe apenas lê o progresso.
alter table public.athlete_session_progress enable row level security;
alter table public.athlete_set_results enable row level security;
alter table public.athlete_daily_checkins enable row level security;

drop policy if exists "athletes manage own session progress" on public.athlete_session_progress;
create policy "athletes manage own session progress"
on public.athlete_session_progress for all to authenticated
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

drop policy if exists "team coaches read session progress" on public.athlete_session_progress;
create policy "team coaches read session progress"
on public.athlete_session_progress for select to authenticated
using (
  exists (
    select 1
    from public.session_instances instance_row
    where instance_row.id = session_id
      and public.is_team_coach(instance_row.team_id)
  )
);

drop policy if exists "athletes manage own set results" on public.athlete_set_results;
create policy "athletes manage own set results"
on public.athlete_set_results for all to authenticated
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

drop policy if exists "team coaches read set results" on public.athlete_set_results;
create policy "team coaches read set results"
on public.athlete_set_results for select to authenticated
using (
  exists (
    select 1
    from public.session_instances instance_row
    where instance_row.id = session_id
      and public.is_team_coach(instance_row.team_id)
  )
);

drop policy if exists "athletes manage own checkins" on public.athlete_daily_checkins;
create policy "athletes manage own checkins"
on public.athlete_daily_checkins for all to authenticated
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

-- 6. Snapshot passa a congelar slug e vídeo do movimento, para a tela de execução.
create or replace function public.build_template_snapshot(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
                    'exercise_slug', exercise_row.slug,
                    'exercise_video_url', exercise_row.video_url,
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
  )
  from public.session_templates template_row
  where template_row.id = p_template_id;
$$;

-- Sessões criadas antes desta migration não têm o vídeo no snapshot: resolve pelo catálogo atual.
create or replace function public.enrich_snapshot_media(p_snapshot jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when jsonb_typeof(p_snapshot) <> 'object' or jsonb_typeof(p_snapshot->'blocks') <> 'array' then p_snapshot
    else jsonb_set(
      p_snapshot,
      '{blocks}',
      coalesce(
        (
          select jsonb_agg(
            case
              when jsonb_typeof(block_json->'items') <> 'array' then block_json
              else jsonb_set(
                block_json,
                '{items}',
                coalesce(
                  (
                    select jsonb_agg(
                      item_json || jsonb_build_object(
                        'exercise_video_url',
                        to_jsonb((
                          select exercise_row.video_url
                          from public.exercises exercise_row
                          where exercise_row.id::text = item_json->>'exercise_id'
                        ))
                      )
                      order by item_ordinality
                    )
                    from jsonb_array_elements(block_json->'items') with ordinality as items(item_json, item_ordinality)
                  ),
                  '[]'::jsonb
                )
              )
            end
            order by block_ordinality
          )
          from jsonb_array_elements(p_snapshot->'blocks') with ordinality as blocks(block_json, block_ordinality)
        ),
        '[]'::jsonb
      )
    )
  end;
$$;

comment on function public.enrich_snapshot_media(jsonb) is
  'Completa cada item do snapshot com o vídeo atual do catálogo de exercícios.';

-- 7. RPCs de coach passam a carregar a nota da sessão.
-- As antigas precisam ser removidas: um parâmetro com default tornaria a chamada com 4 argumentos ambígua.
drop function if exists public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status);
drop function if exists public.update_session_instance(uuid, text, jsonb, date, public.session_status);
drop function if exists public.apply_session_template_to_team(uuid, uuid, date, public.session_status);

create or replace function public.apply_session_template_to_team(
  p_template_id uuid,
  p_team_id uuid,
  p_scheduled_date date,
  p_status public.session_status default 'draft',
  p_coach_note text default ''
)
returns public.session_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
  instance_row public.session_instances%rowtype;
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

  insert into public.session_instances (
    template_id,
    team_id,
    scheduled_date,
    status,
    snapshot,
    coach_note,
    created_by
  )
  values (
    template_row.id,
    p_team_id,
    p_scheduled_date,
    p_status,
    public.build_template_snapshot(template_row.id),
    coalesce(btrim(p_coach_note), ''),
    auth.uid()
  )
  returning * into instance_row;

  return instance_row;
end;
$$;

create or replace function public.create_and_apply_session_to_team(
  p_title text,
  p_blocks jsonb,
  p_team_id uuid,
  p_scheduled_date date,
  p_status public.session_status default 'published',
  p_coach_note text default ''
)
returns public.session_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
  instance_row public.session_instances%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente coaches da equipe podem prescrever sessões.';
  end if;

  select * into template_row
  from public.create_session_template_with_content(p_title, p_blocks, p_status);

  select * into instance_row
  from public.apply_session_template_to_team(
    template_row.id,
    p_team_id,
    p_scheduled_date,
    p_status,
    p_coach_note
  );

  return instance_row;
end;
$$;

create or replace function public.update_session_instance(
  p_session_id uuid,
  p_title text,
  p_blocks jsonb,
  p_scheduled_date date default null,
  p_status public.session_status default null,
  p_coach_note text default null
)
returns public.session_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  instance_row public.session_instances%rowtype;
  template_row public.session_templates%rowtype;
  previous_template_id uuid;
  next_status public.session_status;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  select * into instance_row
  from public.session_instances
  where id = p_session_id;

  if instance_row.id is null then
    raise exception using message = 'Sessão não encontrada.';
  end if;

  if not public.is_team_coach(instance_row.team_id) then
    raise exception using message = 'Somente coaches da equipe podem editar sessões.';
  end if;

  previous_template_id := instance_row.template_id;
  next_status := coalesce(p_status, instance_row.status);

  -- Cria um template novo em vez de mutar o anterior: outras instâncias podem referenciá-lo.
  select * into template_row
  from public.create_session_template_with_content(p_title, p_blocks, next_status);

  update public.session_instances
  set template_id = template_row.id,
      scheduled_date = coalesce(p_scheduled_date, instance_row.scheduled_date),
      status = next_status,
      coach_note = coalesce(btrim(p_coach_note), instance_row.coach_note),
      snapshot = public.build_template_snapshot(template_row.id)
  where id = p_session_id
  returning * into instance_row;

  if not exists (
    select 1
    from public.session_instances
    where template_id = previous_template_id
  ) then
    delete from public.session_templates where id = previous_template_id;
  end if;

  -- O snapshot novo tem outros ids de bloco: manter os antigos marcaria blocos inexistentes.
  update public.athlete_session_progress
  set completed_block_ids = '{}'
  where session_id = p_session_id
    and completed_block_ids <> '{}';

  return instance_row;
end;
$$;

-- 8. Execução da sessão pelo atleta.
create or replace function public.start_athlete_session(p_session_id uuid)
returns public.athlete_session_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  progress_row public.athlete_session_progress%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not exists (
    select 1
    from public.session_instances instance_row
    where instance_row.id = p_session_id
      and instance_row.status = 'published'
      and public.is_team_member(instance_row.team_id)
  ) then
    raise exception using message = 'Sessão não encontrada ou não disponível para este atleta.';
  end if;

  insert into public.athlete_session_progress as progress (session_id, athlete_id, state)
  values (p_session_id, auth.uid(), 'started')
  on conflict (session_id, athlete_id) do update
    -- Reabrir uma sessão concluída não pode apagar a conclusão.
    set state = case
      when progress.state in ('completed', 'partially_completed') then progress.state
      else 'started'
    end
  returning * into progress_row;

  return progress_row;
end;
$$;

create or replace function public.complete_athlete_session(
  p_session_id uuid,
  p_state public.athlete_session_state default 'completed'
)
returns public.athlete_session_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  progress_row public.athlete_session_progress%rowtype;
begin
  if p_state not in ('completed', 'partially_completed', 'skipped') then
    raise exception using message = 'Estado de conclusão inválido.';
  end if;

  perform public.start_athlete_session(p_session_id);

  update public.athlete_session_progress
  set state = p_state,
      completed_at = case when p_state = 'skipped' then null else now() end
  where session_id = p_session_id
    and athlete_id = auth.uid()
  returning * into progress_row;

  return progress_row;
end;
$$;

create or replace function public.toggle_athlete_block(
  p_session_id uuid,
  p_block_id uuid
)
returns public.athlete_session_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  progress_row public.athlete_session_progress%rowtype;
begin
  select * into progress_row from public.start_athlete_session(p_session_id);

  update public.athlete_session_progress
  set completed_block_ids = case
    when p_block_id = any (progress_row.completed_block_ids)
      then array_remove(progress_row.completed_block_ids, p_block_id)
    else progress_row.completed_block_ids || p_block_id
  end
  where session_id = p_session_id
    and athlete_id = auth.uid()
  returning * into progress_row;

  return progress_row;
end;
$$;

create or replace function public.save_athlete_set_result(
  p_session_id uuid,
  p_block_item_id uuid,
  p_set_number integer,
  p_reps numeric default null,
  p_load_kg numeric default null,
  p_completed boolean default false
)
returns public.athlete_set_results
language plpgsql
security invoker
set search_path = public
as $$
declare
  result_row public.athlete_set_results%rowtype;
begin
  if p_set_number is null or p_set_number <= 0 then
    raise exception using message = 'Número da série inválido.';
  end if;

  perform public.start_athlete_session(p_session_id);

  insert into public.athlete_set_results (
    session_id,
    athlete_id,
    block_item_id,
    set_number,
    reps,
    load_kg,
    completed
  )
  values (
    p_session_id,
    auth.uid(),
    p_block_item_id,
    p_set_number,
    p_reps,
    p_load_kg,
    coalesce(p_completed, false)
  )
  on conflict (session_id, athlete_id, block_item_id, set_number) do update
    set reps = excluded.reps,
        load_kg = excluded.load_kg,
        completed = excluded.completed
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.upsert_athlete_checkin(
  p_sleep_score smallint,
  p_energy_score smallint,
  p_soreness_score smallint,
  p_note text default '',
  p_checkin_date date default current_date
)
returns public.athlete_daily_checkins
language plpgsql
security invoker
set search_path = public
as $$
declare
  checkin_row public.athlete_daily_checkins%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if p_sleep_score is null or p_energy_score is null or p_soreness_score is null then
    raise exception using message = 'Informe sono, energia e dor muscular.';
  end if;

  insert into public.athlete_daily_checkins (
    athlete_id,
    checkin_date,
    sleep_score,
    energy_score,
    soreness_score,
    note
  )
  values (
    auth.uid(),
    coalesce(p_checkin_date, current_date),
    p_sleep_score,
    p_energy_score,
    p_soreness_score,
    coalesce(btrim(p_note), '')
  )
  on conflict (athlete_id, checkin_date) do update
    set sleep_score = excluded.sleep_score,
        energy_score = excluded.energy_score,
        soreness_score = excluded.soreness_score,
        note = excluded.note
  returning * into checkin_row;

  return checkin_row;
end;
$$;

-- 9. Agregador da aba Hoje: sessão do dia, progresso, semana, sequência, próxima sessão e check-in.
create or replace function public.get_athlete_today(p_reference_date date default current_date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  reference_date date := coalesce(p_reference_date, current_date);
  week_start date := (date_trunc('week', reference_date))::date;
  week_end date := (date_trunc('week', reference_date))::date + 6;
  session_row public.session_instances%rowtype;
  next_row public.session_instances%rowtype;
  progress_row public.athlete_session_progress%rowtype;
  checkin_row public.athlete_daily_checkins%rowtype;
  week_planned integer := 0;
  week_completed integer := 0;
  week_position integer := 0;
  streak_days integer := 0;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  select instance_row.* into session_row
  from public.session_instances instance_row
  where instance_row.status = 'published'
    and instance_row.scheduled_date = reference_date
    and public.is_team_member(instance_row.team_id)
  order by instance_row.created_at
  limit 1;

  select instance_row.* into next_row
  from public.session_instances instance_row
  where instance_row.status = 'published'
    and instance_row.scheduled_date > reference_date
    and public.is_team_member(instance_row.team_id)
  order by instance_row.scheduled_date, instance_row.created_at
  limit 1;

  if session_row.id is not null then
    select * into progress_row
    from public.athlete_session_progress
    where session_id = session_row.id
      and athlete_id = auth.uid();
  end if;

  select * into checkin_row
  from public.athlete_daily_checkins
  where athlete_id = auth.uid()
    and checkin_date = reference_date;

  select
    count(*)::integer,
    count(*) filter (
      where progress.state in ('completed', 'partially_completed')
    )::integer
  into week_planned, week_completed
  from public.session_instances instance_row
  left join public.athlete_session_progress progress
    on progress.session_id = instance_row.id
   and progress.athlete_id = auth.uid()
  where instance_row.status = 'published'
    and instance_row.scheduled_date between week_start and week_end
    and public.is_team_member(instance_row.team_id);

  if session_row.id is not null then
    select count(*)::integer into week_position
    from public.session_instances instance_row
    where instance_row.status = 'published'
      and instance_row.scheduled_date between week_start and reference_date
      and public.is_team_member(instance_row.team_id)
      and (
        instance_row.scheduled_date < reference_date
        or instance_row.created_at <= session_row.created_at
      );
  end if;

  -- Sequência: dias com sessão prescrita, do mais recente para trás, até o primeiro não concluído.
  -- O dia de referência só entra na conta depois de concluído, senão a sequência zeraria toda manhã.
  with day_status as (
    select
      instance_row.scheduled_date as training_day,
      bool_or(progress.state in ('completed', 'partially_completed')) as is_done
    from public.session_instances instance_row
    left join public.athlete_session_progress progress
      on progress.session_id = instance_row.id
     and progress.athlete_id = auth.uid()
    where instance_row.status = 'published'
      and instance_row.scheduled_date <= reference_date
      and public.is_team_member(instance_row.team_id)
    group by instance_row.scheduled_date
  ),
  ranked as (
    select
      is_done,
      row_number() over (order by training_day desc) as day_rank
    from day_status
    where not (training_day = reference_date and not coalesce(is_done, false))
  )
  select coalesce(
    (select min(day_rank) - 1 from ranked where not coalesce(is_done, false)),
    (select count(*) from ranked)
  )::integer
  into streak_days;

  return jsonb_build_object(
    'reference_date', reference_date,
    'session', case
      when session_row.id is null then null
      else to_jsonb(session_row) || jsonb_build_object(
        'snapshot', public.enrich_snapshot_media(session_row.snapshot)
      )
    end,
    'progress', case when progress_row.id is null then null else to_jsonb(progress_row) end,
    'next_session', case when next_row.id is null then null else to_jsonb(next_row) end,
    'week', jsonb_build_object(
      'start', week_start,
      'end', week_end,
      'planned', week_planned,
      'completed', week_completed,
      'position', week_position
    ),
    'streak_days', coalesce(streak_days, 0),
    'checkin', case when checkin_row.id is null then null else to_jsonb(checkin_row) end
  );
end;
$$;

comment on function public.get_athlete_today(date) is
  'Agrega a sessão do dia, progresso do atleta, resumo semanal, sequência, próxima sessão e check-in.';

-- 10. Tela de execução: sessão com mídia resolvida, progresso e resultados já registrados.
create or replace function public.get_athlete_session_workout(p_session_id uuid default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  session_row public.session_instances%rowtype;
  progress_row public.athlete_session_progress%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if p_session_id is null then
    -- Sem id explícito, a execução assume a sessão de hoje.
    select instance_row.* into session_row
    from public.session_instances instance_row
    where instance_row.status = 'published'
      and instance_row.scheduled_date = current_date
      and public.is_team_member(instance_row.team_id)
    order by instance_row.created_at
    limit 1;
  else
    select instance_row.* into session_row
    from public.session_instances instance_row
    where instance_row.id = p_session_id
      and instance_row.status = 'published'
      and public.is_team_member(instance_row.team_id);
  end if;

  if session_row.id is null then
    return jsonb_build_object('session', null, 'progress', null, 'results', '[]'::jsonb);
  end if;

  select * into progress_row
  from public.athlete_session_progress
  where session_id = session_row.id
    and athlete_id = auth.uid();

  return jsonb_build_object(
    'session', to_jsonb(session_row) || jsonb_build_object(
      'snapshot', public.enrich_snapshot_media(session_row.snapshot)
    ),
    'progress', case when progress_row.id is null then null else to_jsonb(progress_row) end,
    'results', coalesce(
      (
        select jsonb_agg(to_jsonb(result_row) order by result_row.set_number)
        from public.athlete_set_results result_row
        where result_row.session_id = session_row.id
          and result_row.athlete_id = auth.uid()
      ),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.get_athlete_session_workout(uuid) is
  'Retorna a sessão publicada para execução, com vídeo do catálogo, progresso e resultados do atleta.';

-- 11. Permissões.
revoke all on function public.enrich_snapshot_media(jsonb) from public;
revoke all on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status, text) from public;
revoke all on function public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status, text) from public;
revoke all on function public.update_session_instance(uuid, text, jsonb, date, public.session_status, text) from public;
revoke all on function public.start_athlete_session(uuid) from public;
revoke all on function public.complete_athlete_session(uuid, public.athlete_session_state) from public;
revoke all on function public.toggle_athlete_block(uuid, uuid) from public;
revoke all on function public.save_athlete_set_result(uuid, uuid, integer, numeric, numeric, boolean) from public;
revoke all on function public.upsert_athlete_checkin(smallint, smallint, smallint, text, date) from public;
revoke all on function public.get_athlete_today(date) from public;
revoke all on function public.get_athlete_session_workout(uuid) from public;

grant execute on function public.enrich_snapshot_media(jsonb) to authenticated;
grant execute on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status, text) to authenticated;
grant execute on function public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status, text) to authenticated;
grant execute on function public.update_session_instance(uuid, text, jsonb, date, public.session_status, text) to authenticated;
grant execute on function public.start_athlete_session(uuid) to authenticated;
grant execute on function public.complete_athlete_session(uuid, public.athlete_session_state) to authenticated;
grant execute on function public.toggle_athlete_block(uuid, uuid) to authenticated;
grant execute on function public.save_athlete_set_result(uuid, uuid, integer, numeric, numeric, boolean) to authenticated;
grant execute on function public.upsert_athlete_checkin(smallint, smallint, smallint, text, date) to authenticated;
grant execute on function public.get_athlete_today(date) to authenticated;
grant execute on function public.get_athlete_session_workout(uuid) to authenticated;
