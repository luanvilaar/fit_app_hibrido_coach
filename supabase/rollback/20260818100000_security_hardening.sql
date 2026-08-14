-- Rollback do hardening 20260818100000.
-- Use apenas para restaurar o comportamento anterior em ambiente de teste.
-- O operador precisa habilitar explicitamente a sessão: SET app.allow_security_rollback = 'true';
do $$
begin
  if coalesce(current_setting('app.allow_security_rollback', true), 'false') <> 'true' then
    raise exception using message = 'Rollback de segurança bloqueado. Habilite app.allow_security_rollback somente em ambiente de teste.';
  end if;
end;
$$;

drop trigger if exists team_members_guard_identity_change on public.team_members;
drop function if exists public.guard_team_membership_identity_change();

drop policy if exists "athletes manage own published team session progress" on public.athlete_session_progress;
drop policy if exists "athletes manage own session progress" on public.athlete_session_progress;
create policy "athletes manage own session progress"
on public.athlete_session_progress for all to authenticated
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

drop policy if exists "athletes manage own published team set results" on public.athlete_set_results;
drop policy if exists "athletes manage own set results" on public.athlete_set_results;
create policy "athletes manage own set results"
on public.athlete_set_results for all to authenticated
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

drop policy if exists "team coaches can add athletes" on public.team_members;
drop policy if exists "team coaches can manage membership" on public.team_members;
create policy "team coaches can manage membership"
on public.team_members for insert to authenticated
with check (public.is_team_coach(team_id));

drop policy if exists "owners can update membership" on public.team_members;
drop policy if exists "team coaches can update membership" on public.team_members;
create policy "team coaches can update membership"
on public.team_members for update to authenticated
using (public.is_team_coach(team_id))
with check (public.is_team_coach(team_id));

drop policy if exists "team coaches can remove athletes" on public.team_members;
drop policy if exists "team coaches can remove membership" on public.team_members;
create policy "team coaches can remove membership"
on public.team_members for delete to authenticated
using (public.is_team_coach(team_id));

grant execute on function public.build_template_snapshot(uuid) to authenticated;
grant execute on function public.insert_template_blocks(uuid, jsonb) to authenticated;

drop policy if exists "coaches can read own product sessions" on public.store_product_sessions;
create policy "visible product sessions are readable"
on public.store_product_sessions for select to authenticated
using (
  exists (
    select 1
    from public.store_products product_row
    where product_row.id = store_product_sessions.product_id
      and (
        product_row.status = 'published'
        or product_row.seller_coach_id = auth.uid()
        or public.is_platform_owner()
        or exists (
          select 1
          from public.training_program_access access_row
          where access_row.product_id = product_row.id
            and access_row.user_id = auth.uid()
            and access_row.revoked_at is null
        )
      )
  )
);

-- Restaurar os corpos das funções substituídas pela migration de hardening.
create or replace function public.get_store_product(p_slug text)
returns table (
  id uuid,
  seller_coach_id uuid,
  seller_display_name text,
  type public.store_product_type,
  title text,
  slug text,
  description text,
  short_description text,
  cover_image_url text,
  price_cents integer,
  category public.store_product_category,
  level public.store_product_level,
  duration_weeks integer,
  status public.store_product_status,
  sessions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    product_row.id,
    product_row.seller_coach_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))) as seller_display_name,
    product_row.type,
    product_row.title,
    product_row.slug,
    product_row.description,
    product_row.short_description,
    product_row.cover_image_url,
    product_row.price_cents,
    product_row.category,
    product_row.level,
    product_row.duration_weeks,
    product_row.status,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', product_session_row.id,
            'week_number', product_session_row.week_number,
            'day_number', product_session_row.day_number,
            'session_template_id', template_row.id,
            'title', template_row.title
          )
          order by product_session_row.week_number, product_session_row.day_number
        )
        from public.store_product_sessions product_session_row
        join public.session_templates template_row
          on template_row.id = product_session_row.session_template_id
        where product_session_row.product_id = product_row.id
      ),
      '[]'::jsonb
    ) as sessions
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where product_row.slug = lower(btrim(p_slug))
    and (
      product_row.status = 'published'
      or product_row.seller_coach_id = auth.uid()
      or public.is_platform_owner()
    );
$$;

create or replace function public.list_my_training_programs()
returns table (
  access_id uuid,
  product_id uuid,
  order_id uuid,
  title text,
  seller_coach_id uuid,
  seller_display_name text,
  duration_weeks integer,
  granted_at timestamptz,
  sessions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    access_row.id,
    access_row.product_id,
    access_row.order_id,
    product_row.title,
    product_row.seller_coach_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))) as seller_display_name,
    product_row.duration_weeks,
    access_row.granted_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', product_session_row.id,
            'week_number', product_session_row.week_number,
            'day_number', product_session_row.day_number,
            'session_template_id', template_row.id,
            'title', template_row.title
          )
          order by product_session_row.week_number, product_session_row.day_number
        )
        from public.store_product_sessions product_session_row
        join public.session_templates template_row
          on template_row.id = product_session_row.session_template_id
        where product_session_row.product_id = product_row.id
      ),
      '[]'::jsonb
    ) as sessions
  from public.training_program_access access_row
  join public.store_products product_row on product_row.id = access_row.product_id
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where access_row.user_id = auth.uid()
    and access_row.revoked_at is null
  order by access_row.granted_at desc;
$$;

create or replace function public.create_session_template_with_content(
  p_title text,
  p_blocks jsonb,
  p_status public.session_status default 'draft'
)
returns public.session_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if char_length(btrim(p_title)) < 2 then
    raise exception using message = 'O título da sessão é obrigatório.';
  end if;

  insert into public.session_templates (title, status, created_by)
  values (btrim(p_title), p_status, auth.uid())
  returning * into template_row;

  perform public.insert_template_blocks(template_row.id, p_blocks);

  return template_row;
end;
$$;

create or replace function public.get_session_template_content(p_template_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  status_value public.session_status;
begin
  if not public.owns_session_template(p_template_id) then
    raise exception using message = 'Template de sessão não encontrado ou não autorizado.';
  end if;

  select status into status_value
  from public.session_templates
  where id = p_template_id;

  return public.build_template_snapshot(p_template_id) || jsonb_build_object('status', status_value);
end;
$$;

create or replace function public.update_session_template_content(
  p_template_id uuid,
  p_title text,
  p_blocks jsonb,
  p_status public.session_status default null
)
returns public.session_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not public.owns_session_template(p_template_id) then
    raise exception using message = 'Template de sessão não encontrado ou não autorizado.';
  end if;

  if char_length(btrim(p_title)) < 2 then
    raise exception using message = 'O título da sessão é obrigatório.';
  end if;

  delete from public.session_blocks where template_id = p_template_id;

  update public.session_templates
  set title = btrim(p_title),
      status = coalesce(p_status, status)
  where id = p_template_id
  returning * into template_row;

  perform public.insert_template_blocks(template_row.id, p_blocks);

  return template_row;
end;
$$;

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

revoke all on function public.create_session_template_with_content(text, jsonb, public.session_status) from public;
revoke all on function public.get_session_template_content(uuid) from public;
revoke all on function public.update_session_template_content(uuid, text, jsonb, public.session_status) from public;
revoke all on function public.list_team_members(uuid) from public;
revoke all on function public.add_team_member_by_email(uuid, text, public.team_member_role) from public;

grant execute on function public.create_session_template_with_content(text, jsonb, public.session_status) to authenticated;
grant execute on function public.get_session_template_content(uuid) to authenticated;
grant execute on function public.update_session_template_content(uuid, text, jsonb, public.session_status) to authenticated;
grant execute on function public.list_team_members(uuid) to authenticated;
grant execute on function public.add_team_member_by_email(uuid, text, public.team_member_role) to authenticated;

notify pgrst, 'reload schema';
