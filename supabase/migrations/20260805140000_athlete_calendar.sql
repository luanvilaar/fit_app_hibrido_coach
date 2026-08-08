do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'session_instance_state') then
    create type public.session_instance_state as enum (
      'available',
      'started',
      'completed',
      'partially_completed',
      'missed',
      'cancelled',
      'rescheduled',
      'plan_locked',
      'recovery'
    );
  end if;
end;
$$;

alter table public.session_instances
  add column if not exists state public.session_instance_state not null default 'available';

create index if not exists session_instances_calendar_idx
  on public.session_instances (scheduled_date, status, team_id);

drop policy if exists "team members can read session instances" on public.session_instances;

create policy "team members can read published session instances"
on public.session_instances for select to authenticated
using (public.is_team_member(team_id) and status = 'published');

create policy "team coaches can read all session instances"
on public.session_instances for select to authenticated
using (public.is_team_coach(team_id));

create or replace function public.list_athlete_calendar(
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
    where instance_row.status = 'published'
      and instance_row.scheduled_date between p_from and p_to
      and public.is_team_member(instance_row.team_id)
    order by instance_row.scheduled_date, instance_row.created_at;
end;
$$;

create or replace function public.get_athlete_session(p_session_id uuid)
returns public.session_instances
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  session_row public.session_instances%rowtype;
begin
  select instance_row.* into session_row
  from public.session_instances instance_row
  where instance_row.id = p_session_id
    and instance_row.status = 'published'
    and public.is_team_member(instance_row.team_id);

  if session_row.id is null then
    raise exception using message = 'Sessão não encontrada ou não disponível para este atleta.';
  end if;

  return session_row;
end;
$$;

revoke all on function public.list_athlete_calendar(date, date) from public;
grant execute on function public.list_athlete_calendar(date, date) to authenticated;

revoke all on function public.get_athlete_session(uuid) from public;
grant execute on function public.get_athlete_session(uuid) to authenticated;

comment on column public.session_instances.state is
  'Estado de execução da sessão para o calendário do atleta; status controla publicação.';

comment on function public.list_athlete_calendar(date, date) is
  'Lista somente sessões publicadas e acessíveis ao usuário autenticado no intervalo informado.';

comment on function public.get_athlete_session(uuid) is
  'Retorna o snapshot de uma sessão publicada acessível ao usuário autenticado.';
