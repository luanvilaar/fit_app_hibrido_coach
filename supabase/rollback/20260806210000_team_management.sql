-- Remove a gestão de membros por e-mail e a guarda do último coach.

drop trigger if exists team_members_guard_last_coach on public.team_members;
drop function if exists public.guard_team_last_coach();
drop function if exists public.add_team_member_by_email(uuid, text, public.team_member_role);
drop function if exists public.list_team_members(uuid);
drop function if exists public.list_coach_teams_with_member_counts();
