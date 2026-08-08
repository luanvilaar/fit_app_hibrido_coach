# Snapshot pré-`20260806120000_user_roles_gating`

## Dependências

- `20260805120000_coach_training_flow.sql` (tabela `team_members`, enum `team_member_role`)

## Mudanças

- `public.is_coach()` — predicado reutilizável para policies e RPCs.
- `public.is_athlete()` — predicado reutilizável para policies e RPCs.
- `public.current_user_roles()` — RPC que devolve o modelo de papéis do usuário autenticado
  (`roles`, `is_coach`, `is_athlete`, `coach_team_ids`, `athlete_team_ids`).

## Notas

- Nenhuma tabela nova: o papel é derivado de `public.team_members`, mantendo uma única fonte de verdade.
- `current_user_roles()` é `security invoker`; a leitura respeita a policy "team members can read membership".
- Execução concedida apenas ao papel `authenticated`.

## Rollback

Executar `supabase/rollback/20260806120000_user_roles_gating.sql`.
