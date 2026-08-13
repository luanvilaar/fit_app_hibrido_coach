-- Tentativa de pagamento online de uma cobrança.
--
-- Distinção que sustenta o desenho: a intenção é registro de TENTATIVA, não de receita. Receita
-- só existe em `charge_payments`, gravada pelo webhook depois que o provedor confirma. Um PIX
-- gerado e nunca pago fica `pending` para sempre e não contamina saldo nenhum, porque
-- `charge_balances` soma apenas `charge_payments` — a mesma disciplina da Fase 1.
--
-- Escrita exclusivamente pelo servidor (service role, funções em api/). O atleta e o coach leem.

create type public.payment_intent_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired'
);

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

  -- Devolvidos ao app para exibir o PIX. Não são segredo: o QR é feito para ser mostrado.
  qr_code text,
  qr_code_base64 text,

  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O webhook encontra a intenção por este par; também impede duas linhas para o mesmo pagamento.
create unique index charge_payment_intents_provider_unique
  on public.charge_payment_intents (provider, provider_payment_id);

create index charge_payment_intents_charge_id_idx on public.charge_payment_intents(charge_id);

create trigger charge_payment_intents_set_updated_at
before update on public.charge_payment_intents
for each row execute procedure public.set_updated_at();

alter table public.charge_payment_intents enable row level security;

create policy "athletes can read own payment intents"
on public.charge_payment_intents for select to authenticated
using (athlete_id = auth.uid());

create policy "coaches can read own payment intents"
on public.charge_payment_intents for select to authenticated
using (coach_id = auth.uid());

-- Sem policy de escrita: quem grava é o servidor, com service role.

notify pgrst, 'reload schema';
