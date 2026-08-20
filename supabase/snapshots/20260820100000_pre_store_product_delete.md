# Snapshot pré-migration — exclusão de produtos e edição sem despublicar

Esta migration depende do catálogo criado por `20260817100000_training_marketplace.sql` e das versões,
entregas e RPCs de `20260819100000_training_program_versions_delivery.sql`.

## Estado antes desta migration

- `store_products` não possui coluna de exclusão. A única forma de tirar um produto do ar é
  `archive_store_product(p_product_id)`, que só faz `update store_products set status = 'archived'`.
- Não existe função de DELETE nem policy de DELETE em `store_products`.
- `store_order_items.product_id`, `training_program_access.product_id`, `store_program_versions.product_id`
  e `training_program_deliveries.product_id` são `on delete restrict`; `store_product_sessions.product_id`
  e `store_product_audit.product_id` são `on delete cascade`.
- `update_store_training_program(...)` força `status = 'draft'` em toda edição e recusa produtos `archived`.
- `list_coach_store_products()` devolve 17 colunas e lista qualquer produto do coach.
- `training_program_deliveries` tem índices por `team_id`, `athlete_id` e `version_id`, mas **nenhum**
  por `product_id` — ao contrário das outras três tabelas que referenciam `store_products`
  (`store_order_items_product_idx`, `training_program_access_product_idx`,
  `store_program_versions_product_idx`).
- `create_training_program_delivery`, `submit_store_product_review` e `approve_store_product` localizam
  o produto apenas por `status`.

## Objetos adicionados

- `store_products.deleted_at` (soft-delete)
- `training_program_deliveries_product_idx` — índice em `training_program_deliveries(product_id)`,
  o que faltava para `store_product_has_history` não cair em seq scan
- `store_product_has_history(uuid)` — função interna, sem grant para `authenticated`
- `delete_store_product(uuid)` — RPC de exclusão exposto ao coach

Nenhum índice novo é criado para o filtro `deleted_at is null`: `store_products_seller_idx`
(`seller_coach_id, status, updated_at desc`) já cobre as mesmas colunas, e um índice parcial
sobre elas seria uma cópia com custo de escrita dobrado — o predicado real da listagem do coach
(`seller_coach_id = auth.uid() or public.is_platform_owner()`) não usa índice de qualquer forma.

## Objetos substituídos

- `update_store_training_program(uuid, text, text, text, text, text, integer, store_product_category, text, store_product_level, integer, jsonb)`
  — preserva o status vigente e passa a bloquear por `deleted_at`
- `create_training_program_delivery(uuid, uuid, uuid, date)` — passa a exigir `deleted_at is null`
- `submit_store_product_review(uuid)` — passa a exigir `deleted_at is null`
- `approve_store_product(uuid)` — passa a exigir `deleted_at is null`
- `list_coach_store_products()` — ganha `has_history` e filtra excluídos (18 colunas)
- `list_store_products(store_product_category)` — filtra excluídos
- `get_store_product(text)` — filtra excluídos
- `list_store_products_for_review()` — filtra excluídos
- policy `"published products are readable"` em `store_products` — filtra excluídos

## Objetos removidos

- `archive_store_product(uuid)`

## Dados alterados

- Todo `store_products` com `status = 'archived'` passa a `status = 'draft'`, com uma linha
  `PRODUCT_ARCHIVED_CONVERTED_TO_DRAFT` em `store_product_audit` por produto convertido.

## Risco operacional

- O rollback **volta a expor produtos excluídos por soft-delete** (o filtro deixa de existir junto com a
  coluna). Exportar `id, title, slug, deleted_at` de `store_products` antes de executar o rollback.
- **Slug mutilado no soft-delete.** Excluir um produto com histórico troca o slug por
  `<slug>-excluido-<uuid>` e guarda o original em `store_product_audit.previous_value` da ação
  `PRODUCT_DELETED` — essa linha de auditoria passa a ser a **única** cópia sobrevivente do slug
  original. O rollback restaura o slug a partir dela (passo 4b) **antes** de apagar a auditoria; se
  essas linhas forem removidas manualmente antes do rollback, o produto volta ao catálogo com o slug
  quebrado, `get_store_product(p_slug)` deixa de encontrá-lo pelo endereço original e não há como
  recuperar. Se o slug original já tiver sido reaproveitado por um produto criado depois da exclusão,
  o passo 4b viola o índice único de `slug`: renomear um dos dois manualmente e reexecutar.
- O rollback reverte a conversão de `archived` usando a própria trilha de auditoria; se as linhas
  `PRODUCT_ARCHIVED_CONVERTED_TO_DRAFT` forem apagadas manualmente antes, a reversão não acontece.
- A exclusão física só ocorre para produtos sem pedido, acesso, versão ou entrega — nenhum registro de
  histórico de aluno é apagado por esta migration.
- O rollback também devolve `create_training_program_delivery`, `submit_store_product_review` e
  `approve_store_product` às versões sem o guarda de `deleted_at`, o que é obrigatório: a coluna
  deixa de existir no passo 5.
