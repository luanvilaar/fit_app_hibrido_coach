-- Rollback das tentativas de pagamento (20260816100000_charge_payment_intents.sql).
--
-- Derruba o histórico de tentativas (QR gerados, recusas). NÃO afeta receita: os pagamentos
-- confirmados vivem em `charge_payments`, que é independente desta tabela.

drop table if exists public.charge_payment_intents;

drop type if exists public.payment_intent_method;
drop type if exists public.payment_intent_status;

notify pgrst, 'reload schema';
