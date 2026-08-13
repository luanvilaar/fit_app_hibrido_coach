import type { FitBlockSupabaseClient } from "./supabase";

/**
 * Todo valor trafega em centavos inteiros, como no banco. A conversão para "R$ 300,00" acontece
 * na borda da UI — dinheiro em `number` decimal acumula erro de ponto flutuante e vira
 * divergência de centavo no relatório.
 */
export type ChargeStatus =
  | "pending"
  | "overdue"
  | "paid"
  | "partially_paid"
  | "forgiven"
  | "cancelled";

export type ChargePaymentMethod =
  | "pix"
  | "cash"
  | "bank_transfer"
  | "external_card"
  | "credit_card"
  | "debit_card"
  | "other";

export type ChargePaymentSource = "manual" | "mercado_pago";

/** Um atleta das equipes do coach, com o plano de cobrança ativo quando já existe. */
export type BillingRosterRecord = {
  athlete_id: string;
  athlete_display_name: string;
  team_id: string;
  team_name: string;
  plan_id: string | null;
  amount_cents: number | null;
  due_day: number | null;
  description: string | null;
};

export type BillingPlanRecord = {
  id: string;
  coach_id: string;
  athlete_id: string;
  team_id: string;
  amount_cents: number;
  due_day: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoachChargeRecord = {
  id: string;
  athlete_id: string;
  athlete_display_name: string;
  reference_month: string;
  description: string;
  due_date: string;
  original_amount_cents: number;
  paid_amount_cents: number;
  forgiven_amount_cents: number;
  outstanding_amount_cents: number;
  status: ChargeStatus;
  is_overdue: boolean;
  last_payment_method: ChargePaymentMethod | null;
  last_paid_at: string | null;
};

export type AthleteChargeRecord = {
  id: string;
  coach_display_name: string;
  reference_month: string;
  description: string;
  due_date: string;
  original_amount_cents: number;
  paid_amount_cents: number;
  outstanding_amount_cents: number;
  status: ChargeStatus;
  is_overdue: boolean;
};

export type FinanceSummaryRecord = {
  reference_month: string;
  charged_cents: number;
  received_cents: number;
  outstanding_cents: number;
  overdue_cents: number;
  overdue_count: number;
  forgiven_cents: number;
  charge_count: number;
};

export type GenerateChargesResult = {
  reference_month: string;
  created: number;
  skipped: number;
};

/** Evento da linha do tempo da cobrança, montado a partir do razão. */
export type ChargeHistoryEntry = {
  kind: "created" | "payment" | "forgiveness" | "cancelled";
  amount_cents: number | null;
  detail: string | null;
  actor_display_name: string | null;
  happened_at: string;
};

export type UpsertBillingPlanRequest = {
  athleteId: string;
  teamId: string;
  amountCents: number;
  dueDay: number;
  description?: string | null;
};

export type RegisterManualPaymentRequest = {
  chargeId: string;
  amountCents: number;
  paymentMethod: ChargePaymentMethod;
  paidAt?: string | null;
  notes?: string | null;
};

export type ForgiveChargeRequest = {
  chargeId: string;
  amountCents: number;
  reason: string;
};

export class BillingBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "BillingBackendError";
  }
}

export function createBillingRepository(client: FitBlockSupabaseClient) {
  return {
    async listBillingRoster(): Promise<BillingRosterRecord[]> {
      const { data, error } = await client.rpc("list_coach_billing_roster");

      if (error) {
        throw new BillingBackendError(error.message, "listBillingRoster");
      }

      return (data ?? []) as BillingRosterRecord[];
    },

    async upsertBillingPlan(input: UpsertBillingPlanRequest): Promise<BillingPlanRecord> {
      const { data, error } = await client.rpc("upsert_billing_plan", {
        p_athlete_id: input.athleteId,
        p_team_id: input.teamId,
        p_amount_cents: input.amountCents,
        p_due_day: input.dueDay,
        p_description: input.description ?? null
      });

      if (error) {
        throw new BillingBackendError(error.message, "upsertBillingPlan");
      }

      return data as BillingPlanRecord;
    },

    async deactivateBillingPlan(planId: string): Promise<BillingPlanRecord> {
      const { data, error } = await client.rpc("deactivate_billing_plan", { p_plan_id: planId });

      if (error) {
        throw new BillingBackendError(error.message, "deactivateBillingPlan");
      }

      return data as BillingPlanRecord;
    },

    /** Idempotente no banco: repetir a competência não duplica cobrança. */
    async generateMonthCharges(referenceMonth: string): Promise<GenerateChargesResult> {
      const { data, error } = await client.rpc("generate_month_charges", {
        p_reference_month: referenceMonth
      });

      if (error) {
        throw new BillingBackendError(error.message, "generateMonthCharges");
      }

      return data as GenerateChargesResult;
    },

    async listCoachCharges(referenceMonth: string | null = null): Promise<CoachChargeRecord[]> {
      const { data, error } = await client.rpc("list_coach_charges", {
        p_reference_month: referenceMonth
      });

      if (error) {
        throw new BillingBackendError(error.message, "listCoachCharges");
      }

      return (data ?? []) as CoachChargeRecord[];
    },

    async getFinanceSummary(referenceMonth: string | null = null): Promise<FinanceSummaryRecord> {
      const { data, error } = await client.rpc("coach_finance_summary", {
        p_reference_month: referenceMonth
      });

      if (error) {
        throw new BillingBackendError(error.message, "getFinanceSummary");
      }

      return data as FinanceSummaryRecord;
    },

    async registerManualPayment(input: RegisterManualPaymentRequest): Promise<void> {
      const { error } = await client.rpc("register_manual_payment", {
        p_charge_id: input.chargeId,
        p_amount_cents: input.amountCents,
        p_payment_method: input.paymentMethod,
        p_paid_at: input.paidAt ?? null,
        p_notes: input.notes ?? null
      });

      if (error) {
        throw new BillingBackendError(error.message, "registerManualPayment");
      }
    },

    async forgiveCharge(input: ForgiveChargeRequest): Promise<void> {
      const { error } = await client.rpc("forgive_charge", {
        p_charge_id: input.chargeId,
        p_amount_cents: input.amountCents,
        p_reason: input.reason
      });

      if (error) {
        throw new BillingBackendError(error.message, "forgiveCharge");
      }
    },

    async cancelCharge(chargeId: string, reason: string): Promise<void> {
      const { error } = await client.rpc("cancel_charge", {
        p_charge_id: chargeId,
        p_reason: reason
      });

      if (error) {
        throw new BillingBackendError(error.message, "cancelCharge");
      }
    },

    async getChargeHistory(chargeId: string): Promise<ChargeHistoryEntry[]> {
      const { data, error } = await client.rpc("charge_history", { p_charge_id: chargeId });

      if (error) {
        throw new BillingBackendError(error.message, "getChargeHistory");
      }

      return (data ?? []) as ChargeHistoryEntry[];
    },

    /** Leitura do atleta: só as próprias mensalidades, garantido pela RPC. */
    async listMyCharges(): Promise<AthleteChargeRecord[]> {
      const { data, error } = await client.rpc("list_my_charges");

      if (error) {
        throw new BillingBackendError(error.message, "listMyCharges");
      }

      return (data ?? []) as AthleteChargeRecord[];
    }
  };
}
