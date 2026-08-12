-- Prescrição v2: resultados ranqueados por bloco, preservando snapshots congelados.
-- O conteúdo tipado é gravado pelas RPCs existentes em session_blocks.details,
-- block_items, prescriptions e prescription_sets. Esta migration adiciona apenas
-- a projeção mutável de score da execução do atleta.

create table if not exists public.athlete_block_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.session_instances(id) on delete cascade,
  athlete_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  block_id uuid not null,
  score_type text not null check (score_type in ('time', 'rounds-reps', 'reps', 'load')),
  time_seconds numeric(10, 2) check (time_seconds is null or time_seconds >= 0),
  rounds integer check (rounds is null or rounds >= 0),
  reps numeric(10, 2) check (reps is null or reps >= 0),
  load_kg numeric(10, 2) check (load_kg is null or load_kg >= 0),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, block_id, athlete_id)
);

create index if not exists athlete_block_scores_leaderboard_idx
  on public.athlete_block_scores (session_id, block_id, submitted_at);

drop trigger if exists athlete_block_scores_set_updated_at on public.athlete_block_scores;
create trigger athlete_block_scores_set_updated_at
before update on public.athlete_block_scores
for each row execute procedure public.set_updated_at();

comment on table public.athlete_block_scores is
  'Score do atleta em um bloco ranqueado. block_id aponta para o snapshot congelado e não possui FK interna.';

alter table public.athlete_block_scores enable row level security;

drop policy if exists "athletes manage own block scores" on public.athlete_block_scores;
create policy "athletes manage own block scores"
on public.athlete_block_scores for all to authenticated
using (
  athlete_id = auth.uid()
  and exists (
    select 1
    from public.session_instances instance_row
    where instance_row.id = session_id
      and instance_row.status = 'published'
      and public.is_team_member(instance_row.team_id)
  )
)
with check (
  athlete_id = auth.uid()
  and exists (
    select 1
    from public.session_instances instance_row
    where instance_row.id = session_id
      and instance_row.status = 'published'
      and public.is_team_member(instance_row.team_id)
  )
);

drop policy if exists "team members read block scores" on public.athlete_block_scores;
create policy "team members read block scores"
on public.athlete_block_scores for select to authenticated
using (
  exists (
    select 1
    from public.session_instances instance_row
    where instance_row.id = session_id
      and public.is_team_member(instance_row.team_id)
  )
);

create or replace function public.submit_block_score(
  p_session_id uuid,
  p_block_id uuid,
  p_score_type text,
  p_time_seconds numeric default null,
  p_rounds integer default null,
  p_reps numeric default null,
  p_load_kg numeric default null
)
returns public.athlete_block_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.session_instances%rowtype;
  block_json jsonb;
  ranking_json jsonb;
  score_row public.athlete_block_scores%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if p_score_type not in ('time', 'rounds-reps', 'reps', 'load') then
    raise exception using message = 'Métrica de ranking inválida.';
  end if;

  select * into session_row
  from public.session_instances
  where id = p_session_id;

  if session_row.id is null or session_row.status <> 'published' or not public.is_team_member(session_row.team_id) then
    raise exception using message = 'Sessão não encontrada ou não publicada para esta equipe.';
  end if;

  select element.block_value into block_json
  from jsonb_array_elements(coalesce(session_row.snapshot->'blocks', '[]'::jsonb)) as element(block_value)
  where element.block_value->>'id' = p_block_id::text;

  if block_json is null then
    raise exception using message = 'Bloco não encontrado no snapshot da sessão.';
  end if;

  ranking_json := block_json->'details'->'ranking';
  if coalesce(ranking_json->>'enabled', 'false') <> 'true' then
    raise exception using message = 'Este bloco não possui ranking habilitado.';
  end if;

  if ranking_json->>'score_type' <> p_score_type then
    raise exception using message = 'A métrica enviada não corresponde ao ranking do bloco.';
  end if;

  if p_score_type = 'time' and p_time_seconds is null then
    raise exception using message = 'Informe o tempo do bloco.';
  elsif p_score_type = 'rounds-reps' and (p_rounds is null or p_reps is null) then
    raise exception using message = 'Informe rounds e repetições do bloco.';
  elsif p_score_type = 'reps' and p_reps is null then
    raise exception using message = 'Informe as repetições do bloco.';
  elsif p_score_type = 'load' and p_load_kg is null then
    raise exception using message = 'Informe a carga do bloco.';
  end if;

  if coalesce(p_time_seconds, 0) < 0 or coalesce(p_rounds, 0) < 0 or coalesce(p_reps, 0) < 0 or coalesce(p_load_kg, 0) < 0 then
    raise exception using message = 'O score não pode ser negativo.';
  end if;

  insert into public.athlete_block_scores (
    session_id, athlete_id, block_id, score_type,
    time_seconds, rounds, reps, load_kg, submitted_at
  ) values (
    p_session_id, auth.uid(), p_block_id, p_score_type,
    case when p_score_type = 'time' then p_time_seconds else null end,
    case when p_score_type = 'rounds-reps' then p_rounds else null end,
    case when p_score_type in ('rounds-reps', 'reps') then p_reps else null end,
    case when p_score_type = 'load' then p_load_kg else null end,
    now()
  )
  on conflict (session_id, block_id, athlete_id) do update set
    score_type = excluded.score_type,
    time_seconds = excluded.time_seconds,
    rounds = excluded.rounds,
    reps = excluded.reps,
    load_kg = excluded.load_kg,
    submitted_at = now()
  returning * into score_row;

  return score_row;
end;
$$;

create or replace function public.list_block_leaderboard(
  p_session_id uuid,
  p_block_id uuid
)
returns table (
  rank integer,
  id uuid,
  session_id uuid,
  block_id uuid,
  athlete_id uuid,
  display_name text,
  score_type text,
  time_seconds numeric,
  rounds integer,
  reps numeric,
  load_kg numeric,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.session_instances%rowtype;
  block_json jsonb;
  ranking_type text;
begin
  select * into session_row
  from public.session_instances
  where id = p_session_id;

  if session_row.id is null or not public.is_team_member(session_row.team_id) then
    raise exception using message = 'Sessão não encontrada ou não autorizada.';
  end if;

  select element.block_value into block_json
  from jsonb_array_elements(coalesce(session_row.snapshot->'blocks', '[]'::jsonb)) as element(block_value)
  where element.block_value->>'id' = p_block_id::text;

  ranking_type := block_json->'details'->'ranking'->>'score_type';
  if block_json is null or coalesce(block_json->'details'->'ranking'->>'enabled', 'false') <> 'true' then
    raise exception using message = 'Este bloco não possui ranking habilitado.';
  end if;

  return query
  with ranked as (
    select
      score_row.*,
      dense_rank() over (
        order by
          case when ranking_type = 'time' then score_row.time_seconds end asc nulls last,
          case when ranking_type = 'rounds-reps' then score_row.rounds end desc nulls last,
          case when ranking_type = 'rounds-reps' then score_row.reps end desc nulls last,
          case when ranking_type = 'reps' then score_row.reps end desc nulls last,
          case when ranking_type = 'load' then score_row.load_kg end desc nulls last
      )::integer as position,
      coalesce(profile_row.display_name, 'Atleta') as resolved_name
    from public.athlete_block_scores score_row
    left join public.profiles profile_row on profile_row.user_id = score_row.athlete_id
    where score_row.session_id = p_session_id
      and score_row.block_id = p_block_id
      and score_row.score_type = ranking_type
  )
  select
    ranked.position,
    ranked.id,
    ranked.session_id,
    ranked.block_id,
    ranked.athlete_id,
    ranked.resolved_name,
    ranked.score_type,
    ranked.time_seconds,
    ranked.rounds,
    ranked.reps,
    ranked.load_kg,
    ranked.submitted_at
  from ranked
  order by ranked.position, ranked.submitted_at asc;
end;
$$;

revoke all on function public.submit_block_score(uuid, uuid, text, numeric, integer, numeric, numeric) from public;
revoke all on function public.list_block_leaderboard(uuid, uuid) from public;
grant execute on function public.submit_block_score(uuid, uuid, text, numeric, integer, numeric, numeric) to authenticated;
grant execute on function public.list_block_leaderboard(uuid, uuid) to authenticated;
