-- Desfaz a correção de ambiguidade de list_block_leaderboard, voltando à definição de
-- 20260810100000_coach_prescription_v2 (com o `where id = p_session_id` não qualificado).

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

revoke all on function public.list_block_leaderboard(uuid, uuid) from public;
grant execute on function public.list_block_leaderboard(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
