create or replace function public.current_user_roles()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'is_coach', public.is_coach(),
    'is_athlete', public.is_athlete(),
    'roles', coalesce(
      (
        select jsonb_agg(distinct member_row.role::text order by member_row.role::text)
        from public.team_members member_row
        where member_row.user_id = auth.uid()
      ),
      '[]'::jsonb
    ),
    'coach_team_ids', coalesce(
      (
        select jsonb_agg(member_row.team_id order by member_row.team_id)
        from public.team_members member_row
        where member_row.user_id = auth.uid()
          and member_row.role = 'coach'
      ),
      '[]'::jsonb
    ),
    'athlete_team_ids', coalesce(
      (
        select jsonb_agg(member_row.team_id order by member_row.team_id)
        from public.team_members member_row
        where member_row.user_id = auth.uid()
          and member_row.role = 'athlete'
      ),
      '[]'::jsonb
    )
  );
$$;

drop policy if exists "owners can read platform owners" on public.platform_owners;
drop function if exists public.is_platform_owner();
drop table if exists public.platform_owners;
