# Snapshot pré-`20260806180000_athlete_today_dashboard`

## Motivação

A aba Hoje era 100% dados locais. O banco tinha a camada de **prescrição** (`session_instances` +
snapshot congelado, RLS, `list_athlete_calendar`), mas nada de **execução por atleta**:
`session_instances.state` é da instância do time inteiro, não de cada atleta. Sem isso não existe
resumo semanal, sequência, estado de bloco, prontidão nem recado do coach.

## Dependências

- `20260805120000_coach_training_flow.sql` (`session_instances`, `set_updated_at`, `is_team_member`, `is_team_coach`)
- `20260805140000_athlete_calendar.sql` (publicação e leitura do calendário do atleta)
- `20260805150000_coach_calendar_prescription.sql` (`create_and_apply_session_to_team`)
- `20260806140000_exercise_video_catalog.sql` (`exercises.video_url`)
- `20260806160000_session_instance_management.sql` (`build_template_snapshot`, `update_session_instance`)

## Mudanças

### Estrutura

- `session_instances.coach_note text not null default ''` — recado do coach por instância.
- `public.athlete_session_state` — enum `started | completed | partially_completed | skipped`.
- `public.athlete_session_progress` — execução da sessão por atleta, com `completed_block_ids`.
- `public.athlete_set_results` — repetições e carga registradas por série.
- `public.athlete_daily_checkins` — sono, energia e dor com `readiness` como coluna gerada.

### Funções

- `build_template_snapshot` passa a congelar `exercise_slug` e `exercise_video_url`.
- `enrich_snapshot_media(jsonb)` — completa o vídeo pelo catálogo atual para sessões antigas.
- `apply_session_template_to_team`, `create_and_apply_session_to_team` e `update_session_instance`
  recriadas com `p_coach_note`.
- `start_athlete_session`, `complete_athlete_session`, `toggle_athlete_block`,
  `save_athlete_set_result`, `upsert_athlete_checkin`.
- `get_athlete_today(date)` — agregador da aba Hoje em uma chamada.
- `get_athlete_session_workout(uuid)` — sessão para execução, com mídia, progresso e resultados.

## Decisões

- **Progresso é por atleta, não por instância.** `session_instances.state` continua descrevendo a
  instância do time; o que a aba Hoje mostra vem de `athlete_session_progress`.
- **`block_item_id` sem FK.** Os resultados apontam para ids do snapshot congelado. Uma FK para
  `block_items` apagaria o histórico do atleta quando a edição da sessão substituísse o template.
- **Assinaturas recriadas com `drop`.** Adicionar `p_coach_note` com default tornaria ambígua a
  chamada com os 4 argumentos antigos; por isso as funções foram removidas e recriadas.
- **Prontidão derivada no banco.** `readiness` é coluna gerada de sono + energia + (6 − dor) / 3,
  então cliente e futuras queries leem o mesmo valor.
- **Dor é invertida.** `soreness_score` 1 = nenhuma dor, 5 = muita dor.
- **Sequência ignora o dia em aberto.** `get_athlete_today` só conta o dia de referência na sequência
  depois que ele é concluído, senão a sequência zeraria toda manhã.
- **Estimativa de duração fica no cliente.** A prescrição não tem tempo por série; a interface exibe
  "≈" para não vender precisão que o dado não tem.

## Riscos conhecidos

- **Edição de sessão em execução.** Risco registrado no snapshot anterior e agora tratado
  parcialmente: `update_session_instance` zera `completed_block_ids` da sessão, porque o snapshot novo
  tem outros ids de bloco. Os `athlete_set_results` do snapshot antigo permanecem gravados, mas deixam
  de aparecer na tela de execução — histórico preservado, exibição não.
- **Sessões anteriores a esta migration** não têm `exercise_video_url` no snapshot; o vídeo é
  resolvido em tempo de leitura por `enrich_snapshot_media`, que reflete o catálogo atual.
- **`get_athlete_today` assume uma sessão por dia.** Havendo mais de uma publicada na mesma data, a
  aba Hoje usa a mais antiga por `created_at`; o calendário continua listando todas.

## Rollback

Executar `supabase/rollback/20260806180000_athlete_today_dashboard.sql`. Ele **apaga** progresso,
resultados de série e check-ins, remove `coach_note` e restaura as três RPCs de coach nas assinaturas
anteriores.
