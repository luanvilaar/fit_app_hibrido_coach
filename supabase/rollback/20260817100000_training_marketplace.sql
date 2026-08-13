-- Rollback do marketplace de treinos (20260817100000_training_marketplace.sql).
-- Execute somente após exportar pedidos, pagamentos e acessos: esta operação remove dados
-- comerciais e não deve ser feita como correção casual em produção.

drop function if exists public.settle_store_order(text, integer, timestamptz);
drop function if exists public.archive_store_product(uuid);
drop function if exists public.reject_store_product(uuid, text);
drop function if exists public.approve_store_product(uuid);
drop function if exists public.submit_store_product_review(uuid);
drop function if exists public.update_store_training_product(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid);
drop function if exists public.create_store_training_product(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, uuid);
drop function if exists public.list_coach_store_sales();
drop function if exists public.list_my_training_programs();
drop function if exists public.list_my_store_orders();
drop function if exists public.list_store_products_for_review();
drop function if exists public.list_coach_store_products();
drop function if exists public.get_store_product(text);
drop function if exists public.list_store_products(public.store_product_category);

drop table if exists public.training_program_access;
drop table if exists public.store_payment_intents;
drop table if exists public.store_order_items;
drop table if exists public.store_orders;
drop table if exists public.store_product_audit;
drop table if exists public.store_product_sessions;
drop table if exists public.store_products;

drop type if exists public.store_order_status;
drop type if exists public.store_product_level;
drop type if exists public.store_product_category;
drop type if exists public.store_product_status;
drop type if exists public.store_product_type;
