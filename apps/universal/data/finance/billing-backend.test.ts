import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BillingBackendError,
  createBillingRepository,
  type CoachChargeRecord
} from "@fitblock/backend";

const charge: CoachChargeRecord = {
  id: "charge-01",
  athlete_id: "athlete-01",
  athlete_display_name: "Márcio Andrade",
  reference_month: "2026-08-01",
  description: "Mensalidade",
  due_date: "2026-08-10",
  original_amount_cents: 30000,
  paid_amount_cents: 20000,
  forgiven_amount_cents: 0,
  outstanding_amount_cents: 10000,
  status: "partially_paid",
  is_overdue: true,
  last_payment_method: "pix",
  last_paid_at: "2026-08-08"
};

function createMockClient(options?: { data?: unknown; error?: { message: string } }) {
  // `data` precisa distinguir "não informado" de "explicitamente nulo": é o caso nulo que
  // exercita o `?? []` do repositório, e um `??` aqui o engoliria de volta para o default.
  const hasData = options !== undefined && "data" in options;

  const client = {
    rpc: jest.fn().mockResolvedValue({
      data: options?.error ? null : hasData ? options?.data : [charge],
      error: options?.error ?? null
    })
  } as unknown as SupabaseClient;

  return { client, rpc: client.rpc as jest.Mock };
}

/**
 * Os nomes de parâmetro das RPCs são strings invisíveis ao TypeScript, e a migration é aplicada
 * à mão: um erro de digitação aqui só apareceria contra o banco real, já em produção e com
 * dinheiro envolvido.
 */
describe("billing backend repository", () => {
  it("define a mensalidade do aluno com os nomes de parâmetro da RPC", async () => {
    const { client, rpc } = createMockClient({ data: { id: "plan-01" } });
    const repository = createBillingRepository(client);

    await repository.upsertBillingPlan({
      athleteId: "athlete-01",
      teamId: "team-01",
      amountCents: 30000,
      dueDay: 10,
      description: "Plano mensal"
    });

    expect(rpc).toHaveBeenCalledWith("upsert_billing_plan", {
      p_athlete_id: "athlete-01",
      p_team_id: "team-01",
      p_amount_cents: 30000,
      p_due_day: 10,
      p_description: "Plano mensal"
    });
  });

  it("manda descrição nula quando o coach não escreveu nada", async () => {
    const { client, rpc } = createMockClient({ data: { id: "plan-01" } });
    const repository = createBillingRepository(client);

    await repository.upsertBillingPlan({
      athleteId: "athlete-01",
      teamId: "team-01",
      amountCents: 30000,
      dueDay: 10
    });

    expect(rpc).toHaveBeenCalledWith(
      "upsert_billing_plan",
      expect.objectContaining({ p_description: null })
    );
  });

  it("gera as cobranças da competência pedida", async () => {
    const { client, rpc } = createMockClient({
      data: { reference_month: "2026-08-01", created: 12, skipped: 0 }
    });
    const repository = createBillingRepository(client);

    await expect(repository.generateMonthCharges("2026-08-01")).resolves.toEqual({
      reference_month: "2026-08-01",
      created: 12,
      skipped: 0
    });

    expect(rpc).toHaveBeenCalledWith("generate_month_charges", {
      p_reference_month: "2026-08-01"
    });
  });

  it("lista as cobranças de uma competência", async () => {
    const { client, rpc } = createMockClient();
    const repository = createBillingRepository(client);

    await expect(repository.listCoachCharges("2026-08-01")).resolves.toEqual([charge]);
    expect(rpc).toHaveBeenCalledWith("list_coach_charges", { p_reference_month: "2026-08-01" });
  });

  it("aceita competência nula para pedir tudo", async () => {
    const { client, rpc } = createMockClient();
    const repository = createBillingRepository(client);

    await repository.listCoachCharges();

    expect(rpc).toHaveBeenCalledWith("list_coach_charges", { p_reference_month: null });
  });

  it("devolve lista vazia quando a RPC não traz nada, em vez de nulo", async () => {
    const { client } = createMockClient({ data: null });
    const repository = createBillingRepository(client);

    await expect(repository.listCoachCharges("2026-08-01")).resolves.toEqual([]);
  });

  it("registra o recebimento manual com valor em centavos e data opcional", async () => {
    const { client, rpc } = createMockClient({ data: null });
    const repository = createBillingRepository(client);

    await repository.registerManualPayment({
      chargeId: "charge-01",
      amountCents: 20000,
      paymentMethod: "pix",
      paidAt: "2026-08-08",
      notes: "PIX direto"
    });

    expect(rpc).toHaveBeenCalledWith("register_manual_payment", {
      p_charge_id: "charge-01",
      p_amount_cents: 20000,
      p_payment_method: "pix",
      p_paid_at: "2026-08-08",
      p_notes: "PIX direto"
    });
  });

  it("deixa o banco decidir a data quando o coach não informa", async () => {
    const { client, rpc } = createMockClient({ data: null });
    const repository = createBillingRepository(client);

    await repository.registerManualPayment({
      chargeId: "charge-01",
      amountCents: 20000,
      paymentMethod: "cash"
    });

    expect(rpc).toHaveBeenCalledWith(
      "register_manual_payment",
      expect.objectContaining({ p_paid_at: null, p_notes: null })
    );
  });

  it("perdoa o saldo levando o motivo junto", async () => {
    const { client, rpc } = createMockClient({ data: null });
    const repository = createBillingRepository(client);

    await repository.forgiveCharge({
      chargeId: "charge-01",
      amountCents: 10000,
      reason: "Acordo com o aluno"
    });

    expect(rpc).toHaveBeenCalledWith("forgive_charge", {
      p_charge_id: "charge-01",
      p_amount_cents: 10000,
      p_reason: "Acordo com o aluno"
    });
  });

  it("cancela a cobrança com motivo", async () => {
    const { client, rpc } = createMockClient({ data: null });
    const repository = createBillingRepository(client);

    await repository.cancelCharge("charge-01", "Emitida em duplicidade");

    expect(rpc).toHaveBeenCalledWith("cancel_charge", {
      p_charge_id: "charge-01",
      p_reason: "Emitida em duplicidade"
    });
  });

  it("pede o histórico de uma cobrança", async () => {
    const { client, rpc } = createMockClient({ data: [] });
    const repository = createBillingRepository(client);

    await repository.getChargeHistory("charge-01");

    expect(rpc).toHaveBeenCalledWith("charge_history", { p_charge_id: "charge-01" });
  });

  it("lê as mensalidades do próprio atleta sem passar id", async () => {
    const { client, rpc } = createMockClient({ data: [] });
    const repository = createBillingRepository(client);

    await repository.listMyCharges();

    // Sem parâmetro de atleta: quem responde pelo escopo é a RPC, não o client.
    expect(rpc).toHaveBeenCalledWith("list_my_charges");
  });

  it("traduz a falha do Supabase em erro de operação do financeiro", async () => {
    const { client } = createMockClient({
      error: { message: "O valor recebido é maior que o saldo em aberto desta cobrança." }
    });
    const repository = createBillingRepository(client);

    await expect(
      repository.registerManualPayment({
        chargeId: "charge-01",
        amountCents: 999999,
        paymentMethod: "pix"
      })
    ).rejects.toMatchObject<Partial<BillingBackendError>>({
      name: "BillingBackendError",
      message: "O valor recebido é maior que o saldo em aberto desta cobrança.",
      operation: "registerManualPayment"
    });
  });
});
