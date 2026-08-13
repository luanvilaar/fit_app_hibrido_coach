# Handoff — Story 1.30: checkout PIX + webhook

Escrito antes da implementação por limite de contexto. Se os arquivos abaixo não existirem ou
estiverem incompletos, este documento é a especificação para terminar.

**Pré-requisitos já prontos (não refazer):**
- Story 1.26 — `charges`, `charge_payments`, `charge_adjustments`, view `charge_balances`.
  **`charge_payments` já tem `source`, `provider_payment_id` e o índice único parcial
  `(source, provider_payment_id)` — é ele que dá a idempotência do webhook.**
- Story 1.29 — `api/_lib/{env,crypto,http,auth,mercadopago,connection}.ts` e o OAuth do coach.
  Use `getValidAccessToken(client, coachId)` de `api/_lib/connection.ts`.

**Convenções do repo:** comentários e mensagens de erro em português explicando o *porquê*;
centavos inteiros; RPC `security definer` para escrita; testes co-localizados; gate =
`npm run lint && npm run typecheck && npm test && npm run build` na raiz.

---

## 1. Migration `supabase/migrations/20260816100000_charge_payment_intents.sql`

Mais rollback em `supabase/rollback/` e snapshot em `supabase/snapshots/` (padrão do repo).

```sql
create type public.payment_intent_status as enum
  ('pending', 'approved', 'rejected', 'cancelled', 'expired');

create type public.payment_intent_method as enum ('pix', 'credit_card');

create table public.charge_payment_intents (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  provider public.payment_provider not null default 'mercado_pago',
  provider_payment_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  method public.payment_intent_method not null,
  status public.payment_intent_status not null default 'pending',
  -- PIX: devolvidos ao app para exibir. Não são segredo.
  qr_code text,
  qr_code_base64 text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index charge_payment_intents_provider_unique
  on public.charge_payment_intents (provider, provider_payment_id);
create index charge_payment_intents_charge_id_idx on public.charge_payment_intents(charge_id);

create trigger charge_payment_intents_set_updated_at
before update on public.charge_payment_intents
for each row execute procedure public.set_updated_at();

alter table public.charge_payment_intents enable row level security;

-- O atleta acompanha o próprio pagamento; escrita é só do servidor (service role).
create policy "athletes can read own payment intents"
on public.charge_payment_intents for select to authenticated
using (athlete_id = auth.uid());

create policy "coaches can read own payment intents"
on public.charge_payment_intents for select to authenticated
using (coach_id = auth.uid());

notify pgrst, 'reload schema';
```

**Decisão a registrar na story:** a intenção é registro de tentativa, não de receita. Receita só
existe em `charge_payments`, gravada pelo webhook. Um PIX gerado e nunca pago fica `pending` para
sempre e não contamina saldo nenhum — porque `charge_balances` só soma `charge_payments`.

---

## 2. `api/_lib/webhook-signature.ts` + teste

Mercado Pago manda `x-signature: ts=<ts>,v1=<hash>` e `x-request-id`.
Manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (campos ausentes saem do manifesto).
HMAC-SHA256 com `MERCADOPAGO_WEBHOOK_SECRET`, comparado ao `v1` **em tempo constante**.

```ts
export function buildManifest(dataId: string, requestId: string | null, ts: string): string
export async function isValidSignature(input: {
  signatureHeader: string | null;  // "ts=...,v1=..."
  requestId: string | null;
  dataId: string;
  secret: string;
}): Promise<boolean>
```

Use Web Crypto (`crypto.subtle.importKey("raw", ..., {name:"HMAC",hash:"SHA-256"}, ...)` +
`crypto.subtle.sign`), como em `api/_lib/crypto.ts`. Comparação byte a byte com acumulador XOR —
`===` em string vaza tempo.

**Testes:** assinatura válida passa; `v1` alterado falha; header ausente/malformado falha; secret
errado falha.

---

## 3. `api/payments/create.ts`

`POST`, autenticado (`authenticate` de `_lib/auth`).

Fluxo:
1. Corpo: `{ charge_id: string, method: "pix" }`.
2. `serviceRoleClient()`; ler a cobrança **junto do saldo**:
   `from("charges").select("id, coach_id, athlete_id, description, cancelled_at").eq("id", charge_id).maybeSingle()`
   e o saldo em `charge_balances` (`outstanding_amount_cents`).
3. **Recusar** se: não existe; `athlete_id !== user.id` (mensagem genérica, não revelar existência);
   `cancelled_at` não nulo; `outstanding_amount_cents <= 0`.
4. `getValidAccessToken(client, charge.coach_id)`. `ConnectionMissingError` →
   "Seu treinador ainda não conectou uma conta para receber pagamentos pelo app." (409)
5. `POST https://api.mercadopago.com/v1/payments`
   - headers: `Authorization: Bearer <accessToken>`, `Content-Type: application/json`,
     **`X-Idempotency-Key: <charge_id>:<outstanding>:<tentativa>`** (chave estável por tentativa).
   - body PIX:
     ```json
     { "transaction_amount": <reais, number>, "description": "<charge.description>",
       "payment_method_id": "pix",
       "payer": { "email": "<user.email>" },
       "external_reference": "<charge_id>",
       "notification_url": "<origin>/api/webhooks/mercadopago" }
     ```
   - **`transaction_amount` é em REAIS decimais**, não centavos: `outstanding / 100`. Este é o erro
     mais caro possível aqui — cobrar 100× a mais. Arredondar a 2 casas.
6. Gravar a intenção (`provider_payment_id = String(payment.id)`, `status: "pending"`,
   `qr_code`/`qr_code_base64` de `point_of_interaction.transaction_data`).
7. Responder `{ payment_id, status, qr_code, qr_code_base64, expires_at, amount_cents }`.

---

## 4. `api/webhooks/mercadopago.ts`

`POST`, **sem autenticação de usuário** (quem chama é o provedor).

1. Ler o corpo cru para a assinatura; `data.id` do JSON (`{type:"payment", data:{id}}`).
2. Validar assinatura. Inválida → `401`. **Nunca processar sem validar.**
3. Achar a intenção por `provider_payment_id` → dá `coach_id`, `charge_id`, `athlete_id`.
   Não achou → `200` (evento de outro contexto; 200 evita retry infinito do provedor).
4. `getValidAccessToken(client, coach_id)` e **reler o pagamento em
   `GET https://api.mercadopago.com/v1/payments/<id>`**. Nunca confiar no corpo da notificação —
   ele diz apenas que algo mudou, não o quê.
5. Mapear `status` do MP → `payment_intent_status` (`approved`, `rejected`, `cancelled`,
   `pending`/`in_process` → `pending`). Atualizar a intenção.
6. **Se `approved`**, inserir em `charge_payments`:
   ```
   { charge_id, amount_cents: Math.round(payment.transaction_amount * 100),
     source: "mercado_pago", payment_method: "pix" | "credit_card",
     paid_at: <date de payment.date_approved>, provider_payment_id: String(payment.id),
     created_by: null }
   ```
   Conflito no índice `(source, provider_payment_id)` = evento repetido → **tratar como sucesso**,
   não como erro. É exatamente aqui que a idempotência acontece; não escrever lógica de "já
   processei?" em cima disso.
7. Sempre `200` no fim (salvo assinatura inválida), para o provedor parar de reenviar.

**Não é preciso atualizar status da cobrança:** saldo e status saem de `charge_balances`, derivados
do razão. Inserir em `charge_payments` já quita.

---

## 5. UI — `apps/universal/components/athlete-charges-card.tsx`

- Botão **"Pagar agora"** em cada cobrança com `outstanding_amount_cents > 0` e status ≠ cancelada.
  Só renderizar se o treinador tiver conexão — o servidor responde 409 e a mensagem já explica;
  aceitável mostrar sempre e falhar com a mensagem.
- Abre `Dialog` (`@/components/ui/dialog`, já existe): mostra QR (`qr_code_base64` como
  `<Image source={{uri:"data:image/png;base64,"+...}}/>`), o copia-e-cola (`qr_code`) num campo
  selecionável com botão de copiar (`expo-clipboard` **não está instalado** — usar
  `navigator.clipboard` no web via `Platform.OS === "web"`, ou apenas exibir o código para seleção
  manual; não instalar dependência sem necessidade).
- Após criar, **poll** do estado a cada ~5 s (`listMyCharges` ou uma leitura da intenção) até sair
  de `pending`, com limite (~3 min). Quando aprovar, fechar o diálogo e recarregar.
- Chamada às funções com o JWT no header, igual a `mercadopago-connection-card.tsx`:
  `supabase.auth.getSession()` → `Authorization: Bearer <token>`.

**Testes de tela:** botão só aparece com saldo; erro 409 vira mensagem do treinador sem conexão;
QR exibido após sucesso; polling encerra ao aprovar.

---

## 6. Repositório

`packages/backend/src/billing-repository.ts` — acrescentar `listMyChargeIntents()` se o polling
precisar; ou reusar `listMyCharges()`, que já devolve saldo e status derivados (mais simples,
preferir).

---

## Verificação

Gate completo na raiz. Nada chama o Mercado Pago nos testes — `fetch` mockado.

Roteiro manual (do usuário, após deploy e com as duas migrations anteriores aplicadas):
aplicar a migration nova → gerar cobrança → como aluno, "Pagar agora" → pagar o PIX com usuário de
teste do MP → a cobrança deve baixar sozinha via webhook em segundos.

**Cadastrar a URL do webhook** na aplicação do Mercado Pago:
`https://<domínio>/api/webhooks/mercadopago`, evento `payment`.

---

## Registro de conclusão

Status: Ready for Review

O handoff foi usado como artefato de execução porque a story formal 1.30 ainda não existia em
`docs/stories/`. Os critérios acima foram implementados sem alterar o escopo:

- [x] Migration de intenções PIX, rollback e snapshot pré-migration.
- [x] Assinatura HMAC-SHA256 do webhook com comparação em tempo constante.
- [x] Criação autenticada do PIX com saldo relido, conversão centavos → reais e idempotência por tentativa.
- [x] Webhook assinado, releitura autoritativa no Mercado Pago e baixa idempotente no razão.
- [x] Botão "Pagar agora", Dialog com QR/copia-e-cola, JWT, polling de 5 s e timeout de 3 min.
- [x] Testes co-localizados de assinatura, criação, webhook e tela.

### File List

- `api/_lib/env.ts`
- `api/_lib/webhook-signature.ts`
- `api/_lib/webhook-signature.test.ts`
- `api/payments/create.ts`
- `api/payments/create.test.ts`
- `api/webhooks/mercadopago.ts`
- `api/webhooks/mercadopago.test.ts`
- `apps/universal/components/athlete-charges-card.tsx`
- `apps/universal/components/athlete-charges-card.test.tsx`
- `supabase/migrations/20260816100000_charge_payment_intents.sql`
- `supabase/rollback/20260816100000_charge_payment_intents.sql`
- `supabase/snapshots/20260816100000_pre_charge_payment_intents.md`

### Quality Gate

- `npm run lint` — passou.
- `npm run typecheck` — passou.
- `npm test` — passou: 52 suites, 485 testes.
- `npm run build` — passou: export web concluído.

O deploy ainda precisa aplicar as migrations 1.26, 1.29 e 1.30, configurar as variáveis de
ambiente no Vercel e cadastrar o webhook `payment` no Mercado Pago antes do roteiro manual.
