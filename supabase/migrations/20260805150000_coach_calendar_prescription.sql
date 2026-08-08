-- Operação transacional para prescrever e publicar uma sessão no calendário do coach.

create or replace function public.list_coach_teams()
returns setof public.teams
language sql
stable
security invoker
set search_path = public
as $$
  select team_row.*
  from public.teams team_row
  where public.is_team_coach(team_row.id)
  order by team_row.name;
$$;

create or replace function public.list_coach_calendar(
  p_from date,
  p_to date
)
returns setof public.session_instances
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_from is null or p_to is null then
    raise exception using message = 'O intervalo do calendário é obrigatório.';
  end if;

  if p_to < p_from then
    raise exception using message = 'A data final não pode ser anterior à data inicial.';
  end if;

  return query
    select instance_row.*
    from public.session_instances instance_row
    where instance_row.scheduled_date between p_from and p_to
      and public.is_team_coach(instance_row.team_id)
    order by instance_row.scheduled_date, instance_row.created_at;
end;
$$;

create or replace function public.create_and_apply_session_to_team(
  p_title text,
  p_blocks jsonb,
  p_team_id uuid,
  p_scheduled_date date,
  p_status public.session_status default 'published'
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
    p_status
  );

  return instance_row;
end;
$$;

revoke all on function public.list_coach_teams() from public;
grant execute on function public.list_coach_teams() to authenticated;

revoke all on function public.list_coach_calendar(date, date) from public;
grant execute on function public.list_coach_calendar(date, date) to authenticated;

revoke all on function public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status) from public;
grant execute on function public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status) to authenticated;

comment on function public.list_coach_teams() is
  'Lista as equipes nas quais o usuário autenticado possui papel de coach.';

comment on function public.list_coach_calendar(date, date) is
  'Lista sessões de equipes administradas pelo coach, incluindo rascunhos e publicadas.';

comment on function public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status) is
  'Cria template, conteúdo e instância de calendário em uma operação transacional autorizada para o coach da equipe.';

