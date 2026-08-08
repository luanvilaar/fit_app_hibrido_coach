# Snapshot pré-`20260806140000_exercise_video_catalog`

## Dependências

- `20260805120000_coach_training_flow.sql` (tabela `exercises`, unique em `slug`)

## Mudanças

- Coluna `public.exercises.video_url` (texto, opcional) com check de formato `https://`.
- Comentários documentando `video_url` e a convenção `created_by is null` = catálogo oficial.
- Inserção idempotente de 14 movimentos do `bancomove.xlsx`, com upsert por `slug`.

## Notas

- Nenhum dos 14 slugs colide com `back-squat`, único exercício existente (vindo do seed manual).
- `created_by` fica `null` de propósito: distingue catálogo oficial de exercício criado por coach.
- A policy `"authenticated users can create exercises"` exige `created_by = auth.uid()`, então
  coaches não conseguem inserir linhas de catálogo pela aplicação — só esta migration insere.
- Não existe policy de update/delete em `exercises`, então o catálogo não é alterável pelo app.
- `create_session_template_with_content` reaproveita exercício existente por `slug`, então um coach
  que digitar "Power Snatch" cai no registro do catálogo em vez de criar outro.

## Rollback

Executar `supabase/rollback/20260806140000_exercise_video_catalog.sql`. O rollback preserva
movimentos já referenciados por algum treino (`block_items`) para não violar a FK `on delete restrict`.
