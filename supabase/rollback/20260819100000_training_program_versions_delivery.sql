-- Rollback deliberadamente destrutivo: execute somente em ambiente autorizado,
-- após exportar os dados de programas, versões e entregas.

alter table public.training_program_access drop column if exists delivery_id;
alter table public.training_program_access drop column if exists version_id;
alter table public.session_instances drop column if exists program_delivery_session_id;
drop table if exists public.training_program_delivery_sessions cascade;
drop table if exists public.training_program_deliveries cascade;
drop table if exists public.store_program_versions cascade;

alter table public.store_product_sessions drop constraint if exists store_product_sessions_template_or_rest_check;
delete from public.store_product_sessions where session_template_id is null;
alter table public.store_product_sessions drop column if exists is_rest_day;
alter table public.store_product_sessions alter column session_template_id set not null;
alter table public.store_product_sessions drop constraint if exists store_product_sessions_day_number_check;
alter table public.store_product_sessions
  add constraint store_product_sessions_day_number_check check (day_number > 0);
alter table public.store_product_sessions
  add constraint store_product_sessions_product_id_session_template_id_key unique (product_id, session_template_id);

drop function if exists public.get_coach_store_product_schedule(uuid);
drop function if exists public.validate_store_program_schedule(uuid);
drop function if exists public.create_store_training_program(text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb);
drop function if exists public.update_store_training_program(uuid, text, text, text, text, text, integer, public.store_product_category, public.store_product_level, integer, jsonb);
drop function if exists public.create_store_program_version_internal(uuid, uuid);
drop function if exists public.create_training_program_delivery(uuid, uuid, uuid, date);
drop function if exists public.grant_store_program_delivery(uuid, uuid, uuid, uuid, date);
drop function if exists public.populate_program_delivery_sessions(uuid);
