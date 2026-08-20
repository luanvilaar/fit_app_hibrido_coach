-- Rollback operacional: restaura as definições alteradas por esta migration.
-- Não recria vínculos athlete removidos deliberadamente: isso deve ser feito só mediante decisão explícita.
drop function if exists public.get_coach_supervision_session(uuid, uuid);
drop function if exists public.list_coach_supervision_sessions(uuid, date, date);
drop function if exists public.list_coach_supervision_roster();
drop function if exists public.can_supervise_athlete_in_team(uuid, uuid);

create or replace function public.is_team_member(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_owner() or exists (
    select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_coach(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_owner() or exists (
    select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid() and role = 'coach'
  );
$$;

create or replace function public.current_user_roles()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'is_coach', public.is_platform_owner() or public.is_coach(),
    'is_athlete', public.is_platform_owner() or public.is_athlete(),
    'is_owner', public.is_platform_owner(),
    'roles', coalesce((
      select jsonb_agg(distinct role_value order by role_value) from (
        select member_row.role::text as role_value from public.team_members member_row where member_row.user_id = auth.uid()
        union select 'coach' where public.is_platform_owner()
        union select 'athlete' where public.is_platform_owner()
        union select 'owner' where public.is_platform_owner()
      ) roles
    ), '[]'::jsonb),
    'coach_team_ids', coalesce((
      select jsonb_agg(team_row.id order by team_row.id) from public.teams team_row
      where public.is_platform_owner() or exists (
        select 1 from public.team_members member_row where member_row.team_id = team_row.id and member_row.user_id = auth.uid() and member_row.role = 'coach'
      )
    ), '[]'::jsonb),
    'athlete_team_ids', coalesce((
      select jsonb_agg(team_row.id order by team_row.id) from public.teams team_row
      where public.is_platform_owner() or exists (
        select 1 from public.team_members member_row where member_row.team_id = team_row.id and member_row.user_id = auth.uid() and member_row.role = 'athlete'
      )
    ), '[]'::jsonb)
  );
$$;

drop policy if exists "team members and coaches can read their teams" on public.teams;
create policy "team members can read their teams"
on public.teams for select to authenticated
using (public.is_team_member(id));

revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.is_team_coach(uuid) from public;
revoke all on function public.current_user_roles() from public;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_coach(uuid) to authenticated;
grant execute on function public.current_user_roles() to authenticated;
notify pgrst, 'reload schema';
