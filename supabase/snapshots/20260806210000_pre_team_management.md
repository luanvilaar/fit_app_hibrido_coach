# Snapshot pré-`20260806210000_team_management`

## Dependências

- `20260805120000_coach_training_flow.sql` (`teams`, `team_members`, `is_team_member`, `is_team_coach`, `add_team_creator_as_coach`)
- `20260806120000_user_roles_gating.sql` (`is_coach`/`is_athlete` derivados de `team_members`, consumidos pelo gate de rota do coach)

## Mudanças

- `public.list_coach_teams_with_member_counts()` — mesma base de `list_coach_teams` (Story 1.9), agregando contagem de coaches e atletas por equipe para a tela de lista.
- `public.list_team_members(uuid)` — lista os membros de uma equipe com e-mail (join com `auth.users`), restrito a quem já é membro da equipe.
- `public.add_team_member_by_email(uuid, text, team_member_role)` — adiciona um usuário existente à equipe pelo e-mail, restrito a coach da equipe.
- `public.guard_team_last_coach()` + trigger `team_members_guard_last_coach` (`before delete or update` em `team_members`) — impede remover ou rebaixar o último coach de uma equipe.

## Decisões

- **Leitura de `auth.users` via `security definer`.** O client não tem acesso a `auth.users`; não existe (nem deveria ser criada só para isso) uma tabela `profiles` pública. As duas funções seguem o mesmo padrão de `is_coach()`/`is_platform_owner()`: `security definer` para operar com um privilégio que o client não tem.
- **Convite exige conta existente.** `add_team_member_by_email` não cria usuário nem envia convite por e-mail — apenas vincula uma conta já cadastrada. Fluxo de convite para quem ainda não tem conta fica fora de escopo (seria uma feature de auth, não de gestão de equipe).
- **Guarda do último coach generaliza uma invariante existente.** `add_team_creator_as_coach` já garante que toda equipe nasce com um coach; o trigger novo garante que ela nunca fica sem nenhum, seja por remoção (`delete`) ou por troca de papel (`update` de `role`).
- **Nenhuma RPC nova para editar equipe, excluir equipe ou remover membro.** As policies `"team coaches can update teams"`, `"team coaches can archive teams"` e `"team coaches can remove membership"` já autorizam essas operações via `update`/`delete` direto do client desde a Story 1.4.

## Riscos conhecidos

- Excluir uma equipe apaga em cascata `team_members` e `session_instances` (FK `on delete cascade`), incluindo sessões já publicadas para os atletas. A UI precisa avisar isso explicitamente antes da confirmação.

## Rollback

Executar `supabase/rollback/20260806210000_team_management.sql`, que remove o trigger e as três funções novas.
