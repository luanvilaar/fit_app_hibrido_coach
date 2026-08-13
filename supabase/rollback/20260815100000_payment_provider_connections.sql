-- Rollback da conexão de pagamento (20260815100000_payment_provider_connections.sql).
--
-- ATENÇÃO: derrubar `payment_provider_connections` desconecta todos os coaches do Mercado Pago.
-- Os tokens são perdidos e cada coach precisa refazer o OAuth. Isso não afeta pagamentos já
-- registrados em `charge_payments` — o razão é independente da conexão.

drop function if exists public.my_payment_connection_status();

drop table if exists public.payment_oauth_states;
drop table if exists public.payment_provider_connections;

drop type if exists public.payment_provider;

notify pgrst, 'reload schema';
