-- Conexão do coach com o Mercado Pago (OAuth), para que o pagamento do aluno caia na conta do
-- próprio treinador.
--
-- Esta migration quebra de propósito o padrão de RLS do resto do projeto, e o motivo importa:
--
-- Em todas as outras tabelas, a RLS existe para deixar o client ler o que é dele. Aqui **não
-- existe leitura legítima pelo client**. `payment_provider_connections` guarda o access_token do
-- Mercado Pago do coach — uma credencial de 180 dias que movimenta dinheiro. Ela é lida
-- exclusivamente pelas funções de servidor (Vercel), que usam a service role e portanto ignoram
-- RLS. Por isso a tabela tem RLS habilitada e **zero policies**: com a anon key, nem o próprio
-- dono enxerga a linha. O coach vê o estado da conexão por `my_payment_connection_status()`, que
-- devolve só campos inócuos.
--
-- Os tokens ainda chegam aqui cifrados (AES-256-GCM, chave só no ambiente do servidor). Banco
-- comprometido — dump, backup, acesso indevido ao painel — não entrega credencial utilizável.

create type public.payment_provider as enum ('mercado_pago');

create table public.payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  provider public.payment_provider not null default 'mercado_pago',

  -- Identificação da conta do vendedor no provedor.
  provider_user_id text not null,
  account_email text,

  -- Cifrados na aplicação; o banco nunca vê o texto claro.
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,

  -- Pública por definição: é ela que o SDK do cliente usa para tokenizar cartão.
  public_key text,

  -- false = credenciais de teste. Existe para a UI avisar, em vez de o coach descobrir que
  -- passou um mês recebendo em sandbox.
  live_mode boolean not null default false,

  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma conexão por coach e provedor: reconectar substitui, não acumula.
create unique index payment_provider_connections_unique_coach
  on public.payment_provider_connections (coach_id, provider);

create trigger payment_provider_connections_set_updated_at
before update on public.payment_provider_connections
for each row execute procedure public.set_updated_at();

alter table public.payment_provider_connections enable row level security;

-- Nenhuma policy, deliberadamente. Ver o cabeçalho.

revoke all on public.payment_provider_connections from anon, authenticated;

-- ---------------------------------------------------------------------------
-- oauth_states — amarra o retorno do provedor ao coach que iniciou
-- ---------------------------------------------------------------------------

-- Sem isto, o callback aceita qualquer `code` que chegue e vincula a conta de um terceiro ao
-- coach errado. O state é aleatório, tem validade curta e é de uso único.
create table public.payment_oauth_states (
  state text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  provider public.payment_provider not null default 'mercado_pago',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payment_oauth_states_expires_at_idx on public.payment_oauth_states(expires_at);

alter table public.payment_oauth_states enable row level security;

-- Também sem policies: criado e consumido apenas pelo servidor.

revoke all on public.payment_oauth_states from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Estado da conexão para a UI do coach
-- ---------------------------------------------------------------------------

-- O que o coach pode saber sobre a própria conexão sem que nada sensível saia do servidor.
-- `security definer` porque a tabela é inacessível ao papel `authenticated` por construção.
create or replace function public.my_payment_connection_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'connected', true,
        'provider', connection_row.provider,
        'account_email', connection_row.account_email,
        'live_mode', connection_row.live_mode,
        'connected_at', connection_row.connected_at,
        -- O token expirou e o refresh não rodou: a UI precisa dizer "reconecte".
        'needs_reconnect', connection_row.expires_at < now()
      )
      from public.payment_provider_connections connection_row
      where connection_row.coach_id = auth.uid()
      limit 1
    ),
    jsonb_build_object('connected', false)
  );
$$;

comment on function public.my_payment_connection_status() is
  'Estado da conexão de pagamento do coach autenticado, sem nenhum campo sensível.';

revoke all on function public.my_payment_connection_status() from public;
grant execute on function public.my_payment_connection_status() to authenticated;

notify pgrst, 'reload schema';
