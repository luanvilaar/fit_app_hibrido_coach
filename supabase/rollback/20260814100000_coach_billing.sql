-- Rollback do financeiro do coach (20260814100000_coach_billing.sql).
--
-- ATENÇÃO: derruba planos, cobranças, pagamentos e perdões. São dados financeiros — o razão é a
-- única fonte de verdade de quanto cada aluno pagou, e não há como reconstruí-lo depois. Exporte
-- billing_plans, charges, charge_payments e charge_adjustments antes de rodar isto em produção.
--
-- Ordem inversa da migration: funções, view, tabelas (filhas antes das pais) e tipos.

drop function if exists public.list_my_charges();
drop function if exists public.charge_history(uuid);
drop function if exists public.cancel_charge(uuid, text);
drop function if exists public.forgive_charge(uuid, integer, text);
drop function if exists public.register_manual_payment(uuid, integer, public.charge_payment_method, date, text);
drop function if exists public.assert_charge_is_operable(uuid);
drop function if exists public.coach_finance_summary(date);
drop function if exists public.list_coach_charges(date);
drop function if exists public.generate_month_charges(date);
drop function if exists public.deactivate_billing_plan(uuid);
drop function if exists public.upsert_billing_plan(uuid, uuid, integer, smallint, text);
drop function if exists public.list_coach_billing_roster();

drop view if exists public.charge_balances;

-- Policies e triggers caem junto com as tabelas.
drop table if exists public.charge_adjustments;
drop table if exists public.charge_payments;
drop table if exists public.charges;
drop table if exists public.billing_plans;

drop type if exists public.charge_adjustment_type;
drop type if exists public.charge_payment_method;
drop type if exists public.charge_payment_source;
drop type if exists public.charge_status;

notify pgrst, 'reload schema';
