# Snapshot pré-`20260805150000_coach_calendar_prescription`

## Dependências

- `20260805120000_coach_training_flow.sql`
- `20260805140000_athlete_calendar.sql`

## Mudanças

- RPC para listar equipes do coach.
- RPC para listar sessões do calendário do coach.
- RPC transacional para criar template, salvar prescrições e aplicar a sessão publicada a uma equipe/data.

## Rollback

Executar `supabase/rollback/20260805150000_coach_calendar_prescription.sql` antes de remover as migrations anteriores.

