# Snapshot: antes de `20260815100000_payment_provider_connections`

## Escopo

Primeira migration que guarda credencial de terceiro. Cria a conexão OAuth do coach com o
Mercado Pago (`payment_provider_connections`), a proteção contra CSRF do callback
(`payment_oauth_states`) e a RPC de estado que a UI consome.

## Estado anterior

- A Fase 1 (`20260814100000_coach_billing`) já deixou os ganchos do gateway prontos:
  `charge_payments.source` aceita `'mercado_pago'`, existe `provider_payment_id`, e o índice
  único parcial `(source, provider_payment_id)` garante idempotência de webhook.
- Não existe nenhuma tabela de credencial, nem servidor. Esta é a primeira migration cujo
  consumidor é uma função de servidor, não o app.

## Dependências

- `public.set_updated_at()` — `20260805120000_coach_training_flow`
- `20260814100000_coach_billing` precisa estar aplicada antes (a Fase 2 inteira depende dela)

## Mudanças

- 1 tipo: `payment_provider`
- 2 tabelas: `payment_provider_connections`, `payment_oauth_states` — ambas com RLS habilitada e
  **zero policies**, mais `revoke all ... from anon, authenticated`
- 1 função: `my_payment_connection_status()`, `security definer`, com grant para `authenticated`

## Decisões

- **RLS com zero policies, ao contrário de todo o resto do projeto.** Nas demais tabelas a RLS
  serve para o client ler o que é dele. Aqui não existe leitura legítima pelo client: a tabela
  guarda o `access_token` do coach no Mercado Pago, válido por 180 dias e capaz de movimentar
  dinheiro. Só a service role — dentro da função de servidor — lê. O coach vê o estado por uma
  RPC que devolve apenas campos inócuos.
- **Tokens cifrados na aplicação (AES-256-GCM), não em texto claro.** A chave vive só nas env
  vars do Vercel. Um dump do banco ou acesso indevido ao painel não entrega credencial usável.
- **`payment_oauth_states` de uso único e validade curta.** Sem amarrar o `state` ao coach que
  iniciou o fluxo, o callback aceitaria um `code` de origem qualquer e vincularia a conta de um
  terceiro ao coach errado.
- **`live_mode` gravado.** O coach precisa ver na UI que está em sandbox, em vez de descobrir
  depois de um mês recebendo em conta de teste.
- **`needs_reconnect` derivado de `expires_at`**, não gravado — mesma disciplina da Fase 1: estado
  que é consequência de um dado não vira coluna para divergir.

## Riscos conhecidos

- **Não aplicada ao banco** — sem Supabase CLI, psql ou Docker no ambiente. Nada aqui foi
  executado contra o Postgres real.
- Se `PAYMENT_TOKEN_ENCRYPTION_KEY` for perdida ou trocada, os tokens gravados viram ilegíveis e
  todos os coaches precisam reconectar. A chave é backup crítico.
- `payment_oauth_states` acumula linhas expiradas; a limpeza é feita pela função de callback ao
  consumir. Se o volume crescer, vale uma rotina de expurgo.

## Rollback

`supabase/rollback/20260815100000_payment_provider_connections.sql`. Desconecta todos os coaches;
não afeta `charge_payments` já registrados.
