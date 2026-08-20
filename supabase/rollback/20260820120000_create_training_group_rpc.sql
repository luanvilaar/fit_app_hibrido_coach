-- Rollback de 20260820120000_create_training_group_rpc.sql.

drop function if exists public.create_training_group(text, text, public.training_group_level, text);
