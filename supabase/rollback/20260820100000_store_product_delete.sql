-- Rollback de 20260820100000_store_product_delete.sql.
--
-- ATENÇÃO — este rollback é destrutivo em um ponto: produtos excluídos por
-- soft-delete (deleted_at preenchido) voltam a ser visíveis no catálogo do
-- coach, na vitrine (se estiverem publicados) e no checkout, porque a coluna
-- que os escondia deixa de existir. Exporte `id, title, slug, deleted_at` de
-- store_products antes de executar.
--
-- SOBRE O SLUG: o soft-delete mutila o slug para `<slug>-excluido-<uuid>` (para
-- liberar o slug original a um produto novo) e guarda o valor original em
-- `store_product_audit.previous_value` da ação `PRODUCT_DELETED`. Como este
-- rollback apaga justamente essas linhas de auditoria, o passo 4b restaura o slug
-- original ANTES do delete — sem ele o produto voltaria à vitrine com o slug
-- quebrado, derrubando `get_store_product(p_slug)` e todo link externo, de forma
-- irreversível. Se o slug original já tiver sido reaproveitado por outro produto
-- criado depois da exclusão, o passo 4b falha no índice único de `slug`: resolva
-- o conflito manualmente (renomeie um dos dois) e reexecute o rollback.

-- 1. "Arquivar" volta a existir como RPC.
create or replace function public.archive_store_product(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.store_products%rowtype;
begin
  update public.store_products
  set status = 'archived'
  where id = p_product_id
    and (seller_coach_id = auth.uid() or public.is_platform_owner())
  returning * into product_row;

  if product_row.id is null then
    raise exception using message = 'Produto não encontrado ou não autorizado.';
  end if;

  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_ARCHIVED', to_jsonb(product_row));

  return product_row;
end;
$$;

revoke all on function public.archive_store_product(uuid) from public;
grant execute on function public.archive_store_product(uuid) to authenticated;

-- 2. Editar volta a derrubar o produto para rascunho e a bloquear arquivados.
create or replace function public.update_store_training_program(
  p_product_id uuid, p_title text, p_slug text, p_description text, p_short_description text, p_cover_image_url text,
  p_price_cents integer, p_category public.store_product_category, p_objective text, p_level public.store_product_level,
  p_duration_weeks integer, p_schedule jsonb
) returns public.store_products language plpgsql security definer set search_path = public
as $$
declare previous_row public.store_products%rowtype; product_row public.store_products%rowtype; day_json jsonb; template_id uuid; week_value integer; day_value integer; day_type_value text;
begin
  select * into previous_row from public.store_products where id = p_product_id and (seller_coach_id = auth.uid() or public.is_platform_owner());
  if previous_row.id is null or previous_row.status = 'archived' then raise exception using message = 'Produto não encontrado ou não autorizado.'; end if;
  if char_length(btrim(p_title)) < 2 or char_length(btrim(p_short_description)) < 8 or char_length(btrim(p_objective)) < 2 or p_price_cents is null or p_price_cents <= 0 then raise exception using message = 'Preencha os dados comerciais válidos.'; end if;
  if p_duration_weeks is null or p_duration_weeks < 1 or jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) <> p_duration_weeks * 7 then raise exception using message = 'A duração precisa gerar os 7 dias de cada semana.'; end if;
  update public.store_products set title = btrim(p_title), slug = lower(btrim(p_slug)), description = coalesce(btrim(p_description), ''), short_description = btrim(p_short_description), cover_image_url = nullif(btrim(p_cover_image_url), ''), price_cents = p_price_cents, category = p_category, objective = btrim(p_objective), level = p_level, duration_weeks = p_duration_weeks, status = 'draft' where id = p_product_id returning * into product_row;
  delete from public.store_product_sessions where product_id = p_product_id;
  for day_json in select value from jsonb_array_elements(p_schedule) loop
    week_value := (day_json->>'week_number')::integer; day_value := (day_json->>'day_number')::integer; day_type_value := day_json->>'day_type'; template_id := nullif(day_json->>'session_template_id', '')::uuid;
    if week_value not between 1 and p_duration_weeks or day_value not between 1 and 7 or day_type_value not in ('training', 'rest', 'recovery', 'assessment', 'unprogrammed') or ((day_type_value = 'training') <> (template_id is not null)) then raise exception using message = 'Semana, dia ou tipo de dia inválido.'; end if;
    if template_id is not null and not exists (select 1 from public.session_templates where id = template_id and status = 'published' and (created_by = product_row.seller_coach_id or public.is_platform_owner())) then raise exception using message = 'O treino selecionado não pertence ao coach ou não está publicado.'; end if;
    insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number, is_rest_day, day_type) values (p_product_id, template_id, week_value, day_value, day_type_value <> 'training', day_type_value);
  end loop;
  perform public.validate_store_program_schedule(p_product_id);
  insert into public.store_product_audit (product_id, actor_id, action, previous_value, new_value) values (p_product_id, auth.uid(), 'PRODUCT_UPDATED', to_jsonb(previous_row), to_jsonb(product_row));
  return product_row;
exception when unique_violation then raise exception using message = 'Há dias repetidos no programa.';
end;
$$;

-- `create or replace` não apaga o COMMENT da versão anterior: sem isto a descrição
-- "preserva o status vigente" sobreviveria a um rollback que restaura o oposto.
comment on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) is null;

-- 2b. RPCs de escrita voltam a localizar o produto só por status, sem o guarda de
--     exclusão. Precisa acontecer ANTES do drop da coluna `deleted_at` (passo 5):
--     estas são cópias fiéis das versões de 20260819100000.
create or replace function public.create_training_program_delivery(
  p_product_id uuid,
  p_team_id uuid default null,
  p_athlete_id uuid default null,
  p_start_date date default current_date
)
returns public.training_program_deliveries
language plpgsql security definer set search_path = public
as $$
declare product_row public.store_products%rowtype; version_row public.store_program_versions%rowtype; delivery_row public.training_program_deliveries%rowtype; target_team_id uuid := p_team_id;
begin
  select * into product_row from public.store_products where id = p_product_id and status = 'published';
  if product_row.id is null or (product_row.seller_coach_id <> auth.uid() and not public.is_platform_owner()) then raise exception using message = 'Produto publicado não encontrado ou não autorizado.'; end if;
  select * into version_row from public.store_program_versions where product_id = p_product_id order by version_number desc limit 1;
  if version_row.id is null then raise exception using message = 'Programa sem versão publicada.'; end if;
  if p_team_id is not null and not public.is_team_coach(p_team_id) and not public.is_platform_owner() then raise exception using message = 'Somente o coach da equipe pode criar uma entrega.'; end if;
  if p_athlete_id is not null and p_team_id is not null and not exists (select 1 from public.team_members where team_id = p_team_id and user_id = p_athlete_id and role = 'athlete') then raise exception using message = 'O atleta não pertence à equipe selecionada.'; end if;
  if p_team_id is null and p_athlete_id is not null and not exists (
    select 1 from public.team_members athlete_member join public.team_members coach_member on coach_member.team_id = athlete_member.team_id and coach_member.user_id = auth.uid() and coach_member.role = 'coach'
    where athlete_member.user_id = p_athlete_id and athlete_member.role = 'athlete'
  ) and not public.is_platform_owner() then raise exception using message = 'O atleta não está vinculado a uma equipe autorizada deste coach.'; end if;
  if p_team_id is null and p_athlete_id is null then raise exception using message = 'Selecione uma equipe ou atleta para a entrega.'; end if;
  if target_team_id is null then
    insert into public.teams (name, description, level, objective, created_by) values (left('Programa privado · ' || product_row.title, 120), 'Equipe privada criada para uma entrega individual.', 'iniciante', 'Entrega individual de programa', auth.uid()) returning id into target_team_id;
    insert into public.team_members (team_id, user_id, role) values (target_team_id, p_athlete_id, 'athlete') on conflict (team_id, user_id) do nothing;
  end if;
  insert into public.training_program_deliveries (product_id, version_id, coach_id, team_id, athlete_id, start_date, created_by)
  values (p_product_id, version_row.id, product_row.seller_coach_id, target_team_id, p_athlete_id, coalesce(p_start_date, current_date), auth.uid()) returning * into delivery_row;
  perform public.populate_program_delivery_sessions(delivery_row.id);
  return delivery_row;
end;
$$;

comment on function public.create_training_program_delivery(uuid, uuid, uuid, date) is null;

create or replace function public.submit_store_product_review(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare product_row public.store_products%rowtype;
begin
  select * into product_row from public.store_products where id = p_product_id and seller_coach_id = auth.uid();
  if product_row.id is null or product_row.status not in ('draft', 'review') then
    raise exception using message = 'Produto não encontrado ou não pode ser enviado para análise.';
  end if;
  perform public.validate_store_program_schedule(p_product_id);
  update public.store_products set status = 'review' where id = p_product_id returning * into product_row;
  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_SUBMITTED_FOR_REVIEW', to_jsonb(product_row));
  return product_row;
end;
$$;

create or replace function public.approve_store_product(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare product_row public.store_products%rowtype; version_id uuid;
begin
  if not public.is_platform_owner() then
    raise exception using message = 'Somente administradores podem aprovar produtos.';
  end if;
  select * into product_row from public.store_products where id = p_product_id and status = 'review' for update;
  if product_row.id is null then raise exception using message = 'Produto não encontrado ou fora da fila de análise.'; end if;
  version_id := public.create_store_program_version_internal(p_product_id, auth.uid());
  update public.store_products set status = 'published' where id = p_product_id returning * into product_row;
  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_APPROVED', jsonb_build_object('product', to_jsonb(product_row), 'version_id', version_id));
  return product_row;
end;
$$;

-- 3. Leituras voltam ao formato anterior (sem has_history e sem filtro de exclusão).
drop function if exists public.list_coach_store_products();
create function public.list_coach_store_products()
returns table (
  id uuid, seller_coach_id uuid, type public.store_product_type, title text, slug text,
  description text, short_description text, cover_image_url text, session_template_id uuid,
  price_cents integer, category public.store_product_category, objective text,
  level public.store_product_level, duration_weeks integer, status public.store_product_status,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select product_row.id, product_row.seller_coach_id, product_row.type, product_row.title, product_row.slug,
    product_row.description, product_row.short_description, product_row.cover_image_url,
    (select session_template_id from public.store_product_sessions where product_id = product_row.id and day_type = 'training' order by week_number, day_number limit 1),
    product_row.price_cents, product_row.category, product_row.objective, product_row.level,
    product_row.duration_weeks, product_row.status, product_row.created_at, product_row.updated_at
  from public.store_products product_row
  where product_row.seller_coach_id = auth.uid() or public.is_platform_owner()
  order by product_row.updated_at desc;
$$;

revoke all on function public.list_coach_store_products() from public;
grant execute on function public.list_coach_store_products() to authenticated;

create or replace function public.list_store_products(p_category public.store_product_category default null)
returns table (
  id uuid, seller_coach_id uuid, seller_display_name text, type public.store_product_type, title text,
  slug text, short_description text, cover_image_url text, price_cents integer,
  category public.store_product_category, objective text, level public.store_product_level,
  duration_weeks integer, status public.store_product_status, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select product_row.id, product_row.seller_coach_id, coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))), product_row.type,
    product_row.title, product_row.slug, product_row.short_description, product_row.cover_image_url,
    product_row.price_cents, product_row.category, product_row.objective, product_row.level,
    product_row.duration_weeks, product_row.status, product_row.created_at
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where product_row.status = 'published' and (p_category is null or product_row.category = p_category)
  order by product_row.created_at desc;
$$;

create or replace function public.get_store_product(p_slug text)
returns table (
  id uuid, seller_coach_id uuid, seller_display_name text, type public.store_product_type, title text,
  slug text, description text, short_description text, cover_image_url text, price_cents integer,
  category public.store_product_category, objective text, level public.store_product_level,
  duration_weeks integer, status public.store_product_status, sessions jsonb
)
language sql stable security definer set search_path = public
as $$
  select product_row.id, product_row.seller_coach_id, coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))), product_row.type,
    product_row.title, product_row.slug, product_row.description, product_row.short_description, product_row.cover_image_url,
    product_row.price_cents, product_row.category, product_row.objective, product_row.level, product_row.duration_weeks, product_row.status,
    coalesce((select jsonb_agg(jsonb_build_object('id', product_session_row.id, 'week_number', product_session_row.week_number, 'day_number', product_session_row.day_number, 'day_type', product_session_row.day_type, 'title', case product_session_row.day_type when 'training' then template_row.title when 'rest' then 'Descanso' when 'recovery' then 'Recuperação' when 'assessment' then 'Avaliação' else 'Sem programação' end) order by product_session_row.week_number, product_session_row.day_number)
      from public.store_product_sessions product_session_row left join public.session_templates template_row on template_row.id = product_session_row.session_template_id where product_session_row.product_id = product_row.id), '[]'::jsonb)
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where product_row.slug = lower(btrim(p_slug)) and (product_row.status = 'published' or product_row.seller_coach_id = auth.uid() or public.is_platform_owner());
$$;

create or replace function public.list_store_products_for_review()
returns table (
  id uuid,
  seller_coach_id uuid,
  seller_display_name text,
  title text,
  slug text,
  description text,
  short_description text,
  price_cents integer,
  category public.store_product_category,
  objective text,
  level public.store_product_level,
  duration_weeks integer,
  status public.store_product_status,
  updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    product_row.id,
    product_row.seller_coach_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))),
    product_row.title,
    product_row.slug,
    product_row.description,
    product_row.short_description,
    product_row.price_cents,
    product_row.category,
    product_row.objective,
    product_row.level,
    product_row.duration_weeks,
    product_row.status,
    product_row.updated_at
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where public.is_platform_owner()
    and product_row.status = 'review'
  order by product_row.updated_at asc;
$$;

drop policy if exists "published products are readable" on public.store_products;
create policy "published products are readable"
on public.store_products for select to authenticated
using (
  status = 'published'
  or seller_coach_id = auth.uid()
  or public.is_platform_owner()
);

-- 4. Produtos convertidos de 'archived' para 'draft' voltam ao estado anterior,
--    usando a própria trilha de auditoria escrita pela migration.
update public.store_products
set status = 'archived'
where status = 'draft'
  and id in (
    select product_id from public.store_product_audit
    where action = 'PRODUCT_ARCHIVED_CONVERTED_TO_DRAFT'
  );

delete from public.store_product_audit where action = 'PRODUCT_ARCHIVED_CONVERTED_TO_DRAFT';

-- 4b. Produtos soft-deletados recuperam o slug original ANTES de a auditoria ser
--     apagada. `store_product_audit.previous_value` da ação 'PRODUCT_DELETED' é a
--     única cópia sobrevivente do slug pré-mutilação; sem este passo o produto
--     volta ao catálogo com `<slug>-excluido-<uuid>` e a corrupção é definitiva.
--     `distinct on` mantém a exclusão mais antiga de cada produto — hoje só existe
--     uma (delete_store_product retorna cedo em produto já excluído), mas a ordem
--     explícita evita depender disso.
update public.store_products product_row
set slug = deletion.original_slug
from (
  select distinct on (audit_row.product_id)
    audit_row.product_id,
    audit_row.previous_value->>'slug' as original_slug
  from public.store_product_audit audit_row
  where audit_row.action = 'PRODUCT_DELETED'
    and audit_row.previous_value->>'slug' is not null
  order by audit_row.product_id, audit_row.created_at asc
) deletion
where deletion.product_id = product_row.id
  and product_row.deleted_at is not null;

delete from public.store_product_audit where action = 'PRODUCT_DELETED';

-- 5. Exclusão deixa de existir.
drop function if exists public.delete_store_product(uuid);
drop function if exists public.store_product_has_history(uuid);
drop index if exists public.training_program_deliveries_product_idx;
-- Defensivo: rascunhos anteriores desta migration criavam um índice parcial
-- `store_products_not_deleted_idx`, hoje removido por duplicar
-- `store_products_seller_idx`. Se algum ambiente colou aquela versão no SQL Editor,
-- o índice ainda existe e precisa cair junto com a coluna.
drop index if exists public.store_products_not_deleted_idx;
alter table public.store_products drop column if exists deleted_at;

notify pgrst, 'reload schema';
