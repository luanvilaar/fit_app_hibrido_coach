# Snapshot pré-`20260806230000_readiness_questionnaire_expansion`

## Motivação

O check-in diário tinha três perguntas (sono, energia, dor muscular) com dois problemas de fundo:

1. **Escalas em direções opostas.** `soreness_score` era invertida (1 = nenhuma dor, 5 = muita dor) e a fórmula da prontidão compensava com `6 - soreness_score`. Frágil de ler e impossível de estender.
2. **Três itens são pouco sinal.** Não separavam carga psicológica (estresse, humor, motivação) de carga física, e a média de três itens é ruidosa demais para virar base de alerta.

Esta migration alinha o instrumento a um modelo inspirado no Hooper Index: sete perguntas de 1 a 5, todas na mesma direção (5 = melhor), mais dor localizada opcional — porque a média esconde caso individual (um atleta pode ter média aceitável e dor de joelho 8/10).

## Dependências

- `20260806180000_athlete_today_dashboard.sql` (`athlete_daily_checkins`, RLS `"athletes manage own checkins"`, `upsert_athlete_checkin`, `get_athlete_today`)

## Mudanças

### Estrutura

- `soreness_score` renomeada para `muscle_recovery_score`, com os valores convertidos por `6 - x` (a escala inverte junto com o nome).
- Quatro colunas novas, `not null`, `check between 1 and 5`: `stress_score`, `mood_score`, `motivation_score`, `overall_readiness_score`.
- `pain_region` (`text`, lista fechada por check constraint) e `pain_intensity` (`smallint`, 0-10), ambas opcionais e amarradas por `(pain_region is null) = (pain_intensity is null)`.
- `readiness` recriada: média simples das sete respostas em vez de três.

### Funções

- `upsert_athlete_checkin` recriada com 11 parâmetros (era 5). Exigiu `drop function` explícito.
- `get_athlete_today(date)` **não foi tocada**: emite `to_jsonb(checkin_row)`, então as colunas novas fluem sozinhas.

## Decisões

- **Direção única de escala.** As sete respostas vão de 1 (pior) a 5 (melhor). O que era "dor" virou "recuperação" com o nome trocado — manter `soreness_score` medindo o oposto do que o nome diz seria erro garantido de leitura.
- **Coluna gerada recriada, não alterada.** O Postgres não permite alterar a expressão de uma coluna gerada `stored`; a única saída é `drop column` + `add column`, e a coluna precisa sair antes de as colunas-fonte serem renomeadas.
- **Assinatura recriada com `drop` explícito.** `create or replace function` não troca a lista de parâmetros: sem o drop nasceria uma sobrecarga e o PostgREST ficaria ambíguo.
- **Backfill deriva das respostas reais.** As quatro perguntas que não existiam recebem a média arredondada das três respondidas naquele dia, preservando a posição relativa do histórico. Um `3` neutro achataria todos os atletas no meio da escala.
- **Conversão de escala guardada por `pg_attribute`.** Um `update ... set x = 6 - x` solto não é idempotente — rodar duas vezes desfaz a conversão. O `do $$` só executa enquanto a coluna antiga existir.
- **Dor localizada como par obrigatório.** Região sem intensidade não é informação; a constraint força os dois ou nenhum.
- **`readiness` ≠ `overall_readiness_score`.** A primeira é a média derivada, a segunda é uma das sete perguntas ("prontidão geral", subjetiva). Ambos os nomes têm `comment on column` explícito por causa disso.
- **Região de dor em `text` + check, não enum.** Contraria a convenção do repo (`session_status`, `athlete_session_state` são enums), mas o Postgres não tem `alter type ... drop value`: com enum, o rollback não fecharia limpo e evoluir a lista exigiria recriar o tipo. A lista vai mudar enquanto o questionário é calibrado.
- **RLS inalterada.** Nenhuma policy de coach entra nesta migration — o painel semáforo do coach está fora do escopo desta fase.

## Riscos conhecidos

- Linhas anteriores a esta migration carregam quatro respostas **derivadas**, não informadas pelo atleta. Um motor de alertas futuro as trataria como reais. São identificáveis por `checkin_date` anterior à data de aplicação.
- A lista de regiões de dor está duplicada entre a check constraint `athlete_daily_checkins_pain_region_check` e `painRegions` em `apps/universal/data/today.ts`. Dívida inevitável enquanto o questionário for de colunas fixas; comentada nos dois lados.
- Antes de aplicar, confirmar com `\d+ public.athlete_daily_checkins` o nome real de `athlete_daily_checkins_soreness_score_check`. Se o nome auto-gerado divergir, o `drop constraint if exists` falha em silêncio e sobra uma constraint com nome errado — inofensiva (checa 1..5 na mesma coluna), mas suja.
- Aplicar migration → rollback → migration converte a escala corretamente **apenas se cada arquivo rodar por inteiro**.

## Rollback

Executar `supabase/rollback/20260806230000_readiness_questionnaire_expansion.sql`. Apaga as quatro respostas novas e a dor localizada, desinverte `muscle_recovery_score` de volta para `soreness_score` e restaura a RPC de 5 parâmetros. As três respostas originais voltam intactas.
