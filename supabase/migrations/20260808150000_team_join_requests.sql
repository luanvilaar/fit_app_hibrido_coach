-- Vínculo do atleta com um grupo/treinador existente, por solicitação (pending → aprovação
-- do coach). Hoje o único caminho para um atleta entrar numa equipe é o coach adicioná-lo por
-- e-mail (add_team_member_by_email, 20260806210000); esta migration abre o caminho inverso.
--
-- RLS de teams/team_members só permite ler equipes das quais o usuário já é membro
-- (is_team_member), então a descoberta de grupos precisa de uma RPC security definer dedicada
-- (list_discoverable_teams) que ignora esse filtro só para leitura pública de nome/nível/objetivo.
--
-- Todas as escritas em team_join_requests acontecem exclusivamente via RPC security definer
-- (sem policy de insert/update para o client) para centralizar as regras de negócio (duplicidade,
-- já ser membro, autorização de coach) num único lugar, como no padrão de team_management.

create type public.team_join_request_status as enum ('pending', 'accepted', 'declined', 'canceled');

create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  status public.team_join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);

-- Impede duas solicitações pendentes do mesmo atleta para o mesmo grupo.
create unique index team_join_requests_unique_pending
  on public.team_join_requests (team_id, athlete_id)
  where status = 'pending';

create index team_join_requests_team_id_idx on public.team_join_requests(team_id);

create trigger team_join_requests_set_updated_at
before update on public.team_join_requests
for each row execute procedure public.set_updated_at();

alter table public.team_join_requests enable row level security;

create policy "athletes can read own join requests"
on public.team_join_requests for select to authenticated
using (athlete_id = auth.uid());

create policy "team coaches can read team join requests"
on public.team_join_requests for select to authenticated
using (public.is_team_coach(team_id));

-- Grupos disponíveis para o atleta pedir vínculo, com o nome do(s) coach(es) responsável(is)
-- (fallback pro prefixo do e-mail quando o coach ainda não definiu display_name) e o status
-- de vínculo do usuário autenticado com cada grupo.
create or replace function public.list_discoverable_teams()
returns table (
  id uuid,
  name text,
  description text,
  level public.training_group_level,
  objective text,
  coach_display_name text,
  athlete_count integer,
  membership_status text,
  join_request_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    team_row.id,
    team_row.name,
    team_row.description,
    team_row.level,
    team_row.objective,
    coalesce(
      string_agg(
        distinct coalesce(profile_row.display_name, initcap(split_part(coach_user.email, '@', 1))),
        ', '
      ) filter (where member_row.role = 'coach'),
      'Sem treinador definido'
    ) as coach_display_name,
    count(*) filter (where member_row.role = 'athlete')::integer as athlete_count,
    case
      when exists (
        select 1
        from public.team_members self_member
        where self_member.team_id = team_row.id
          and self_member.user_id = auth.uid()
      ) then 'member'
      when self_request.id is not null then 'pending'
      else 'none'
    end as membership_status,
    self_request.id as join_request_id
  from public.teams team_row
  left join public.team_members member_row on member_row.team_id = team_row.id
  left join auth.users coach_user on coach_user.id = member_row.user_id and member_row.role = 'coach'
  left join public.profiles profile_row on profile_row.user_id = member_row.user_id and member_row.role = 'coach'
  left join public.team_join_requests self_request
    on self_request.team_id = team_row.id
   and self_request.athlete_id = auth.uid()
   and self_request.status = 'pending'
  group by team_row.id, self_request.id
  order by team_row.name;
$$;

comment on function public.list_discoverable_teams() is
  'Todos os grupos da plataforma com treinador e status de vínculo do usuário autenticado, para o seletor do atleta.';

-- Atleta solicita vínculo a um grupo existente; fica pendente até o coach responder.
create or replace function public.request_team_join(p_team_id uuid)
returns public.team_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.team_join_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception using message = 'Grupo não encontrado.';
  end if;

  if exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  ) then
    raise exception using message = 'Você já faz parte deste grupo.';
  end if;

  if exists (
    select 1 from public.team_join_requests
    where team_id = p_team_id
      and athlete_id = auth.uid()
      and status = 'pending'
  ) then
    raise exception using message = 'Você já tem uma solicitação pendente para este grupo.';
  end if;

  insert into public.team_join_requests (team_id, athlete_id)
  values (p_team_id, auth.uid())
  returning * into request_row;

  return request_row;
end;
$$;

comment on function public.request_team_join(uuid) is
  'Cria uma solicitação de vínculo pendente do atleta autenticado a um grupo.';

-- Atleta desiste da própria solicitação ainda pendente.
create or replace function public.cancel_team_join_request(p_request_id uuid)
returns public.team_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.team_join_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  update public.team_join_requests
  set status = 'canceled'
  where id = p_request_id
    and athlete_id = auth.uid()
    and status = 'pending'
  returning * into request_row;

  if request_row.id is null then
    raise exception using message = 'Solicitação não encontrada ou já respondida.';
  end if;

  return request_row;
end;
$$;

comment on function public.cancel_team_join_request(uuid) is
  'Cancela uma solicitação de vínculo pendente do próprio atleta.';

-- Solicitações pendentes de um grupo, para a tela do coach responder.
create or replace function public.list_team_join_requests(p_team_id uuid)
returns table (
  id uuid,
  team_id uuid,
  athlete_id uuid,
  athlete_display_name text,
  status public.team_join_request_status,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente coaches da equipe podem ver as solicitações.';
  end if;

  return query
  select
    request_row.id,
    request_row.team_id,
    request_row.athlete_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))) as athlete_display_name,
    request_row.status,
    request_row.created_at
  from public.team_join_requests request_row
  join auth.users user_row on user_row.id = request_row.athlete_id
  left join public.profiles profile_row on profile_row.user_id = request_row.athlete_id
  where request_row.team_id = p_team_id
    and request_row.status = 'pending'
  order by request_row.created_at;
end;
$$;

comment on function public.list_team_join_requests(uuid) is
  'Solicitações de vínculo pendentes de um grupo, para o coach aceitar ou recusar.';

-- Coach aceita (vira team_members) ou recusa uma solicitação pendente.
create or replace function public.respond_team_join_request(p_request_id uuid, p_accept boolean)
returns public.team_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.team_join_requests%rowtype;
begin
  select * into request_row
  from public.team_join_requests
  where id = p_request_id
    and status = 'pending';

  if request_row.id is null then
    raise exception using message = 'Solicitação não encontrada ou já respondida.';
  end if;

  if not public.is_team_coach(request_row.team_id) then
    raise exception using message = 'Somente coaches da equipe podem responder solicitações.';
  end if;

  if p_accept then
    insert into public.team_members (team_id, user_id, role)
    values (request_row.team_id, request_row.athlete_id, 'athlete')
    on conflict (team_id, user_id) do nothing;

    update public.team_join_requests
    set status = 'accepted', decided_at = now(), decided_by = auth.uid()
    where id = p_request_id
    returning * into request_row;
  else
    update public.team_join_requests
    set status = 'declined', decided_at = now(), decided_by = auth.uid()
    where id = p_request_id
    returning * into request_row;
  end if;

  return request_row;
end;
$$;

comment on function public.respond_team_join_request(uuid, boolean) is
  'Coach aceita (cria team_members) ou recusa uma solicitação de vínculo pendente.';

revoke all on function public.list_discoverable_teams() from public;
revoke all on function public.request_team_join(uuid) from public;
revoke all on function public.cancel_team_join_request(uuid) from public;
revoke all on function public.list_team_join_requests(uuid) from public;
revoke all on function public.respond_team_join_request(uuid, boolean) from public;

grant execute on function public.list_discoverable_teams() to authenticated;
grant execute on function public.request_team_join(uuid) to authenticated;
grant execute on function public.cancel_team_join_request(uuid) to authenticated;
grant execute on function public.list_team_join_requests(uuid) to authenticated;
grant execute on function public.respond_team_join_request(uuid, boolean) to authenticated;
