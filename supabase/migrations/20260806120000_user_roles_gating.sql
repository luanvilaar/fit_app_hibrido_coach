-- Modelo de papéis do usuário autenticado, derivado de public.team_members.
-- Suporta o gating da área do coach no app e futuras policies baseadas em papel.

create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where user_id = auth.uid()
      and role = 'coach'
  );
$$;

create or replace function public.is_athlete()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where user_id = auth.uid()
      and role = 'athlete'
  );
$$;

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

revoke all on function public.is_coach() from public;
revoke all on function public.is_athlete() from public;
revoke all on function public.current_user_roles() from public;

grant execute on function public.is_coach() to authenticated;
grant execute on function public.is_athlete() to authenticated;
grant execute on function public.current_user_roles() to authenticated;
