# Snapshot pré-`20260806160000_session_instance_management`

## Dependências

- `20260805120000_coach_training_flow.sql` (`session_instances`, `create_session_template_with_content`, `is_team_coach`)
- `20260805140000_athlete_calendar.sql` (coluna `state`)
- `20260805150000_coach_calendar_prescription.sql` (`create_and_apply_session_to_team`)

## Mudanças

- `public.build_template_snapshot(uuid)` — extrai a montagem do snapshot que estava embutida em
  `apply_session_template_to_team`, para ser reusada pela edição.
- `create or replace` de `public.apply_session_template_to_team` consumindo o helper (comportamento idêntico).
- `public.update_session_instance(uuid, text, jsonb, date, session_status)` — regrava conteúdo, data e
  status de uma sessão, atualizando o snapshot congelado da instância.
- `public.delete_session_instance(uuid)` — remove a sessão e o template que ficar órfão.

## Decisões

- **Editar cria template novo.** `update_session_instance` gera um template pelo
  `create_session_template_with_content` e repõe `session_instances.template_id`, em vez de mutar o
  template anterior — outras instâncias podem referenciá-lo. O template antigo é removido apenas se
  ficar sem nenhuma instância.
- **Ordem de exclusão.** `session_instances.template_id` é `on delete restrict`; por isso a instância
  é apagada primeiro e o template órfão em seguida.
- **Autorização por equipe.** Ambas exigem `is_team_coach(instance.team_id)`, o mesmo critério das
  policies `"team coaches can update/delete session instances"` já existentes.
- **Estado de execução preservado.** A coluna `state` não é tocada na edição.

## Riscos conhecidos

- Editar uma sessão que o atleta já iniciou reescreve o snapshot em execução. Hoje sem efeito prático:
  os resultados da Story 1.10 ainda não persistem e `state` nunca é gravado. Precisa ser revisto quando
  a execução do treino for persistida.

## Rollback

Executar `supabase/rollback/20260806160000_session_instance_management.sql`, que remove as duas RPCs
novas e restaura `apply_session_template_to_team` com o snapshot embutido.
