-- Marketplace de treinos: catálogo, pedidos, intenções PIX e acesso ao conteúdo.
--
-- O catálogo é separado da biblioteca de sessões. Um produto aponta para templates existentes
-- através de `store_product_sessions`; assim a compra não duplica o modelo de treino já usado pelo
-- Coach Híbrido. Pedido pendente não concede acesso e intenção de pagamento não é receita.

create type public.store_product_type as enum ('physical', 'training_program');
create type public.store_product_status as enum ('draft', 'review', 'published', 'archived');
create type public.store_product_category as enum (
  'strength',
  'hybrid',
  'running',
  'gymnastics',
  'weightlifting',
  'conditioning',
  'other'
);
create type public.store_product_level as enum ('beginner', 'intermediate', 'advanced', 'all');
create type public.store_order_status as enum ('pending', 'paid', 'refunded', 'cancelled');

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  seller_coach_id uuid not null references auth.users(id) on delete restrict,
  type public.store_product_type not null default 'training_program',
  title text not null check (char_length(btrim(title)) >= 2),
  slug text not null unique check (slug = lower(slug) and char_length(btrim(slug)) >= 2),
  description text not null default '',
  short_description text not null default '',
  cover_image_url text,
  price_cents integer not null check (price_cents > 0),
  category public.store_product_category not null default 'other',
  level public.store_product_level not null default 'all',
  duration_weeks integer check (duration_weeks is null or duration_weeks > 0),
  status public.store_product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index store_products_published_idx
  on public.store_products(status, category, created_at desc);
create index store_products_seller_idx
  on public.store_products(seller_coach_id, status, updated_at desc);

create trigger store_products_set_updated_at
before update on public.store_products
for each row execute procedure public.set_updated_at();

-- Um dia de um programa reutiliza uma sessão já existente na biblioteca do próprio coach.
create table public.store_product_sessions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  session_template_id uuid not null references public.session_templates(id) on delete restrict,
  week_number integer not null check (week_number > 0),
  day_number integer not null check (day_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, week_number, day_number),
  unique (product_id, session_template_id)
);

create index store_product_sessions_product_idx
  on public.store_product_sessions(product_id, week_number, day_number);

create trigger store_product_sessions_set_updated_at
before update on public.store_product_sessions
for each row execute procedure public.set_updated_at();

-- Auditoria de criação, revisão, aprovação, rejeição e arquivamento do catálogo.
create table public.store_product_audit (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(btrim(action)) >= 2),
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index store_product_audit_product_idx
  on public.store_product_audit(product_id, created_at desc);

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_coach_id uuid not null references auth.users(id) on delete restrict,
  total_amount_cents integer not null check (total_amount_cents > 0),
  payment_provider public.payment_provider not null default 'mercado_pago',
  provider_payment_id text,
  status public.store_order_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index store_orders_buyer_idx on public.store_orders(buyer_id, created_at desc);
create index store_orders_seller_idx on public.store_orders(seller_coach_id, status, created_at desc);
create unique index store_orders_provider_payment_unique
  on public.store_orders(payment_provider, provider_payment_id)
  where provider_payment_id is not null;

create trigger store_orders_set_updated_at
before update on public.store_orders
for each row execute procedure public.set_updated_at();

create table public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete restrict,
  quantity integer not null default 1 check (quantity = 1),
  unit_price_cents integer not null check (unit_price_cents > 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create index store_order_items_order_idx on public.store_order_items(order_id);
create index store_order_items_product_idx on public.store_order_items(product_id);

-- Intenção é tentativa, não receita. O webhook aprovado grava o pedido e libera o programa.
create table public.store_payment_intents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_coach_id uuid not null references auth.users(id) on delete restrict,
  provider public.payment_provider not null default 'mercado_pago',
  provider_payment_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  method public.payment_intent_method not null,
  status public.payment_intent_status not null default 'pending',
  qr_code text,
  qr_code_base64 text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index store_payment_intents_provider_unique
  on public.store_payment_intents(provider, provider_payment_id);
create unique index store_payment_intents_one_open_order
  on public.store_payment_intents(order_id)
  where status = 'pending';
create index store_payment_intents_order_idx on public.store_payment_intents(order_id);

create trigger store_payment_intents_set_updated_at
before update on public.store_payment_intents
for each row execute procedure public.set_updated_at();

create table public.training_program_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete restrict,
  order_id uuid not null references public.store_orders(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, product_id)
);

create index training_program_access_user_idx
  on public.training_program_access(user_id, revoked_at, granted_at desc);
create index training_program_access_product_idx
  on public.training_program_access(product_id, revoked_at);

-- ---------------------------------------------------------------------------
-- RLS: leitura é explícita; escrita passa por RPC ou service role do servidor.
-- ---------------------------------------------------------------------------

alter table public.store_products enable row level security;
create policy "published products are readable"
on public.store_products for select to authenticated
using (
  status = 'published'
  or seller_coach_id = auth.uid()
  or public.is_platform_owner()
);

alter table public.store_product_sessions enable row level security;
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

alter table public.store_product_audit enable row level security;
create policy "product parties can read product audit"
on public.store_product_audit for select to authenticated
using (
  public.is_platform_owner()
  or exists (
    select 1
    from public.store_products product_row
    where product_row.id = store_product_audit.product_id
      and product_row.seller_coach_id = auth.uid()
  )
);

alter table public.store_orders enable row level security;
create policy "order parties can read orders"
on public.store_orders for select to authenticated
using (buyer_id = auth.uid() or seller_coach_id = auth.uid() or public.is_platform_owner());

alter table public.store_order_items enable row level security;
create policy "order parties can read order items"
on public.store_order_items for select to authenticated
using (
  exists (
    select 1
    from public.store_orders order_row
    where order_row.id = store_order_items.order_id
      and (
        order_row.buyer_id = auth.uid()
        or order_row.seller_coach_id = auth.uid()
        or public.is_platform_owner()
      )
  )
);

alter table public.store_payment_intents enable row level security;
create policy "order parties can read store payment intents"
on public.store_payment_intents for select to authenticated
using (buyer_id = auth.uid() or seller_coach_id = auth.uid() or public.is_platform_owner());

alter table public.training_program_access enable row level security;
create policy "users can read own training access"
on public.training_program_access for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_owner()
  or exists (
    select 1
    from public.store_products product_row
    where product_row.id = training_program_access.product_id
      and product_row.seller_coach_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Read models
-- ---------------------------------------------------------------------------

create or replace function public.list_store_products(
  p_category public.store_product_category default null
)
returns table (
  id uuid,
  seller_coach_id uuid,
  seller_display_name text,
  type public.store_product_type,
  title text,
  slug text,
  short_description text,
  cover_image_url text,
  price_cents integer,
  category public.store_product_category,
  level public.store_product_level,
  duration_weeks integer,
  status public.store_product_status,
  created_at timestamptz
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
    product_row.short_description,
    product_row.cover_image_url,
    product_row.price_cents,
    product_row.category,
    product_row.level,
    product_row.duration_weeks,
    product_row.status,
    product_row.created_at
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where product_row.status = 'published'
    and (p_category is null or product_row.category = p_category)
  order by product_row.created_at desc;
$$;

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

create or replace function public.list_coach_store_products()
returns table (
  id uuid,
  seller_coach_id uuid,
  type public.store_product_type,
  title text,
  slug text,
  description text,
  short_description text,
  cover_image_url text,
  session_template_id uuid,
  price_cents integer,
  category public.store_product_category,
  level public.store_product_level,
  duration_weeks integer,
  status public.store_product_status,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    product_row.id,
    product_row.seller_coach_id,
    product_row.type,
    product_row.title,
    product_row.slug,
    product_row.description,
    product_row.short_description,
    product_row.cover_image_url,
    (
      select product_session_row.session_template_id
      from public.store_product_sessions product_session_row
      where product_session_row.product_id = product_row.id
      order by product_session_row.week_number, product_session_row.day_number
      limit 1
    ) as session_template_id,
    product_row.price_cents,
    product_row.category,
    product_row.level,
    product_row.duration_weeks,
    product_row.status,
    product_row.created_at,
    product_row.updated_at
  from public.store_products product_row
  where product_row.seller_coach_id = auth.uid()
  order by product_row.updated_at desc;
$$;

create or replace function public.list_store_products_for_review()
returns table (
  id uuid,
  seller_coach_id uuid,
  seller_display_name text,
  title text,
  slug text,
  price_cents integer,
  category public.store_product_category,
  level public.store_product_level,
  status public.store_product_status,
  updated_at timestamptz
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
    product_row.title,
    product_row.slug,
    product_row.price_cents,
    product_row.category,
    product_row.level,
    product_row.status,
    product_row.updated_at
  from public.store_products product_row
  join auth.users user_row on user_row.id = product_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = product_row.seller_coach_id
  where public.is_platform_owner()
    and product_row.status = 'review'
  order by product_row.updated_at asc;
$$;

create or replace function public.list_my_store_orders()
returns table (
  order_id uuid,
  product_id uuid,
  product_title text,
  seller_coach_id uuid,
  seller_display_name text,
  total_amount_cents integer,
  status public.store_order_status,
  created_at timestamptz,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    order_row.id,
    item_row.product_id,
    product_row.title,
    order_row.seller_coach_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))) as seller_display_name,
    order_row.total_amount_cents,
    order_row.status,
    order_row.created_at,
    order_row.paid_at
  from public.store_orders order_row
  join public.store_order_items item_row on item_row.order_id = order_row.id
  join public.store_products product_row on product_row.id = item_row.product_id
  join auth.users user_row on user_row.id = order_row.seller_coach_id
  left join public.profiles profile_row on profile_row.user_id = order_row.seller_coach_id
  where order_row.buyer_id = auth.uid()
  order by order_row.created_at desc;
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

create or replace function public.list_coach_store_sales()
returns table (
  product_id uuid,
  product_title text,
  sales_count bigint,
  gross_amount_cents bigint,
  buyer_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    product_row.id,
    product_row.title,
    count(order_row.id) filter (where order_row.status = 'paid') as sales_count,
    coalesce(sum(order_row.total_amount_cents) filter (where order_row.status = 'paid'), 0) as gross_amount_cents,
    count(distinct order_row.buyer_id) filter (where order_row.status = 'paid') as buyer_count
  from public.store_products product_row
  left join public.store_orders order_row
    on order_row.seller_coach_id = product_row.seller_coach_id
   and order_row.status = 'paid'
   and exists (
     select 1
     from public.store_order_items item_row
     where item_row.order_id = order_row.id
       and item_row.product_id = product_row.id
   )
  where product_row.seller_coach_id = auth.uid()
  group by product_row.id, product_row.title
  order by product_row.title;
$$;

-- ---------------------------------------------------------------------------
-- Coach and admin writes
-- ---------------------------------------------------------------------------

create or replace function public.create_store_training_product(
  p_title text,
  p_slug text,
  p_description text,
  p_short_description text,
  p_cover_image_url text,
  p_price_cents integer,
  p_category public.store_product_category,
  p_level public.store_product_level,
  p_duration_weeks integer,
  p_session_template_id uuid
)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.store_products%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not exists (
    select 1 from public.team_members
    where user_id = auth.uid() and role = 'coach'
  ) then
    raise exception using message = 'Somente coaches podem criar produtos.';
  end if;

  if p_session_template_id is null then
    raise exception using message = 'Selecione um treino da biblioteca para compor o programa.';
  end if;

  if not exists (
    select 1 from public.session_templates
    where id = p_session_template_id and created_by = auth.uid()
  ) then
    raise exception using message = 'O treino selecionado não pertence a você.';
  end if;

  insert into public.store_products (
    seller_coach_id,
    type,
    title,
    slug,
    description,
    short_description,
    cover_image_url,
    price_cents,
    category,
    level,
    duration_weeks
  )
  values (
    auth.uid(),
    'training_program',
    btrim(p_title),
    lower(btrim(p_slug)),
    coalesce(btrim(p_description), ''),
    coalesce(btrim(p_short_description), ''),
    nullif(btrim(p_cover_image_url), ''),
    p_price_cents,
    p_category,
    p_level,
    p_duration_weeks
  )
  returning * into product_row;

  insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number)
  values (product_row.id, p_session_template_id, 1, 1);

  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (product_row.id, auth.uid(), 'PRODUCT_CREATED', to_jsonb(product_row));

  return product_row;
end;
$$;

create or replace function public.update_store_training_product(
  p_product_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_short_description text,
  p_cover_image_url text,
  p_price_cents integer,
  p_category public.store_product_category,
  p_level public.store_product_level,
  p_duration_weeks integer,
  p_session_template_id uuid
)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_row public.store_products%rowtype;
  product_row public.store_products%rowtype;
begin
  select * into previous_row
  from public.store_products
  where id = p_product_id and seller_coach_id = auth.uid();

  if previous_row.id is null then
    raise exception using message = 'Produto não encontrado ou não autorizado.';
  end if;

  if previous_row.status = 'archived' then
    raise exception using message = 'Produto arquivado não pode ser editado.';
  end if;

  if not exists (
    select 1 from public.session_templates
    where id = p_session_template_id and created_by = auth.uid()
  ) then
    raise exception using message = 'O treino selecionado não pertence a você.';
  end if;

  update public.store_products
  set title = btrim(p_title),
      slug = lower(btrim(p_slug)),
      description = coalesce(btrim(p_description), ''),
      short_description = coalesce(btrim(p_short_description), ''),
      cover_image_url = nullif(btrim(p_cover_image_url), ''),
      price_cents = p_price_cents,
      category = p_category,
      level = p_level,
      duration_weeks = p_duration_weeks,
      status = case when status = 'published' then 'draft' else status end
  where id = p_product_id
  returning * into product_row;

  delete from public.store_product_sessions where product_id = p_product_id;
  insert into public.store_product_sessions (product_id, session_template_id, week_number, day_number)
  values (p_product_id, p_session_template_id, 1, 1);

  insert into public.store_product_audit (product_id, actor_id, action, previous_value, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_UPDATED', to_jsonb(previous_row), to_jsonb(product_row));

  return product_row;
end;
$$;

create or replace function public.submit_store_product_review(p_product_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.store_products%rowtype;
begin
  update public.store_products
  set status = 'review'
  where id = p_product_id
    and seller_coach_id = auth.uid()
    and status in ('draft', 'review')
  returning * into product_row;

  if product_row.id is null then
    raise exception using message = 'Produto não encontrado ou não pode ser enviado para análise.';
  end if;

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
declare
  product_row public.store_products%rowtype;
begin
  if not public.is_platform_owner() then
    raise exception using message = 'Somente administradores podem aprovar produtos.';
  end if;

  update public.store_products
  set status = 'published'
  where id = p_product_id and status = 'review'
  returning * into product_row;

  if product_row.id is null then
    raise exception using message = 'Produto não encontrado ou fora da fila de análise.';
  end if;

  insert into public.store_product_audit (product_id, actor_id, action, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_APPROVED', to_jsonb(product_row));

  return product_row;
end;
$$;

create or replace function public.reject_store_product(p_product_id uuid, p_reason text)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.store_products%rowtype;
begin
  if not public.is_platform_owner() then
    raise exception using message = 'Somente administradores podem rejeitar produtos.';
  end if;

  if char_length(btrim(p_reason)) < 3 then
    raise exception using message = 'O motivo da rejeição é obrigatório.';
  end if;

  update public.store_products
  set status = 'draft'
  where id = p_product_id and status = 'review'
  returning * into product_row;

  if product_row.id is null then
    raise exception using message = 'Produto não encontrado ou fora da fila de análise.';
  end if;

  insert into public.store_product_audit (product_id, actor_id, action, reason, new_value)
  values (p_product_id, auth.uid(), 'PRODUCT_REJECTED', btrim(p_reason), to_jsonb(product_row));

  return product_row;
end;
$$;

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

-- ---------------------------------------------------------------------------
-- Settlement do webhook: uma transação de servidor atualiza pedido e acesso.
-- ---------------------------------------------------------------------------

create or replace function public.settle_store_order(
  p_provider_payment_id text,
  p_amount_cents integer,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  intent_row public.store_payment_intents%rowtype;
  item_row public.store_order_items%rowtype;
  order_row public.store_orders%rowtype;
begin
  select * into intent_row
  from public.store_payment_intents
  where provider = 'mercado_pago'
    and provider_payment_id = p_provider_payment_id
  for update;

  if intent_row.id is null then
    raise exception using message = 'Intenção de compra não encontrada.';
  end if;

  if intent_row.amount_cents <> p_amount_cents then
    raise exception using message = 'O valor confirmado não corresponde ao pedido.';
  end if;

  select * into order_row
  from public.store_orders
  where id = intent_row.order_id
  for update;

  if order_row.id is null or order_row.status = 'cancelled' then
    raise exception using message = 'Pedido não encontrado ou cancelado.';
  end if;

  update public.store_payment_intents
  set status = 'approved'
  where id = intent_row.id;

  update public.store_orders
  set status = 'paid',
      provider_payment_id = p_provider_payment_id,
      paid_at = coalesce(p_paid_at, now())
  where id = order_row.id;

  select * into item_row
  from public.store_order_items
  where order_id = order_row.id
  limit 1;

  if item_row.id is null then
    raise exception using message = 'Pedido sem item de programa.';
  end if;

  insert into public.training_program_access (user_id, product_id, order_id)
  values (order_row.buyer_id, item_row.product_id, order_row.id)
  on conflict (user_id, product_id) do update
    set order_id = excluded.order_id,
        revoked_at = null;

  return order_row.id;
end;
$$;

revoke all on function public.list_store_products(public.store_product_category) from public;
revoke all on function public.get_store_product(text) from public;
revoke all on function public.list_coach_store_products() from public;
revoke all on function public.list_store_products_for_review() from public;
revoke all on function public.list_my_store_orders() from public;
revoke all on function public.list_my_training_programs() from public;
revoke all on function public.list_coach_store_sales() from public;
revoke all on function public.create_store_training_product(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid) from public;
revoke all on function public.update_store_training_product(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid) from public;
revoke all on function public.submit_store_product_review(uuid) from public;
revoke all on function public.approve_store_product(uuid) from public;
revoke all on function public.reject_store_product(uuid, text) from public;
revoke all on function public.archive_store_product(uuid) from public;
revoke all on function public.settle_store_order(text, integer, timestamptz) from public;

grant execute on function public.list_store_products(public.store_product_category) to authenticated;
grant execute on function public.get_store_product(text) to authenticated;
grant execute on function public.list_coach_store_products() to authenticated;
grant execute on function public.list_store_products_for_review() to authenticated;
grant execute on function public.list_my_store_orders() to authenticated;
grant execute on function public.list_my_training_programs() to authenticated;
grant execute on function public.list_coach_store_sales() to authenticated;
grant execute on function public.create_store_training_product(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid) to authenticated;
grant execute on function public.update_store_training_product(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid) to authenticated;
grant execute on function public.submit_store_product_review(uuid) to authenticated;
grant execute on function public.approve_store_product(uuid) to authenticated;
grant execute on function public.reject_store_product(uuid, text) to authenticated;
grant execute on function public.archive_store_product(uuid) to authenticated;
grant execute on function public.settle_store_order(text, integer, timestamptz) to service_role;

notify pgrst, 'reload schema';
