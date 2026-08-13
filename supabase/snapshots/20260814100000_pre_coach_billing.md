# Snapshot: antes de `20260814100000_coach_billing`

## Escopo

Primeira migration de dinheiro do projeto. Até aqui nenhuma das 23 migrations tocava
preço, plano, cobrança ou assinatura — o schema só conhecia treino, equipe, progresso e
catálogo. Esta migration cria o financeiro do coach sem gateway de pagamento: quanto cada
aluno paga (`billing_plans`), a cobrança de cada competência (`charges`), o dinheiro que
entrou (`charge_payments`) e o que foi perdoado (`charge_adjustments`).

## Estado anterior

- Nenhuma tabela financeira existe.
- O enum `session_instance_state` já tem o valor `plan_locked`
  (`20260805140000_athlete_calendar`), sem nenhum produtor — nada no código chega a
  produzir esse estado. Esta migration **não** passa a produzi-lo; bloquear treino por
  inadimplência é decisão de produto ainda não tomada.
- O vínculo coach↔atleta só existe via `team_members`; não há aresta direta.

## Dependências

Funções já existentes que esta migration consome:

- `public.set_updated_at()` — `20260805120000_coach_training_flow`
- `public.is_team_coach(uuid)` — redefinida em `20260809120000_owner_superuser_permissions`
  (já inclui `is_platform_owner()`)
- `public.is_platform_owner()` — `20260806200000_platform_owner_role`
- `public.profiles` e `public.team_members` para resolver nome exibido e autorização

## Mudanças

- 4 tipos: `charge_status`, `charge_payment_source`, `charge_payment_method`,
  `charge_adjustment_type`
- 4 tabelas com RLS habilitada e **somente policies de `select`** — toda escrita passa por
  RPC `security definer`
- 1 view `charge_balances`, com `revoke all ... from anon, authenticated`
- 12 funções, 11 delas com `grant execute to authenticated`
  (`assert_charge_is_operable` é interna)

## Decisões

- **Centavos inteiros, nunca `numeric`/float.** Aritmética binária de ponto flutuante
  produz divergência de centavo em relatório financeiro.
- **Saldo e status derivados, não gravados.** A view `charge_balances` soma o razão; não há
  colunas `paid_amount`/`status` em `charges` para divergir. Só `cancelled` é gravado,
  porque não é consequência de lançamento nenhum.
- **`overdue` sem job noturno.** Derivado de `due_date < current_date`, vira sozinho à
  meia-noite.
- **`status` e `is_overdue` convivem.** Uma cobrança com pagamento parcial e vencida precisa
  informar as duas coisas; um campo só perderia uma delas.
- **Pagar e perdoar em tabelas separadas.** `sum(charge_payments)` nunca inclui perdão.
- **Índice único `(billing_plan_id, reference_month)`.** É o que torna a geração do mês
  idempotente.
- **`charge_payments (source, provider_payment_id)` único parcial.** Guarda de idempotência
  para o webhook do gateway que ainda não existe — barato agora, caro com dados na tabela.

## Riscos conhecidos

- **Não aplicada ao banco nesta rodada** — não há Supabase CLI, psql, Docker ou token de
  management no ambiente. A migration está escrita e não executada; nenhuma RLS, RPC ou
  constraint foi verificada contra o Postgres real.
- `charge_balances` recalcula o razão a cada leitura. Com o volume de um coach (dezenas de
  alunos, dezenas de cobranças por mês) isso é irrelevante; se a plataforma crescer para
  milhares de cobranças por competência, vira índice ou tabela materializada.
- `cancel_charge` recusa cobrança que já recebeu pagamento — o caminho para encerrar essas é
  perdoar o saldo. É uma restrição deliberada para não apagar receita já registrada.

## Rollback

`supabase/rollback/20260814100000_coach_billing.sql` derruba funções, view, tabelas e tipos
na ordem inversa. **Destrói dados financeiros sem possibilidade de reconstrução** — exportar
as quatro tabelas antes de rodar em produção.
