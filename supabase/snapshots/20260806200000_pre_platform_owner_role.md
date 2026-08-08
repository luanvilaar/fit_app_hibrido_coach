# Snapshot pré-`20260806200000_platform_owner_role`

## Dependências

- `20260805120000_coach_training_flow.sql` (tabela `team_members`, enum `team_member_role`)
- `20260806120000_user_roles_gating.sql` (`is_coach()`, `is_athlete()`, `current_user_roles()`)

## Mudanças

- `public.platform_owners` — nova tabela, papel global de plataforma, independente de `team_members`.
- `public.is_platform_owner()` — predicado `security definer`, mesmo padrão de `is_coach()`/`is_athlete()`.
- Policy "owners can read platform owners" — somente owners leem a própria lista; sem insert/update/delete via client (promoção só por migration, sem UI de convite ainda).
- `current_user_roles()` substituída: passa a incluir `is_owner` e agrega `'owner'` ao array `roles` quando aplicável.
- Seed: promove `l.vilaar@gmail.com` a owner, se a conta já existir em `auth.users` no ambiente onde a migration rodar.

## Notas

- Nenhuma tabela de papel por equipe foi alterada; `coach`/`athlete` continuam derivados de `team_members` sem mudança de comportamento.
- `is_platform_owner()` é `security definer` para ser chamada por `current_user_roles()` (`security invoker`) sem exigir que o próprio usuário tenha permissão de leitura direta em `platform_owners`.
- Escopo intencionalmente restrito ao modelo de permissão: convite de treinadores e gestão de loja ficam para stories futuras.

## Rollback

Executar `supabase/rollback/20260806200000_platform_owner_role.sql`.
