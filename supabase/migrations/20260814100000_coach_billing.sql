-- Financeiro do coach: quanto cada aluno paga, as cobranças de cada mês, o dinheiro que entrou
-- e o que foi perdoado. Primeira migration de dinheiro do projeto — não havia nenhuma tabela de
-- preço, plano ou cobrança até aqui.
--
-- Três decisões estruturais que o resto do arquivo assume:
--
-- 1. Dinheiro em centavos inteiros, nunca numeric ou float. `0.1 + 0.2` não é `0.3`, e num
--    relatório financeiro isso vira divergência de centavo que ninguém consegue explicar. A
--    formatação para "R$ 300,00" acontece na borda da UI.
--
-- 2. Saldo e status são DERIVADOS do razão (charge_payments + charge_adjustments), não colunas
--    de charges. Guardar paid_amount/status gravados criaria duas fontes de verdade que divergem
--    no primeiro caminho de escrita esquecido. A view charge_balances é a única aritmética; o
--    status "overdue" cai de due_date < current_date, então a cobrança vence sozinha à meia-noite
--    e não precisa de job noturno. Só `cancelled` é estado gravado, porque não é consequência de
--    nenhum lançamento.
--
-- 3. Pagar e perdoar são tabelas separadas, não um campo `type` numa tabela só. Pagamento é
--    receita; perdão é ajuste que zera saldo sem faturar. Separadas, `sum(charge_payments)` nunca
--    inclui perdão por acidente — somar receita errado deixa de ser possível.
--
-- Toda escrita passa por RPC security definer (nenhuma policy de insert/update para o client),
-- como em team_join_requests. A autorização se ancora na equipe porque não existe aresta direta
-- coach↔atleta no schema: o vínculo é sempre team_members.

create type public.charge_status as enum (
  'pending',
  'overdue',
  'paid',
  'partially_paid',
  'forgiven',
  'cancelled'
);

-- 'mercado_pago' já nasce aqui: quando o gateway entrar, é uma linha de origem a mais, não uma
-- migração de dados.
create type public.charge_payment_source as enum ('manual', 'mercado_pago');

create type public.charge_payment_method as enum (
  'pix',
  'cash',
  'bank_transfer',
  'external_card',
  'credit_card',
  'debit_card',
  'other'
);

create type public.charge_adjustment_type as enum ('forgiveness', 'discount', 'correction');

-- ---------------------------------------------------------------------------
-- billing_plans — quanto cada aluno paga por mês
-- ---------------------------------------------------------------------------

create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  -- Dia 30 não existe em fevereiro. Limitar a 28 na constraint evita espalhar a regra de
  -- "cai no último dia do mês" por todo o código de geração.
  due_day smallint not null check (due_day between 1 and 28),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um plano ativo por aluno: dois planos ativos significariam cobrar duas vezes no mesmo mês.
create unique index billing_plans_one_active_per_athlete
  on public.billing_plans (coach_id, athlete_id)
  where is_active;

create index billing_plans_coach_id_idx on public.billing_plans(coach_id);
create index billing_plans_athlete_id_idx on public.billing_plans(athlete_id);

create trigger billing_plans_set_updated_at
before update on public.billing_plans
for each row execute procedure public.set_updated_at();

alter table public.billing_plans enable row level security;

create policy "coaches can read own billing plans"
on public.billing_plans for select to authenticated
using (coach_id = auth.uid() or public.is_platform_owner());

create policy "athletes can read own billing plan"
on public.billing_plans for select to authenticated
using (athlete_id = auth.uid());

-- ---------------------------------------------------------------------------
-- charges — a cobrança de uma competência
-- ---------------------------------------------------------------------------

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  -- Nulo quando a cobrança não veio de um plano (avulsa) ou o plano foi apagado depois.
  billing_plan_id uuid references public.billing_plans(id) on delete set null,
  reference_month date not null check (extract(day from reference_month) = 1),
  description text not null,
  original_amount_cents integer not null check (original_amount_cents > 0),
  due_date date not null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cancelamento sem motivo registrado é exatamente o que a auditoria não pode aceitar.
  constraint charges_cancellation_is_complete check (
    (cancelled_at is null and cancellation_reason is null)
    or (cancelled_at is not null and cancellation_reason is not null)
  )
);

-- O que torna a geração do mês idempotente: rodar "gerar agosto" duas vezes não duplica nada.
create unique index charges_unique_plan_reference_month
  on public.charges (billing_plan_id, reference_month)
  where billing_plan_id is not null;

create index charges_coach_reference_month_idx on public.charges(coach_id, reference_month);
create index charges_athlete_id_idx on public.charges(athlete_id);

create trigger charges_set_updated_at
before update on public.charges
for each row execute procedure public.set_updated_at();

alter table public.charges enable row level security;

create policy "coaches can read own charges"
on public.charges for select to authenticated
using (coach_id = auth.uid() or public.is_platform_owner());

create policy "athletes can read own charges"
on public.charges for select to authenticated
using (athlete_id = auth.uid());

-- ---------------------------------------------------------------------------
-- charge_payments — o dinheiro que entrou (append-only)
-- ---------------------------------------------------------------------------

create table public.charge_payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  source public.charge_payment_source not null default 'manual',
  payment_method public.charge_payment_method not null,
  paid_at date not null,
  notes text,
  -- Identificador do pagamento no provedor; hoje sempre nulo (só há origem manual).
  provider_payment_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Guarda de idempotência para quando o webhook do gateway existir: o mesmo evento entregue duas
-- vezes não vira dois pagamentos. Custa nada agora e é caro de acrescentar depois com dados.
create unique index charge_payments_provider_unique
  on public.charge_payments (source, provider_payment_id)
  where provider_payment_id is not null;

create index charge_payments_charge_id_idx on public.charge_payments(charge_id);

alter table public.charge_payments enable row level security;

create policy "charge parties can read payments"
on public.charge_payments for select to authenticated
using (
  exists (
    select 1
    from public.charges charge_row
    where charge_row.id = charge_payments.charge_id
      and (
        charge_row.coach_id = auth.uid()
        or charge_row.athlete_id = auth.uid()
        or public.is_platform_owner()
      )
  )
);

-- ---------------------------------------------------------------------------
-- charge_adjustments — o que foi perdoado (append-only)
-- ---------------------------------------------------------------------------

create table public.charge_adjustments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id) on delete cascade,
  type public.charge_adjustment_type not null,
  amount_cents integer not null check (amount_cents > 0),
  -- Motivo obrigatório: um perdão sem justificativa é indistinguível de um erro de operação.
  reason text not null check (char_length(btrim(reason)) >= 3),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index charge_adjustments_charge_id_idx on public.charge_adjustments(charge_id);

alter table public.charge_adjustments enable row level security;

create policy "charge parties can read adjustments"
on public.charge_adjustments for select to authenticated
using (
  exists (
    select 1
    from public.charges charge_row
    where charge_row.id = charge_adjustments.charge_id
      and (
        charge_row.coach_id = auth.uid()
        or charge_row.athlete_id = auth.uid()
        or public.is_platform_owner()
      )
  )
);

-- ---------------------------------------------------------------------------
-- charge_balances — a aritmética do razão, num lugar só
-- ---------------------------------------------------------------------------

-- `status` e `is_overdue` respondem perguntas diferentes e por isso convivem: o selo da linha
-- mostra o status (uma cobrança com pagamento parcial é 'partially_paid', mesmo vencida), e o
-- filtro de inadimplência usa `is_overdue`. Colapsar os dois num campo só perderia "recebi
-- metade" ou perderia "está vencida" — o coach precisa das duas informações na mesma linha.
create view public.charge_balances as
select
  charge_row.id as charge_id,
  charge_row.original_amount_cents,
  coalesce(payment_total.amount_cents, 0)::integer as paid_amount_cents,
  coalesce(adjustment_total.amount_cents, 0)::integer as forgiven_amount_cents,
  greatest(
    charge_row.original_amount_cents
      - coalesce(payment_total.amount_cents, 0)
      - coalesce(adjustment_total.amount_cents, 0),
    0
  )::integer as outstanding_amount_cents,
  (
    charge_row.cancelled_at is null
    and charge_row.due_date < current_date
    and charge_row.original_amount_cents
        - coalesce(payment_total.amount_cents, 0)
        - coalesce(adjustment_total.amount_cents, 0) > 0
  ) as is_overdue,
  (
    case
      when charge_row.cancelled_at is not null then 'cancelled'
      when charge_row.original_amount_cents
           - coalesce(payment_total.amount_cents, 0)
           - coalesce(adjustment_total.amount_cents, 0) <= 0
        -- Saldo zerado sem nenhum dinheiro recebido é perdão; com dinheiro, é pagamento.
        then case when coalesce(payment_total.amount_cents, 0) = 0 then 'forgiven' else 'paid' end
      when coalesce(payment_total.amount_cents, 0) > 0 then 'partially_paid'
      when charge_row.due_date < current_date then 'overdue'
      else 'pending'
    end
  )::public.charge_status as status
from public.charges charge_row
left join lateral (
  select sum(payment_row.amount_cents) as amount_cents
  from public.charge_payments payment_row
  where payment_row.charge_id = charge_row.id
) payment_total on true
left join lateral (
  select sum(adjustment_row.amount_cents) as amount_cents
  from public.charge_adjustments adjustment_row
  where adjustment_row.charge_id = charge_row.id
) adjustment_total on true;

comment on view public.charge_balances is
  'Saldo e status derivados do razão de cada cobrança. Consumida apenas pelas RPCs — o client não '
  'lê esta view diretamente.';

-- A view não passa por RLS de charges quando lida direto pelo PostgREST; todo acesso do client
-- acontece através das RPCs abaixo, que autorizam explicitamente.
revoke all on public.charge_balances from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leitura: planos e alunos do coach
-- ---------------------------------------------------------------------------

-- Todos os atletas das equipes do coach, com o plano de cobrança quando já existe. É uma lista
-- só porque a tela precisa mostrar tanto quem já tem valor definido quanto quem ainda não —
-- separar em duas chamadas obrigaria a UI a costurar as duas listas.
create or replace function public.list_coach_billing_roster()
returns table (
  athlete_id uuid,
  athlete_display_name text,
  team_id uuid,
  team_name text,
  plan_id uuid,
  amount_cents integer,
  due_day smallint,
  description text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    member_row.user_id as athlete_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))) as athlete_display_name,
    team_row.id as team_id,
    team_row.name as team_name,
    plan_row.id as plan_id,
    plan_row.amount_cents,
    plan_row.due_day,
    plan_row.description
  from public.team_members coach_membership
  join public.teams team_row on team_row.id = coach_membership.team_id
  join public.team_members member_row
    on member_row.team_id = team_row.id
   and member_row.role = 'athlete'
  join auth.users user_row on user_row.id = member_row.user_id
  left join public.profiles profile_row on profile_row.user_id = member_row.user_id
  left join public.billing_plans plan_row
    on plan_row.athlete_id = member_row.user_id
   and plan_row.coach_id = auth.uid()
   and plan_row.is_active
  where coach_membership.user_id = auth.uid()
    and coach_membership.role = 'coach'
  order by athlete_display_name;
$$;

comment on function public.list_coach_billing_roster() is
  'Atletas das equipes do coach autenticado com o plano de cobrança ativo, quando houver.';

-- ---------------------------------------------------------------------------
-- Escrita: plano de cobrança
-- ---------------------------------------------------------------------------

create or replace function public.upsert_billing_plan(
  p_athlete_id uuid,
  p_team_id uuid,
  p_amount_cents integer,
  p_due_day smallint,
  p_description text default null
)
returns public.billing_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.billing_plans%rowtype;
begin
  if not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente coaches da equipe podem definir a mensalidade.';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_athlete_id and role = 'athlete'
  ) then
    raise exception using message = 'Este atleta não faz parte da equipe.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using message = 'O valor da mensalidade precisa ser maior que zero.';
  end if;

  if p_due_day is null or p_due_day < 1 or p_due_day > 28 then
    raise exception using message = 'O dia de vencimento precisa estar entre 1 e 28.';
  end if;

  update public.billing_plans
  set amount_cents = p_amount_cents,
      due_day = p_due_day,
      description = nullif(btrim(p_description), ''),
      team_id = p_team_id
  where coach_id = auth.uid()
    and athlete_id = p_athlete_id
    and is_active
  returning * into plan_row;

  if plan_row.id is null then
    insert into public.billing_plans (coach_id, athlete_id, team_id, amount_cents, due_day, description)
    values (auth.uid(), p_athlete_id, p_team_id, p_amount_cents, p_due_day, nullif(btrim(p_description), ''))
    returning * into plan_row;
  end if;

  return plan_row;
end;
$$;

comment on function public.upsert_billing_plan(uuid, uuid, integer, smallint, text) is
  'Cria ou atualiza o plano de cobrança ativo de um atleta do coach autenticado.';

-- Encerra a cobrança recorrente sem apagar o histórico: as cobranças já geradas continuam de pé.
create or replace function public.deactivate_billing_plan(p_plan_id uuid)
returns public.billing_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.billing_plans%rowtype;
begin
  update public.billing_plans
  set is_active = false
  where id = p_plan_id
    and coach_id = auth.uid()
    and is_active
  returning * into plan_row;

  if plan_row.id is null then
    raise exception using message = 'Plano não encontrado ou já encerrado.';
  end if;

  return plan_row;
end;
$$;

comment on function public.deactivate_billing_plan(uuid) is
  'Encerra o plano de cobrança ativo, mantendo as cobranças já geradas.';

-- ---------------------------------------------------------------------------
-- Geração das cobranças do mês
-- ---------------------------------------------------------------------------

-- Cria a cobrança de cada plano ativo para a competência pedida. O índice único
-- (billing_plan_id, reference_month) faz o trabalho pesado: rodar de novo não duplica, e o
-- retorno diz quantas nasceram e quantas já existiam.
create or replace function public.generate_month_charges(p_reference_month date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date;
  created_count integer;
  active_count integer;
begin
  if p_reference_month is null then
    raise exception using message = 'Informe o mês de competência.';
  end if;

  month_start := date_trunc('month', p_reference_month)::date;

  select count(*)::integer into active_count
  from public.billing_plans
  where coach_id = auth.uid() and is_active;

  if active_count = 0 then
    raise exception using message = 'Nenhum aluno tem mensalidade definida ainda.';
  end if;

  with inserted as (
    insert into public.charges (
      coach_id,
      athlete_id,
      billing_plan_id,
      reference_month,
      description,
      original_amount_cents,
      due_date
    )
    select
      plan_row.coach_id,
      plan_row.athlete_id,
      plan_row.id,
      month_start,
      coalesce(nullif(btrim(plan_row.description), ''), 'Mensalidade'),
      plan_row.amount_cents,
      month_start + (plan_row.due_day - 1)
    from public.billing_plans plan_row
    where plan_row.coach_id = auth.uid()
      and plan_row.is_active
    on conflict (billing_plan_id, reference_month) where billing_plan_id is not null
    do nothing
    returning 1
  )
  select count(*)::integer into created_count from inserted;

  return jsonb_build_object(
    'reference_month', month_start,
    'created', created_count,
    'skipped', active_count - created_count
  );
end;
$$;

comment on function public.generate_month_charges(date) is
  'Gera as cobranças da competência para todos os planos ativos do coach. Idempotente.';

-- ---------------------------------------------------------------------------
-- Leitura: cobranças e resumo
-- ---------------------------------------------------------------------------

create or replace function public.list_coach_charges(p_reference_month date default null)
returns table (
  id uuid,
  athlete_id uuid,
  athlete_display_name text,
  reference_month date,
  description text,
  due_date date,
  original_amount_cents integer,
  paid_amount_cents integer,
  forgiven_amount_cents integer,
  outstanding_amount_cents integer,
  status public.charge_status,
  is_overdue boolean,
  last_payment_method public.charge_payment_method,
  last_paid_at date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    charge_row.id,
    charge_row.athlete_id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))) as athlete_display_name,
    charge_row.reference_month,
    charge_row.description,
    charge_row.due_date,
    balance_row.original_amount_cents,
    balance_row.paid_amount_cents,
    balance_row.forgiven_amount_cents,
    balance_row.outstanding_amount_cents,
    balance_row.status,
    balance_row.is_overdue,
    last_payment.payment_method as last_payment_method,
    last_payment.paid_at as last_paid_at
  from public.charges charge_row
  join public.charge_balances balance_row on balance_row.charge_id = charge_row.id
  join auth.users user_row on user_row.id = charge_row.athlete_id
  left join public.profiles profile_row on profile_row.user_id = charge_row.athlete_id
  left join lateral (
    select payment_row.payment_method, payment_row.paid_at
    from public.charge_payments payment_row
    where payment_row.charge_id = charge_row.id
    order by payment_row.paid_at desc, payment_row.created_at desc
    limit 1
  ) last_payment on true
  where charge_row.coach_id = auth.uid()
    and (p_reference_month is null or charge_row.reference_month = date_trunc('month', p_reference_month)::date)
  order by charge_row.due_date, athlete_display_name;
$$;

comment on function public.list_coach_charges(date) is
  'Cobranças do coach autenticado com saldo e status derivados, opcionalmente de uma competência.';

-- Todos os números falam da COMPETÊNCIA escolhida, não do caixa do mês corrente: a lista logo
-- abaixo dos cards é filtrada por competência, e misturar as duas leituras faria os cards não
-- baterem com a soma da tabela que o coach vê na mesma tela.
create or replace function public.coach_finance_summary(p_reference_month date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reference_month', date_trunc('month', coalesce(p_reference_month, current_date))::date,
    'charged_cents', coalesce(sum(charge_list.original_amount_cents) filter (where charge_list.status <> 'cancelled'), 0),
    'received_cents', coalesce(sum(charge_list.paid_amount_cents), 0),
    'outstanding_cents', coalesce(sum(charge_list.outstanding_amount_cents) filter (where charge_list.status <> 'cancelled'), 0),
    'overdue_cents', coalesce(sum(charge_list.outstanding_amount_cents) filter (where charge_list.is_overdue), 0),
    'overdue_count', count(*) filter (where charge_list.is_overdue),
    'forgiven_cents', coalesce(sum(charge_list.forgiven_amount_cents), 0),
    'charge_count', count(*)
  )
  from public.list_coach_charges(coalesce(p_reference_month, current_date)) charge_list;
$$;

comment on function public.coach_finance_summary(date) is
  'Totais da competência para os cards do painel financeiro do coach.';

-- ---------------------------------------------------------------------------
-- Escrita: recebimento manual, perdão e cancelamento
-- ---------------------------------------------------------------------------

-- Uma cobrança só é operável pelo coach dono dela e enquanto não estiver cancelada.
create or replace function public.assert_charge_is_operable(p_charge_id uuid)
returns public.charges
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  charge_row public.charges%rowtype;
begin
  select * into charge_row from public.charges where id = p_charge_id;

  if charge_row.id is null then
    raise exception using message = 'Cobrança não encontrada.';
  end if;

  if charge_row.coach_id <> auth.uid() and not public.is_platform_owner() then
    raise exception using message = 'Somente o coach responsável pode operar esta cobrança.';
  end if;

  if charge_row.cancelled_at is not null then
    raise exception using message = 'Esta cobrança foi cancelada.';
  end if;

  return charge_row;
end;
$$;

comment on function public.assert_charge_is_operable(uuid) is
  'Valida existência, propriedade e estado da cobrança antes de qualquer lançamento.';

create or replace function public.register_manual_payment(
  p_charge_id uuid,
  p_amount_cents integer,
  p_payment_method public.charge_payment_method,
  p_paid_at date default null,
  p_notes text default null
)
returns public.charge_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.charge_payments%rowtype;
  outstanding integer;
begin
  perform public.assert_charge_is_operable(p_charge_id);

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using message = 'O valor recebido precisa ser maior que zero.';
  end if;

  select outstanding_amount_cents into outstanding
  from public.charge_balances
  where charge_id = p_charge_id;

  if outstanding <= 0 then
    raise exception using message = 'Esta cobrança já está quitada.';
  end if;

  -- Recusado no banco, não só na tela: receber mais do que se cobrou é erro de digitação, e
  -- deixar passar contamina o faturamento sem deixar rastro do engano.
  if p_amount_cents > outstanding then
    raise exception using message =
      'O valor recebido é maior que o saldo em aberto desta cobrança.';
  end if;

  insert into public.charge_payments (
    charge_id, amount_cents, source, payment_method, paid_at, notes, created_by
  )
  values (
    p_charge_id,
    p_amount_cents,
    'manual',
    p_payment_method,
    coalesce(p_paid_at, current_date),
    nullif(btrim(p_notes), ''),
    auth.uid()
  )
  returning * into payment_row;

  return payment_row;
end;
$$;

comment on function public.register_manual_payment(uuid, integer, public.charge_payment_method, date, text) is
  'Registra dinheiro recebido fora da plataforma. Entra como receita, com origem manual.';

create or replace function public.forgive_charge(
  p_charge_id uuid,
  p_amount_cents integer,
  p_reason text
)
returns public.charge_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  adjustment_row public.charge_adjustments%rowtype;
  outstanding integer;
begin
  perform public.assert_charge_is_operable(p_charge_id);

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using message = 'O valor a perdoar precisa ser maior que zero.';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using message = 'Descreva o motivo do perdão.';
  end if;

  select outstanding_amount_cents into outstanding
  from public.charge_balances
  where charge_id = p_charge_id;

  if outstanding <= 0 then
    raise exception using message = 'Esta cobrança não tem saldo em aberto.';
  end if;

  if p_amount_cents > outstanding then
    raise exception using message = 'O valor a perdoar é maior que o saldo em aberto.';
  end if;

  insert into public.charge_adjustments (charge_id, type, amount_cents, reason, created_by)
  values (p_charge_id, 'forgiveness', p_amount_cents, btrim(p_reason), auth.uid())
  returning * into adjustment_row;

  return adjustment_row;
end;
$$;

comment on function public.forgive_charge(uuid, integer, text) is
  'Perdoa parte ou todo o saldo. Reduz o saldo sem entrar como receita.';

create or replace function public.cancel_charge(p_charge_id uuid, p_reason text)
returns public.charges
language plpgsql
security definer
set search_path = public
as $$
declare
  charge_row public.charges%rowtype;
begin
  perform public.assert_charge_is_operable(p_charge_id);

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using message = 'Descreva o motivo do cancelamento.';
  end if;

  if exists (select 1 from public.charge_payments where charge_id = p_charge_id) then
    raise exception using message =
      'Esta cobrança já recebeu pagamento e não pode ser cancelada. Perdoe o saldo restante.';
  end if;

  update public.charges
  set cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = btrim(p_reason)
  where id = p_charge_id
  returning * into charge_row;

  return charge_row;
end;
$$;

comment on function public.cancel_charge(uuid, text) is
  'Cancela uma cobrança emitida por engano. Bloqueado quando já houve pagamento.';

-- ---------------------------------------------------------------------------
-- Histórico da cobrança
-- ---------------------------------------------------------------------------

-- A timeline sai do próprio razão: como pagamentos e ajustes são append-only e carregam autor e
-- data, não existe histórico paralelo para manter em sincronia.
create or replace function public.charge_history(p_charge_id uuid)
returns table (
  kind text,
  amount_cents integer,
  detail text,
  actor_display_name text,
  happened_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.charges charge_row
    where charge_row.id = p_charge_id
      and (
        charge_row.coach_id = auth.uid()
        or charge_row.athlete_id = auth.uid()
        or public.is_platform_owner()
      )
  ) then
    raise exception using message = 'Cobrança não encontrada.';
  end if;

  -- O union vive numa subquery e o ORDER BY é qualificado por ela de propósito: `happened_at`
  -- solto seria resolvido como o parâmetro OUT desta função (nulo), não como a coluna.
  return query
  select event.kind, event.amount_cents, event.detail, event.actor_display_name, event.happened_at
  from (
    select
      'created'::text as kind,
      charge_row.original_amount_cents as amount_cents,
      charge_row.description as detail,
      null::text as actor_display_name,
      charge_row.created_at as happened_at
    from public.charges charge_row
    where charge_row.id = p_charge_id

    union all
    select
      'payment'::text,
      payment_row.amount_cents,
      payment_row.payment_method::text,
      coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))),
      payment_row.created_at
    from public.charge_payments payment_row
    left join auth.users user_row on user_row.id = payment_row.created_by
    left join public.profiles profile_row on profile_row.user_id = payment_row.created_by
    where payment_row.charge_id = p_charge_id

    union all
    select
      'forgiveness'::text,
      adjustment_row.amount_cents,
      adjustment_row.reason,
      coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))),
      adjustment_row.created_at
    from public.charge_adjustments adjustment_row
    left join auth.users user_row on user_row.id = adjustment_row.created_by
    left join public.profiles profile_row on profile_row.user_id = adjustment_row.created_by
    where adjustment_row.charge_id = p_charge_id

    union all
    select
      'cancelled'::text,
      null::integer,
      charge_row.cancellation_reason,
      coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))),
      charge_row.cancelled_at
    from public.charges charge_row
    left join auth.users user_row on user_row.id = charge_row.cancelled_by
    left join public.profiles profile_row on profile_row.user_id = charge_row.cancelled_by
    where charge_row.id = p_charge_id
      and charge_row.cancelled_at is not null
  ) event
  order by event.happened_at;
end;
$$;

comment on function public.charge_history(uuid) is
  'Linha do tempo da cobrança montada a partir do razão, para coach e atleta.';

-- ---------------------------------------------------------------------------
-- Leitura do atleta
-- ---------------------------------------------------------------------------

create or replace function public.list_my_charges()
returns table (
  id uuid,
  coach_display_name text,
  reference_month date,
  description text,
  due_date date,
  original_amount_cents integer,
  paid_amount_cents integer,
  outstanding_amount_cents integer,
  status public.charge_status,
  is_overdue boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    charge_row.id,
    coalesce(profile_row.display_name, initcap(split_part(user_row.email, '@', 1))) as coach_display_name,
    charge_row.reference_month,
    charge_row.description,
    charge_row.due_date,
    balance_row.original_amount_cents,
    balance_row.paid_amount_cents,
    balance_row.outstanding_amount_cents,
    balance_row.status,
    balance_row.is_overdue
  from public.charges charge_row
  join public.charge_balances balance_row on balance_row.charge_id = charge_row.id
  join auth.users user_row on user_row.id = charge_row.coach_id
  left join public.profiles profile_row on profile_row.user_id = charge_row.coach_id
  where charge_row.athlete_id = auth.uid()
  order by charge_row.reference_month desc, charge_row.due_date desc;
$$;

comment on function public.list_my_charges() is
  'Mensalidades do atleta autenticado, da mais recente para a mais antiga.';

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

revoke all on function public.list_coach_billing_roster() from public;
revoke all on function public.upsert_billing_plan(uuid, uuid, integer, smallint, text) from public;
revoke all on function public.deactivate_billing_plan(uuid) from public;
revoke all on function public.generate_month_charges(date) from public;
revoke all on function public.list_coach_charges(date) from public;
revoke all on function public.coach_finance_summary(date) from public;
revoke all on function public.assert_charge_is_operable(uuid) from public;
revoke all on function public.register_manual_payment(uuid, integer, public.charge_payment_method, date, text) from public;
revoke all on function public.forgive_charge(uuid, integer, text) from public;
revoke all on function public.cancel_charge(uuid, text) from public;
revoke all on function public.charge_history(uuid) from public;
revoke all on function public.list_my_charges() from public;

grant execute on function public.list_coach_billing_roster() to authenticated;
grant execute on function public.upsert_billing_plan(uuid, uuid, integer, smallint, text) to authenticated;
grant execute on function public.deactivate_billing_plan(uuid) to authenticated;
grant execute on function public.generate_month_charges(date) to authenticated;
grant execute on function public.list_coach_charges(date) to authenticated;
grant execute on function public.coach_finance_summary(date) to authenticated;
grant execute on function public.register_manual_payment(uuid, integer, public.charge_payment_method, date, text) to authenticated;
grant execute on function public.forgive_charge(uuid, integer, text) to authenticated;
grant execute on function public.cancel_charge(uuid, text) to authenticated;
grant execute on function public.charge_history(uuid) to authenticated;
grant execute on function public.list_my_charges() to authenticated;

notify pgrst, 'reload schema';
