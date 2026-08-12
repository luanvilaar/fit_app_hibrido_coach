# Snapshot pré-`20260810100000_coach_prescription_v2`

## Escopo preservado

As sessões já aplicadas continuam em `session_instances.snapshot`, que é um JSON congelado.
Nenhuma linha histórica é convertida ou apagada. Snapshots sem `schema_version` continuam sendo
lidos pelo parser legado somente para leitura.

## Mudanças da migration

- `public.athlete_block_scores` guarda um score por atleta, sessão e bloco.
- `block_id` é intencionalmente um UUID sem FK para `session_blocks`: o bloco pertence ao snapshot
  da sessão e precisa sobreviver à edição do template ou da sessão original.
- `submit_block_score` valida a sessão publicada, o ranking configurado no snapshot e a métrica
  enviada antes de fazer upsert do score do atleta.
- `list_block_leaderboard` ordena tempo ascendente e rounds/reps, reps e carga descendentes;
  empates recebem a mesma posição e a data de envio funciona como desempate visual.
- RLS permite ao atleta gerenciar somente o próprio score, aos membros lerem rankings da equipe e
  aos coaches lerem rankings das próprias equipes.

## Rollback

Executar `supabase/rollback/20260810100000_coach_prescription_v2.sql`. O rollback remove somente a
tabela, políticas e RPCs desta migration; snapshots e entidades anteriores permanecem intactos.
