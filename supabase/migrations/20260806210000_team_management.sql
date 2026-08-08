-- Gestão de grupos: listar membros com e-mail e convidar atleta/coach por e-mail.
-- auth.users não é exposto ao client; as duas operações passam por RPC security definer.
-- Também generaliza, via trigger, a invariante de que toda equipe precisa de ao menos um coach
-- (hoje só garantida no momento da criação por add_team_creator_as_coach).

-- Mesma base de list_coach_teams (Story 1.9), com contagem de coaches/atletas para a tela de lista.
create or replace function public.list_coach_teams_with_member_counts()
returns table (
  id uuid,
  name text,
  description text,
  level public.training_group_level,
  objective text,
  created_by uuid,
  created_at timestamptz,
  coach_count integer,
  athlete_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    team_row.id,
    team_row.name,
    team_row.description,
    team_row.level,
    team_row.objective,
    team_row.created_by,
    team_row.created_at,
    count(*) filter (where member_row.role = 'coach')::integer as coach_count,
    count(*) filter (where member_row.role = 'athlete')::integer as athlete_count
  from public.teams team_row
  left join public.team_members member_row on member_row.team_id = team_row.id
  where public.is_team_coach(team_row.id)
  group by team_row.id
  order by team_row.name;
$$;

comment on function public.list_coach_teams_with_member_counts() is
  'Equipes do coach autenticado com contagem de coaches e atletas, para a tela de gestão de grupos.';

create or replace function public.list_team_members(p_team_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  role public.team_member_role,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_team_member(p_team_id) then
    raise exception using message = 'Você não pertence a esta equipe.';
  end if;

  return query
  select member_row.id, member_row.user_id, user_row.email::text, member_row.role, member_row.created_at
  from public.team_members member_row
  join auth.users user_row on user_row.id = member_row.user_id
  where member_row.team_id = p_team_id
  order by member_row.role, user_row.email;
end;
$$;

comment on function public.list_team_members(uuid) is
  'Lista os membros de uma equipe com e-mail, para a tela de gestão do coach.';

create or replace function public.add_team_member_by_email(
  p_team_id uuid,
  p_email text,
  p_role public.team_member_role
)
returns public.team_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  member_row public.team_members%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente coaches da equipe podem adicionar membros.';
  end if;

  if btrim(p_email) = '' or position('@' in p_email) = 0 then
    raise exception using message = 'Informe um e-mail válido.';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception using message = 'Não encontramos nenhuma conta com este e-mail.';
  end if;

  if exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and user_id = target_user_id
  ) then
    raise exception using message = 'Esse usuário já faz parte da equipe.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, target_user_id, p_role)
  returning * into member_row;

  return member_row;
end;
$$;

comment on function public.add_team_member_by_email(uuid, text, public.team_member_role) is
  'Adiciona um usuário existente à equipe pelo e-mail, validando que quem convida é coach da equipe.';

create or replace function public.guard_team_last_coach()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_coaches integer;
  is_losing_coach boolean;
begin
  if TG_OP = 'DELETE' then
    is_losing_coach := OLD.role = 'coach';
  else
    is_losing_coach := OLD.role = 'coach' and NEW.role <> 'coach';
  end if;

  if is_losing_coach then
    select count(*) into remaining_coaches
    from public.team_members
    where team_id = OLD.team_id
      and role = 'coach'
      and id <> OLD.id;

    if remaining_coaches = 0 then
      raise exception using message = 'A equipe precisa ter ao menos um coach.';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;

comment on function public.guard_team_last_coach() is
  'Impede remover ou rebaixar o último coach de uma equipe, mantendo a invariante usada por is_team_coach.';

create trigger team_members_guard_last_coach
before delete or update on public.team_members
for each row execute procedure public.guard_team_last_coach();

revoke all on function public.list_coach_teams_with_member_counts() from public;
revoke all on function public.list_team_members(uuid) from public;
revoke all on function public.add_team_member_by_email(uuid, text, public.team_member_role) from public;

grant execute on function public.list_coach_teams_with_member_counts() to authenticated;
grant execute on function public.list_team_members(uuid) to authenticated;
grant execute on function public.add_team_member_by_email(uuid, text, public.team_member_role) to authenticated;
