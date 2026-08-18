# Snapshot pré-migration — programas estruturados e entregas

Esta migration depende do catálogo criado por `20260817100000_training_marketplace.sql` e do hardening
de `20260818100000_security_hardening.sql`.

## Objetos adicionados

- `store_program_versions`
- `training_program_deliveries`
- `training_program_delivery_sessions`
- `store_product_sessions.is_rest_day`
- `store_product_sessions.day_type` (`training`, `rest`, `recovery`, `assessment`, `unprogrammed`)
- `store_products.objective` e duração obrigatória para programas de treino
- `store_orders.program_start_date` (escolhida antes do webhook e usada na instância)
- `store_orders.program_version_id` (versão imutável congelada antes da abertura do PIX)
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
- `list_athlete_calendar_entries`
- `list_store_products`
- `get_store_product`
- `list_coach_store_products`

## Risco operacional

O rollback remove versões e entregas e pode remover as sessões associadas por cascata. Ele também remove
o objetivo comercial, o tipo de dia, a versão e a data inicial persistida de pedidos. Não executar em produção sem
exportação e aprovação operacional.
