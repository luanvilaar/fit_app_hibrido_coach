-- Exclusão de produtos do coach e edição sem despublicar.
--
-- Duas mudanças de comportamento, uma dependente da outra:
--
-- 1. "Arquivar" deixa de existir — como ação, como RPC e como estado alcançável
--    do catálogo. No lugar entra "Excluir", que decide sozinho entre DELETE
--    físico (produto sem histórico) e soft-delete (produto que já gerou pedido,
--    acesso, versão ou entrega e por isso não pode violar as FKs
--    "on delete restrict" que protegem quem já comprou).
-- 2. Editar um produto publicado para de forçar `status = 'draft'`: a venda
--    ativa não pode cair porque o coach corrigiu um texto. A versão publicada
--    continua imutável (Story 1.33) — só o status do produto muda de regra.
--
-- O soft-delete é uma coluna `deleted_at`, não um novo valor de enum: o enum
-- `store_product_status` só pode ganhar valores fora de transação, e "excluído"
-- não é um estado editorial do produto (draft/review/published), é a ausência
-- dele no catálogo.
--
-- Como o soft-delete não mexe em `status`, toda RPC de escrita que localizava o
-- produto só por `status` passa a exigir também `deleted_at is null` (seção 6) —
-- caso contrário um produto excluído continuaria podendo ser entregue, submetido
-- ou aprovado.

-- ---------------------------------------------------------------------------
-- 1. Coluna de soft-delete
-- ---------------------------------------------------------------------------

alter table public.store_products
  add column if not exists deleted_at timestamptz;

comment on column public.store_products.deleted_at is
  'Momento em que o coach excluiu um produto que já possuía histórico. A linha continua existindo apenas para honrar as FKs "on delete restrict" de pedidos, acessos, versões e entregas; ela sai do catálogo do coach, da vitrine, da fila de moderação e do checkout.';

-- Nenhum índice novo é criado para o filtro de exclusão. `store_products_seller_idx`
-- (`seller_coach_id, status, updated_at desc`, de 20260817100000) já cobre exatamente
-- as mesmas três colunas na mesma ordem; um índice parcial `where deleted_at is null`
-- sobre elas seria uma segunda cópia da árvore, com o custo de escrita dobrado e sem
-- ganho de leitura — o predicado real de `list_coach_store_products()` é
-- `seller_coach_id = auth.uid() or public.is_platform_owner()`, e o OR com função
-- derruba o index scan de qualquer um dos dois.

-- ---------------------------------------------------------------------------
-- 1b. Índice ausente na FK de entregas
-- ---------------------------------------------------------------------------
-- `store_product_has_history` é avaliada por linha em `list_coach_store_products()`
-- — ou seja, na tela principal do coach. Das quatro FKs "on delete restrict" que ela
-- consulta, três já têm índice por `product_id` (`store_order_items_product_idx`,
-- `training_program_access_product_idx`, `store_program_versions_product_idx`);
-- `training_program_deliveries` só tem índices por team, athlete e version, então o
-- `exists` correspondente caía em seq scan e a listagem ficava O(produtos × entregas).

create index if not exists training_program_deliveries_product_idx
  on public.training_program_deliveries(product_id);

-- ---------------------------------------------------------------------------
-- 2. Dado legado: 'archived' sai do catálogo vivo
-- ---------------------------------------------------------------------------
-- Um produto arquivado no modelo antigo não pode ficar travado sem ação
-- possível. Ele volta a ser rascunho — continua fora da vitrine, exatamente
-- como estava — e passa a oferecer a mesma ação "Excluir" dos demais produtos.
-- A conversão é explícita e auditada; o autor registrado é o próprio coach
-- vendedor, porque uma migration não tem `auth.uid()`.

with converted as (
  update public.store_products
  set status = 'draft'
  where status = 'archived'
  returning id, seller_coach_id, title, status
)
insert into public.store_product_audit (product_id, actor_id, action, previous_value, new_value)
select
  converted.id,
  converted.seller_coach_id,
  'PRODUCT_ARCHIVED_CONVERTED_TO_DRAFT',
  jsonb_build_object('status', 'archived'),
  jsonb_build_object('status', converted.status, 'title', converted.title)
from converted;

-- ---------------------------------------------------------------------------
-- 3. Histórico do produto: a única definição de "tem venda/versão/entrega"
-- ---------------------------------------------------------------------------
-- Uma função só, usada tanto pela decisão de exclusão quanto pelo aviso que a
-- UI mostra antes de confirmar. Assim a tela nunca avisa uma coisa e o banco
-- decide outra.

create or replace function public.store_product_has_history(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.store_order_items where product_id = p_product_id)
      or exists (select 1 from public.training_program_access where product_id = p_product_id)
      or exists (select 1 from public.store_program_versions where product_id = p_product_id)
      or exists (select 1 from public.training_program_deliveries where product_id = p_product_id);
$$;

comment on function public.store_product_has_history(uuid) is
  'True quando o produto já é referenciado por pedido, acesso, versão publicada ou entrega — ou seja, quando excluí-lo exige soft-delete.';

-- ---------------------------------------------------------------------------
-- 4. Excluir produto
-- ---------------------------------------------------------------------------
-- Não existe policy de DELETE em store_products: RLS nega por padrão e esta
-- função security definer é a única porta de entrada, com a checagem de dono
-- feita explicitamente no SELECT ... FOR UPDATE abaixo.

create or replace function public.delete_store_product(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.store_products%rowtype;
  previous_row public.store_products%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  select * into product_row
  from public.store_products
  where id = p_product_id
    and (seller_coach_id = auth.uid() or public.is_platform_owner())
  for update;

  if product_row.id is null then
    raise exception using message = 'Produto não encontrado ou não autorizado.';
  end if;

  -- Repetir a mesma exclusão é sucesso, não erro: a tela pode ter recarregado
  -- entre o clique e a confirmação.
  if product_row.deleted_at is not null then
    return product_row;
  end if;

  if not public.store_product_has_history(p_product_id) then
    -- Sem pedido, acesso, versão ou entrega nada depende do produto: o DELETE
    -- é físico e o cascade cuida de store_product_sessions e store_product_audit.
    delete from public.store_products where id = p_product_id;
    return product_row;
  end if;

  -- Com histórico a linha precisa continuar existindo. O slug é liberado no
  -- mesmo passo para o coach poder recriar um produto com o mesmo título.
  previous_row := product_row;

  update public.store_products
  set deleted_at = now(),
      slug = previous_row.slug || '-excluido-' || replace(p_product_id::text, '-', '')
  where id = p_product_id
  returning * into product_row;

  insert into public.store_product_audit (product_id, actor_id, action, previous_value, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_DELETED', to_jsonb(previous_row), to_jsonb(product_row));

  return product_row;
end;
$$;

comment on function public.delete_store_product(uuid) is
  'Exclui um produto do coach: DELETE físico quando não há histórico e soft-delete (deleted_at) quando pedidos, acessos, versões ou entregas já dependem dele. Não existe caminho de "arquivar".';

-- "Arquivar" sai do catálogo de RPCs: nenhum cliente pode mais alcançar o estado.
drop function if exists public.archive_store_product(uuid);

-- ---------------------------------------------------------------------------
-- 5. Editar não despublica
-- ---------------------------------------------------------------------------
-- Mesma função da Story 1.33, com duas diferenças: o `status = 'draft'` sai do
-- UPDATE (o status vigente é preservado, inclusive `published`) e o bloqueio
-- deixa de olhar o estado 'archived', que não existe mais, para olhar a
-- exclusão real.

create or replace function public.update_store_training_program(
  p_product_id uuid, p_title text, p_slug text, p_description text, p_short_description text, p_cover_image_url text,
  p_price_cents integer, p_category public.store_product_category, p_objective text, p_level public.store_product_level,
  p_duration_weeks integer, p_schedule jsonb
) returns public.store_products language plpgsql security definer set search_path = public
as $$
declare previous_row public.store_products%rowtype; product_row public.store_products%rowtype; day_json jsonb; template_id uuid; week_value integer; day_value integer; day_type_value text;
begin
  select * into previous_row from public.store_products where id = p_product_id and (seller_coach_id = auth.uid() or public.is_platform_owner());
  if previous_row.id is null or previous_row.deleted_at is not null then raise exception using message = 'Produto não encontrado ou não autorizado.'; end if;
  if char_length(btrim(p_title)) < 2 or char_length(btrim(p_short_description)) < 8 or char_length(btrim(p_objective)) < 2 or p_price_cents is null or p_price_cents <= 0 then raise exception using message = 'Preencha os dados comerciais válidos.'; end if;
  if p_duration_weeks is null or p_duration_weeks < 1 or jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) <> p_duration_weeks * 7 then raise exception using message = 'A duração precisa gerar os 7 dias de cada semana.'; end if;
  -- `status` fora do SET: editar um produto publicado não pode derrubar a venda
  -- ativa nem exigir nova aprovação. A versão já publicada continua imutável.
  update public.store_products set title = btrim(p_title), slug = lower(btrim(p_slug)), description = coalesce(btrim(p_description), ''), short_description = btrim(p_short_description), cover_image_url = nullif(btrim(p_cover_image_url), ''), price_cents = p_price_cents, category = p_category, objective = btrim(p_objective), level = p_level, duration_weeks = p_duration_weeks where id = p_product_id returning * into product_row;
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

comment on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) is
  'Reescreve os dados comerciais e a grade do programa preservando o status vigente: um produto publicado continua publicado e à venda depois da edição.';

-- ---------------------------------------------------------------------------
-- 6. O guarda de exclusão vale para todas as RPCs de escrita
-- ---------------------------------------------------------------------------
-- O soft-delete não mexe em `status`: um produto publicado e excluído continua
-- `published`. Toda RPC de escrita que localiza o produto por `status` — e não pela
-- exclusão — continuaria operando sobre uma linha excluída. As três abaixo criam
-- estado novo a partir do produto e por isso recebem `deleted_at is null`:
--
--   * create_training_program_delivery — insere em `training_program_deliveries`,
--     criando uma nova referência "on delete restrict" contra a linha excluída, e
--     concede acesso a atletas a um programa que o próprio coach acabou de excluir;
--   * approve_store_product — cria uma linha em `store_program_versions`, que é a
--     mesma classe de referência nova contra linha excluída;
--   * submit_store_product_review — devolve à fila de moderação um produto que já
--     não existe para o coach.
--
-- `reject_store_product` fica de fora deliberadamente: ele só move `review → draft`,
-- não cria referência nenhuma e, com o guarda em `submit`, um produto excluído não
-- alcança mais `review`. `get_coach_store_product_schedule` também fica de fora por
-- ser leitura pura, sem efeito de estado.
--
-- As três funções são cópias fiéis das versões de 20260819100000 (e 20260817100000,
-- no caso de approve) com uma única linha de diferença; o rollback restaura as
-- originais.

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
  select * into product_row from public.store_products where id = p_product_id and status = 'published' and deleted_at is null;
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

comment on function public.create_training_program_delivery(uuid, uuid, uuid, date) is
  'Entrega manual do coach a partir da última versão imutável. Recusa produto excluído: entregar um produto soft-deletado criaria uma nova FK "on delete restrict" contra uma linha que o coach já removeu do catálogo.';

create or replace function public.submit_store_product_review(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare product_row public.store_products%rowtype;
begin
  select * into product_row from public.store_products where id = p_product_id and seller_coach_id = auth.uid() and deleted_at is null;
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
  select * into product_row from public.store_products where id = p_product_id and status = 'review' and deleted_at is null for update;
  if product_row.id is null then raise exception using message = 'Produto não encontrado ou fora da fila de análise.'; end if;
  version_id := public.create_store_program_version_internal(p_product_id, auth.uid());
  update public.store_products set status = 'published' where id = p_product_id returning * into product_row;
  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_APPROVED', jsonb_build_object('product', to_jsonb(product_row), 'version_id', version_id));
  return product_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Leitura: produto excluído some de todas as portas
-- ---------------------------------------------------------------------------

drop policy if exists "published products are readable" on public.store_products;
create policy "published products are readable"
on public.store_products for select to authenticated
using (
  (deleted_at is null and (status = 'published' or seller_coach_id = auth.uid()))
  or public.is_platform_owner()
);

drop function if exists public.list_coach_store_products();
create function public.list_coach_store_products()
returns table (
  id uuid, seller_coach_id uuid, type public.store_product_type, title text, slug text,
  description text, short_description text, cover_image_url text, session_template_id uuid,
  price_cents integer, category public.store_product_category, objective text,
  level public.store_product_level, duration_weeks integer, status public.store_product_status,
  has_history boolean, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select product_row.id, product_row.seller_coach_id, product_row.type, product_row.title, product_row.slug,
    product_row.description, product_row.short_description, product_row.cover_image_url,
    (select session_template_id from public.store_product_sessions where product_id = product_row.id and day_type = 'training' order by week_number, day_number limit 1),
    product_row.price_cents, product_row.category, product_row.objective, product_row.level,
    product_row.duration_weeks, product_row.status,
    public.store_product_has_history(product_row.id),
    product_row.created_at, product_row.updated_at
  from public.store_products product_row
  where (product_row.seller_coach_id = auth.uid() or public.is_platform_owner())
    and product_row.deleted_at is null
  order by product_row.updated_at desc;
$$;

comment on function public.list_coach_store_products() is
  'Catálogo do coach sem produtos excluídos. `has_history` indica que a exclusão preservará o histórico em vez de apagar o produto.';

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
  where product_row.status = 'published' and product_row.deleted_at is null
    and (p_category is null or product_row.category = p_category)
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
  where product_row.slug = lower(btrim(p_slug)) and product_row.deleted_at is null
    and (product_row.status = 'published' or product_row.seller_coach_id = auth.uid() or public.is_platform_owner());
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
    and product_row.deleted_at is null
  order by product_row.updated_at asc;
$$;

-- ---------------------------------------------------------------------------
-- 8. Permissões
-- ---------------------------------------------------------------------------
-- store_product_has_history não recebe grant: ela só é chamada de dentro de
-- outras funções security definer.
-- `create or replace function` preserva a ACL existente; os revoke/grant abaixo são
-- repetidos por explicitude, para que a migration descreva sozinha quem executa o quê.

revoke all on function public.store_product_has_history(uuid) from public;
revoke all on function public.delete_store_product(uuid) from public;
revoke all on function public.list_coach_store_products() from public;
revoke all on function public.list_store_products(public.store_product_category) from public;
revoke all on function public.get_store_product(text) from public;
revoke all on function public.list_store_products_for_review() from public;
revoke all on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) from public;
revoke all on function public.create_training_program_delivery(uuid, uuid, uuid, date) from public;
revoke all on function public.submit_store_product_review(uuid) from public;
revoke all on function public.approve_store_product(uuid) from public;

grant execute on function public.delete_store_product(uuid) to authenticated;
grant execute on function public.list_coach_store_products() to authenticated;
grant execute on function public.list_store_products(public.store_product_category) to authenticated;
grant execute on function public.get_store_product(text) to authenticated;
grant execute on function public.list_store_products_for_review() to authenticated;
grant execute on function public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb) to authenticated;
grant execute on function public.create_training_program_delivery(uuid, uuid, uuid, date) to authenticated;
grant execute on function public.submit_store_product_review(uuid) to authenticated;
grant execute on function public.approve_store_product(uuid) to authenticated;

notify pgrst, 'reload schema';
