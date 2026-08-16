# Snapshot pré-migration — programas estruturados e entregas

Esta migration depende do catálogo criado por `20260817100000_training_marketplace.sql` e do hardening
de `20260818100000_security_hardening.sql`.

## Objetos adicionados

- `store_program_versions`
- `training_program_deliveries`
- `training_program_delivery_sessions`
- `store_product_sessions.is_rest_day`
- `training_program_access.version_id`
- `training_program_access.delivery_id`
- `session_instances.program_delivery_session_id`

## Funções adicionadas ou substituídas

- `get_coach_store_product_schedule`
- `validate_store_program_schedule`
- `create_store_training_program`
- `update_store_training_program`
- `create_store_program_version_internal`
- `create_training_program_delivery`
- `grant_store_program_delivery`
- `populate_program_delivery_sessions`
- `approve_store_product`
- `settle_store_order`
- `list_my_training_programs`

## Risco operacional

O rollback remove versões e entregas e pode remover as sessões associadas por cascata. Não executar em
produção sem exportação e aprovação operacional.
