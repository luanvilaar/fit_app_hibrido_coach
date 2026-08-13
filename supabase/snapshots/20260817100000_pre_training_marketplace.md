# Snapshot pré-migration — Marketplace de treinos

Data: 2026-08-13

## Estado esperado antes da migration

O banco possui a biblioteca de treinos (`session_templates`, `session_blocks`, `block_items`,
`prescriptions` e `prescription_sets`), financeiro do coach, conexão Mercado Pago e intenções de
pagamento das cobranças. Não possui catálogo de produtos, pedidos de loja, acessos de programas ou
intenções de pagamento de produtos.

## Objetos adicionados pela migration

- Enums `store_product_type`, `store_product_status`, `store_product_category`,
  `store_product_level` e `store_order_status`.
- Tabelas `store_products`, `store_product_sessions`, `store_product_audit`, `store_orders`,
  `store_order_items`, `store_payment_intents` e `training_program_access`.
- RPCs de catálogo, gestão de produtos, vendas e liquidação idempotente do pedido.

## Rollback

`supabase/rollback/20260817100000_training_marketplace.sql` remove os objetos acima. Exportar
pedidos, intenções, acessos e auditoria antes de executar em produção.
