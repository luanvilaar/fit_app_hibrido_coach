# Snapshot pré-`20260806220000_session_template_library`

## Dependências

- `20260805120000_coach_training_flow.sql` (`session_templates`, `session_blocks`, `block_items`, `prescriptions`, `prescription_sets`, `create_session_template_with_content`, `owns_session_template`)
- `20260806160000_session_instance_management.sql` (`build_template_snapshot`, reaproveitado aqui)

## Mudanças

- `public.insert_template_blocks(uuid, jsonb)` — extrai a inserção de blocos/exercícios/prescrições/séries que estava embutida em `create_session_template_with_content`, para ser reusada pela edição in-place.
- `create or replace` de `public.create_session_template_with_content` consumindo o helper (comportamento e contrato idênticos — mesma assinatura, mesmas mensagens de erro).
- `public.get_session_template_content(uuid)` — devolve título, status e blocos de um template (via `build_template_snapshot` + status), restrito ao dono do template.
- `public.update_session_template_content(uuid, text, jsonb, session_status)` — apaga e recria o conteúdo do próprio template (mesmo `template_id`), restrito ao dono do template.

## Decisões

- **Editar o template muta o próprio registro**, ao contrário de `update_session_instance` (Story 1.15), que cria um template novo a cada edição. São operações conceitualmente diferentes: a Story 1.15 edita uma *sessão já publicada no calendário de uma equipe* (o template ali é um detalhe de implementação, nunca reaproveitado de propósito); esta migration edita um *treino da biblioteca*, que é reaproveitado de propósito — sessões já aplicadas a partir dele leem o `snapshot` congelado em `session_instances`, nunca o template ao vivo, então mutar o template não as afeta retroativamente.
- **`insert_template_blocks` roda com os mesmos privilégios de antes.** A extração não muda o comportamento de `create_session_template_with_content`: mesmas validações, mesmas mensagens, mesma criação de exercício sob demanda por slug.
- **Sem RPC de exclusão dedicada.** `delete_session_template` não existe: o repositório TypeScript chama `delete` direto em `session_templates` (a policy `"coaches can manage owned templates"` já cobre `delete`); a constraint `session_instances.template_id on delete restrict` barra a exclusão de um template já aplicado, e o erro de chave estrangeira é traduzido pelo client.

## Riscos conhecidos

- Nenhuma sessão de calendário passa a usar `update_session_template_content`: o fluxo de edição de instância (Story 1.15) continua chamando `create_session_template_with_content` para gerar um template novo por edição, sem mudança de comportamento.

## Rollback

Executar `supabase/rollback/20260806220000_session_template_library.sql`, que remove as duas RPCs novas da biblioteca e restaura `create_session_template_with_content` com a inserção embutida (versão pré-`20260806160000`... na verdade idêntica à da Story 1.4, já que a Story 1.15 nunca alterou esta função).
