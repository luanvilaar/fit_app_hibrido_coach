-- Rollback deliberadamente destrutivo: execute somente em ambiente autorizado,
-- após exportar os dados de programas, versões e entregas.

alter table public.training_program_access drop column if exists delivery_id;
alter table public.training_program_access drop column if exists version_id;
alter table public.store_orders drop column if exists program_start_date;
alter table public.store_orders drop column if exists program_version_id;
alter table public.session_instances drop column if exists program_delivery_session_id;
drop table if exists public.training_program_delivery_sessions cascade;
drop table if exists public.training_program_deliveries cascade;
drop table if exists public.store_program_versions cascade;

alter table public.store_product_sessions drop constraint if exists store_product_sessions_template_for_day_type_check;
alter table public.store_product_sessions drop constraint if exists store_product_sessions_day_type_check;
alter table public.store_product_sessions drop column if exists day_type;
delete from public.store_product_sessions where session_template_id is null;
alter table public.store_product_sessions drop column if exists is_rest_day;
alter table public.store_product_sessions alter column session_template_id set not null;
alter table public.store_product_sessions drop constraint if exists store_product_sessions_day_number_check;
alter table public.store_product_sessions
  add constraint store_product_sessions_day_number_check check (day_number > 0);
alter table public.store_product_sessions
  add constraint store_product_sessions_product_id_session_template_id_key unique (product_id, session_template_id);

alter table public.store_products drop constraint if exists store_products_training_program_duration_check;
alter table public.store_products drop constraint if exists store_products_training_program_objective_check;
alter table public.store_products drop column if exists objective;

drop function if exists public.get_coach_store_product_schedule(uuid);
drop function if exists public.validate_store_program_schedule(uuid);
drop function if exists public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb);
drop function if exists public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb);
drop function if exists public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb);
drop function if exists public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, text, public.store_product_level, integer, jsonb);
drop function if exists public.create_store_program_version_internal(uuid, uuid);
drop function if exists public.create_training_program_delivery(uuid, uuid, uuid, date);
drop function if exists public.grant_store_program_delivery(uuid, uuid, uuid, uuid, date);
drop function if exists public.populate_program_delivery_sessions(uuid);
drop function if exists public.get_store_product(text);
drop function if exists public.list_store_products(public.store_product_category);
drop function if exists public.list_coach_store_products();
drop function if exists public.list_athlete_calendar_entries(date, date);
