-- Papel de proprietário da plataforma (owner), independente de team_members:
-- convite de treinadores e gestão da loja não são escopados por equipe.

create table public.platform_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_owners enable row level security;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_owners where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

create policy "owners can read platform owners"
on public.platform_owners for select to authenticated
using (public.is_platform_owner());

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
    'is_owner', public.is_platform_owner(),
    'roles', coalesce(
      (
        select jsonb_agg(distinct role_value order by role_value)
        from (
          select member_row.role::text as role_value
          from public.team_members member_row
          where member_row.user_id = auth.uid()
          union
          select 'owner' where public.is_platform_owner()
        ) combined_roles
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

-- Semente: promove a conta fundadora a proprietária da plataforma.
-- Não falha se a conta ainda não existir no ambiente onde a migration rodar.
insert into public.platform_owners (user_id)
select id from auth.users where email = 'l.vilaar@gmail.com'
on conflict (user_id) do nothing;
