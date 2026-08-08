drop policy if exists "team members can read published session instances" on public.session_instances;
drop policy if exists "team coaches can read all session instances" on public.session_instances;

create policy "team members can read session instances"
on public.session_instances for select to authenticated
using (public.is_team_member(team_id));

drop function if exists public.list_athlete_calendar(date, date);
drop function if exists public.get_athlete_session(uuid);

drop index if exists public.session_instances_calendar_idx;

alter table public.session_instances
  drop column if exists state;

drop type if exists public.session_instance_state;
