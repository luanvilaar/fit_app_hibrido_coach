-- Proprietário da plataforma como superusuário:
-- owners podem ler/administrar qualquer equipe e qualquer template.

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_owner() or exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_coach(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_owner() or exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role = 'coach'
  );
$$;

create or replace function public.owns_session_template(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_owner() or exists (
    select 1
    from public.session_templates
    where id = p_template_id
      and created_by = auth.uid()
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
    'is_coach', public.is_platform_owner() or public.is_coach(),
    'is_athlete', public.is_platform_owner() or public.is_athlete(),
    'is_owner', public.is_platform_owner(),
    'roles', coalesce(
      (
        select jsonb_agg(distinct role_value order by role_value)
        from (
          select member_row.role::text as role_value
          from public.team_members member_row
          where member_row.user_id = auth.uid()
          union
          select 'coach' where public.is_platform_owner()
          union
          select 'athlete' where public.is_platform_owner()
          union
          select 'owner' where public.is_platform_owner()
        ) combined_roles
      ),
      '[]'::jsonb
    ),
    'coach_team_ids', coalesce(
      (
        select jsonb_agg(team_row.id order by team_row.id)
        from public.teams team_row
        where public.is_platform_owner()
           or exists (
             select 1
             from public.team_members member_row
             where member_row.team_id = team_row.id
               and member_row.user_id = auth.uid()
               and member_row.role = 'coach'
           )
      ),
      '[]'::jsonb
    ),
    'athlete_team_ids', coalesce(
      (
        select jsonb_agg(team_row.id order by team_row.id)
        from public.teams team_row
        where public.is_platform_owner()
           or exists (
             select 1
             from public.team_members member_row
             where member_row.team_id = team_row.id
               and member_row.user_id = auth.uid()
               and member_row.role = 'athlete'
           )
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.apply_session_template_to_team(
  p_template_id uuid,
  p_team_id uuid,
  p_scheduled_date date,
  p_status public.session_status default 'draft',
  p_coach_note text default ''
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
    raise exception using message = 'Somente coaches da equipe podem aplicar sessões.';
  end if;

  if not exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and role = 'athlete'
  ) then
    raise exception using message = 'A equipe precisa ter pelo menos um atleta.';
  end if;

  select * into template_row
  from public.session_templates
  where id = p_template_id
    and public.owns_session_template(id);

  if template_row.id is null then
    raise exception using message = 'Template de sessão não encontrado ou não autorizado.';
  end if;

  insert into public.session_instances (
    template_id,
    team_id,
    scheduled_date,
    status,
    snapshot,
    coach_note,
    created_by
  )
  values (
    template_row.id,
    p_team_id,
    p_scheduled_date,
    p_status,
    public.build_template_snapshot(template_row.id),
    coalesce(btrim(p_coach_note), ''),
    auth.uid()
  )
  returning * into instance_row;

  return instance_row;
end;
$$;

insert into public.platform_owners (user_id)
select id from auth.users where lower(email) = 'l.vilaar@gmail.com'
on conflict (user_id) do nothing;

revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.is_team_coach(uuid) from public;
revoke all on function public.owns_session_template(uuid) from public;
revoke all on function public.current_user_roles() from public;
revoke all on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status, text) from public;

grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_coach(uuid) to authenticated;
grant execute on function public.owns_session_template(uuid) to authenticated;
grant execute on function public.current_user_roles() to authenticated;
grant execute on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status, text) to authenticated;
