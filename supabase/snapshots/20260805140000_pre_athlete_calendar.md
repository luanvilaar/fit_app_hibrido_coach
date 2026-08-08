# Snapshot pré-calendário do atleta

- Data: 2026-08-05
- Projeto configurado: `jygzyhebotnopnagevow.supabase.co`
- Origem: introspecção `GET /rest/v1/` usando a chave administrativa do ambiente, sem registrar segredos.
- Resultado: o schema público remoto retornou apenas a rota de introspecção, sem tabelas ou definições PostgREST.
- Observação: a migration `20260805120000_coach_training_flow.sql` ainda precisa ser aplicada antes da migration `20260805140000_athlete_calendar.sql`.

## Ordem de aplicação

1. `supabase/migrations/20260805120000_coach_training_flow.sql`
2. `supabase/migrations/20260805140000_athlete_calendar.sql`

## Rollback

Os arquivos de rollback devem ser executados na ordem inversa, começando por `20260805140000_athlete_calendar.sql`.
