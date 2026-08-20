-- Reparo forward e idempotente para ambientes em que a migration de acompanhamento
-- foi registrada sem as RPCs visíveis ao PostgREST.

create or replace function public.can_supervise_athlete_in_team(p_athlete_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and p_athlete_id is not null
    and p_team_id is not null
    and exists (
      select 1 from public.team_members athlete_member
      where athlete_member.team_id = p_team_id
        and athlete_member.user_id = p_athlete_id
        and athlete_member.role = 'athlete'
    )
    and (public.is_platform_owner() or exists (
      select 1 from public.team_members coach_member
      where coach_member.team_id = p_team_id
        and coach_member.user_id = auth.uid()
        and coach_member.role = 'coach'
    ));
$$;

create or replace function public.list_coach_supervision_roster()
returns table(athlete_id uuid, display_name text, team_id uuid, team_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception using message = 'Autenticação necessária.'; end if;
  if not public.is_platform_owner() and not public.is_coach() then
    raise exception using message = 'Somente coaches podem acompanhar atletas.';
  end if;

  return query
  select athlete_member.user_id,
         coalesce(nullif(btrim(profile_row.display_name), ''), 'Atleta sem nome'),
         team_row.id,
         team_row.name
  from public.team_members athlete_member
  join public.teams team_row on team_row.id = athlete_member.team_id
  left join public.profiles profile_row on profile_row.user_id = athlete_member.user_id
  where athlete_member.role = 'athlete'
    and (public.is_platform_owner() or exists (
      select 1 from public.team_members coach_member
      where coach_member.team_id = athlete_member.team_id
        and coach_member.user_id = auth.uid()
        and coach_member.role = 'coach'
    ))
  order by 2, 4;
end;
$$;

create or replace function public.list_coach_supervision_sessions(
  p_athlete_id uuid,
  p_from date,
  p_to date
)
returns table(
  id uuid, team_id uuid, team_name text, scheduled_date date, status public.session_status,
  state public.session_instance_state, snapshot jsonb, coach_note text, progress_state public.athlete_session_state,
  completed_block_ids uuid[], updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception using message = 'Autenticação necessária.'; end if;
  if p_athlete_id is null or p_from is null or p_to is null or p_from > p_to then
    raise exception using message = 'Parâmetros de acompanhamento inválidos.';
  end if;
  if not public.is_platform_owner() and not public.is_coach() then
    raise exception using message = 'Somente coaches podem acompanhar atletas.';
  end if;

  return query
  select instance_row.id, instance_row.team_id, team_row.name, instance_row.scheduled_date,
         instance_row.status, instance_row.state,
         public.enrich_snapshot_media(instance_row.snapshot), instance_row.coach_note,
         progress_row.state, progress_row.completed_block_ids, instance_row.updated_at
  from public.session_instances instance_row
  join public.teams team_row on team_row.id = instance_row.team_id
  left join public.athlete_session_progress progress_row
    on progress_row.session_id = instance_row.id and progress_row.athlete_id = p_athlete_id
  where instance_row.status = 'published'
    and instance_row.scheduled_date between p_from and p_to
    and public.can_supervise_athlete_in_team(p_athlete_id, instance_row.team_id)
  order by instance_row.scheduled_date, instance_row.created_at;
end;
$$;

create or replace function public.get_coach_supervision_session(p_athlete_id uuid, p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  session_row public.session_instances%rowtype;
  progress_row public.athlete_session_progress%rowtype;
begin
  if auth.uid() is null then raise exception using message = 'Autenticação necessária.'; end if;
  if p_athlete_id is null or p_session_id is null then
    raise exception using message = 'Sessão ou atleta inválido.';
  end if;
  if not public.is_platform_owner() and not public.is_coach() then
    raise exception using message = 'Somente coaches podem acompanhar atletas.';
  end if;

  select instance_row.* into session_row
  from public.session_instances instance_row
  where instance_row.id = p_session_id
    and instance_row.status = 'published'
    and public.can_supervise_athlete_in_team(p_athlete_id, instance_row.team_id);

  if session_row.id is null then
    raise exception using message = 'Sessão não encontrada ou não autorizada.';
  end if;

  select * into progress_row from public.athlete_session_progress
  where session_id = session_row.id and athlete_id = p_athlete_id;

  return jsonb_build_object(
    'session', to_jsonb(session_row) || jsonb_build_object('snapshot', public.enrich_snapshot_media(session_row.snapshot)),
    'progress', case when progress_row.id is null then null else to_jsonb(progress_row) end,
    'results', coalesce((
      select jsonb_agg(to_jsonb(result_row) order by result_row.set_number)
      from public.athlete_set_results result_row
      where result_row.session_id = session_row.id and result_row.athlete_id = p_athlete_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.can_supervise_athlete_in_team(uuid, uuid) from public;
revoke all on function public.list_coach_supervision_roster() from public;
revoke all on function public.list_coach_supervision_sessions(uuid, date, date) from public;
revoke all on function public.get_coach_supervision_session(uuid, uuid) from public;
grant execute on function public.list_coach_supervision_roster() to authenticated;
grant execute on function public.list_coach_supervision_sessions(uuid, date, date) to authenticated;
grant execute on function public.get_coach_supervision_session(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
