# Snapshot: antes de `20260816100000_charge_payment_intents`

## Escopo

Registro das tentativas de pagamento online feitas por atletas para uma cobrança. A tabela não é
razão financeiro: receita continua existindo somente em `charge_payments`, depois da confirmação
do Mercado Pago pelo webhook.

## Dependências

- `20260814100000_coach_billing` — `charges`, `charge_payments`, `charge_balances` e os enums de
  origem/método.
- `20260815100000_payment_provider_connections` — enum `payment_provider` e a conexão OAuth do
  coach usada pelo servidor para criar e consultar pagamentos.
- `public.set_updated_at()` — trigger compartilhado do projeto.

## Estado anterior

- Não existe tabela para guardar o `provider_payment_id` e os dados de exibição de um PIX gerado.
- `charge_payments` já possui o índice único parcial `(source, provider_payment_id)`, que será a
  idempotência definitiva quando o webhook registrar receita.

## Mudanças

- 2 enums: `payment_intent_status` e `payment_intent_method`.
- 1 tabela: `charge_payment_intents`, com RLS para leitura do atleta ou coach e sem escrita pelo
  client.
- 2 índices: busca única por `(provider, provider_payment_id)` e busca por `charge_id`.
- 1 trigger de atualização de `updated_at`.

## Decisões

- **Tentativa não é receita.** PIX pendente não reduz saldo nem aparece como pagamento recebido;
  `charge_balances` continua somando somente `charge_payments`.
- **QR não é segredo.** `qr_code` e `qr_code_base64` são retornados ao app porque precisam ser
  exibidos ao atleta; os tokens do vendedor continuam apenas na conexão server-side.
- **Escrita server-side.** A função de criação e o webhook usam a service role. A RLS não oferece
  insert/update/delete para usuários autenticados.

## Rollback

Executar `supabase/rollback/20260816100000_charge_payment_intents.sql`. O rollback remove as
tentativas e seus QR codes, mas preserva `charge_payments` e a receita já registrada.
