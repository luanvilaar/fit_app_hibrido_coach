import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type {
  BillingRosterRecord,
  CoachChargeRecord,
  FinanceSummaryRecord
} from "@fitblock/backend";
import { FinanceScreen } from "@/components/coach/finance-screen";

const mockRepository = {
  listCoachCharges: jest.fn(),
  getFinanceSummary: jest.fn(),
  listBillingRoster: jest.fn(),
  generateMonthCharges: jest.fn(),
  registerManualPayment: jest.fn(),
  forgiveCharge: jest.fn(),
  upsertBillingPlan: jest.fn()
};

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createBillingRepository: () => mockRepository,
  createPaymentConnectionRepository: () => ({
    getStatus: jest.fn().mockResolvedValue({ connected: false })
  })
}));

const overdue: CoachChargeRecord = {
  id: "charge-overdue",
  athlete_id: "athlete-01",
  athlete_display_name: "Márcio Andrade",
  reference_month: "2026-08-01",
  description: "Mensalidade",
  due_date: "2026-08-10",
  original_amount_cents: 30000,
  paid_amount_cents: 0,
  forgiven_amount_cents: 0,
  outstanding_amount_cents: 30000,
  status: "overdue",
  is_overdue: true,
  last_payment_method: null,
  last_paid_at: null
};

const paid: CoachChargeRecord = {
  ...overdue,
  id: "charge-paid",
  athlete_id: "athlete-02",
  athlete_display_name: "Joana Prado",
  paid_amount_cents: 30000,
  outstanding_amount_cents: 0,
  status: "paid",
  is_overdue: false,
  last_payment_method: "pix",
  last_paid_at: "2026-08-09"
};

const summary: FinanceSummaryRecord = {
  reference_month: "2026-08-01",
  charged_cents: 60000,
  received_cents: 30000,
  outstanding_cents: 30000,
  overdue_cents: 30000,
  overdue_count: 1,
  forgiven_cents: 0,
  charge_count: 2
};

const roster: BillingRosterRecord[] = [
  {
    athlete_id: "athlete-01",
    athlete_display_name: "Márcio Andrade",
    team_id: "team-01",
    team_name: "Time da manhã",
    plan_id: "plan-01",
    amount_cents: 30000,
    due_day: 10,
    description: null
  },
  {
    athlete_id: "athlete-03",
    athlete_display_name: "Rui Barbosa",
    team_id: "team-01",
    team_name: "Time da manhã",
    plan_id: null,
    amount_cents: null,
    due_day: null,
    description: null
  }
];

async function renderScreen() {
  render(<FinanceScreen />);
  await waitFor(() => expect(screen.getByTestId("finance-count")).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRepository.listCoachCharges.mockResolvedValue([overdue, paid]);
  mockRepository.getFinanceSummary.mockResolvedValue(summary);
  mockRepository.listBillingRoster.mockResolvedValue(roster);
  mockRepository.generateMonthCharges.mockResolvedValue({
    reference_month: "2026-08-01",
    created: 2,
    skipped: 0
  });
  mockRepository.registerManualPayment.mockResolvedValue(undefined);
  mockRepository.forgiveCharge.mockResolvedValue(undefined);
  mockRepository.upsertBillingPlan.mockResolvedValue({ id: "plan-01" });
});

describe("painel financeiro do coach", () => {
  it("carrega cobranças, resumo e alunos da competência atual", async () => {
    await renderScreen();

    expect(screen.getByTestId("summary-received")).toBeTruthy();
    expect(screen.getByTestId("charge-charge-overdue")).toBeTruthy();
    expect(screen.getByTestId("charge-charge-paid")).toBeTruthy();
  });

  it("anda de competência e relê o mês pedido", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("finance-month-previous"));

    await waitFor(() =>
      expect(mockRepository.listCoachCharges).toHaveBeenLastCalledWith("2026-07-01")
    );
  });

  it("filtra os atrasados sem esconder a parcial vencida", async () => {
    const partialOverdue: CoachChargeRecord = {
      ...overdue,
      id: "charge-partial",
      athlete_display_name: "Ana Lima",
      paid_amount_cents: 10000,
      outstanding_amount_cents: 20000,
      status: "partially_paid"
    };
    mockRepository.listCoachCharges.mockResolvedValue([overdue, paid, partialOverdue]);

    await renderScreen();
    fireEvent.press(screen.getByTestId("finance-filter-overdue"));

    expect(screen.getByTestId("charge-charge-overdue")).toBeTruthy();
    expect(screen.getByTestId("charge-charge-partial")).toBeTruthy();
    expect(screen.queryByTestId("charge-charge-paid")).toBeNull();
  });

  it("busca por nome sem exigir acento", async () => {
    await renderScreen();

    fireEvent.changeText(screen.getByTestId("finance-search"), "marcio");

    expect(screen.getByTestId("charge-charge-overdue")).toBeTruthy();
    expect(screen.queryByTestId("charge-charge-paid")).toBeNull();
  });

  it("não oferece ações para cobrança já quitada", async () => {
    await renderScreen();

    expect(screen.getByTestId("charge-charge-overdue-pay")).toBeTruthy();
    expect(screen.queryByTestId("charge-charge-paid-pay")).toBeNull();
    expect(screen.queryByTestId("charge-charge-paid-forgive")).toBeNull();
  });

  it("registra o recebimento com o saldo já preenchido", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("charge-charge-overdue-pay"));

    // O caso comum é receber o valor cheio: redigitar o que o sistema sabe só gera erro.
    expect(screen.getByTestId("payment-amount").props.value).toBe("300,00");

    fireEvent.press(screen.getByTestId("payment-method-cash"));
    fireEvent.press(screen.getByTestId("payment-submit"));

    await waitFor(() =>
      expect(mockRepository.registerManualPayment).toHaveBeenCalledWith({
        chargeId: "charge-overdue",
        amountCents: 30000,
        paymentMethod: "cash",
        notes: null
      })
    );
  });

  it("recusa receber mais que o saldo antes de chamar o backend", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("charge-charge-overdue-pay"));
    fireEvent.changeText(screen.getByTestId("payment-amount"), "500,00");
    fireEvent.press(screen.getByTestId("payment-submit"));

    expect(screen.getByTestId("payment-validation")).toBeTruthy();
    expect(mockRepository.registerManualPayment).not.toHaveBeenCalled();
  });

  it("exige motivo para perdoar, sem chamar o backend", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("charge-charge-overdue-forgive"));
    fireEvent.press(screen.getByTestId("forgive-submit"));

    expect(screen.getByTestId("forgive-validation")).toBeTruthy();
    expect(mockRepository.forgiveCharge).not.toHaveBeenCalled();
  });

  it("perdoa levando valor e motivo", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("charge-charge-overdue-forgive"));
    fireEvent.changeText(screen.getByTestId("forgive-amount"), "100,00");
    fireEvent.changeText(screen.getByTestId("forgive-reason"), "Acordo com o aluno");
    fireEvent.press(screen.getByTestId("forgive-submit"));

    await waitFor(() =>
      expect(mockRepository.forgiveCharge).toHaveBeenCalledWith({
        chargeId: "charge-overdue",
        amountCents: 10000,
        reason: "Acordo com o aluno"
      })
    );
  });

  it("gera as cobranças da competência e relê a lista", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("finance-generate"));

    await waitFor(() =>
      expect(mockRepository.generateMonthCharges).toHaveBeenCalledWith("2026-08-01")
    );
    expect(screen.getByTestId("finance-success")).toBeTruthy();
  });

  it("define a mensalidade de quem ainda não tem plano", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("finance-view-plans"));
    expect(screen.getByTestId("plan-athlete-03-empty")).toBeTruthy();

    fireEvent.press(screen.getByTestId("plan-athlete-03-edit"));
    fireEvent.changeText(screen.getByTestId("plan-amount"), "250");
    fireEvent.changeText(screen.getByTestId("plan-due-day"), "5");
    fireEvent.press(screen.getByTestId("plan-submit"));

    await waitFor(() =>
      expect(mockRepository.upsertBillingPlan).toHaveBeenCalledWith({
        athleteId: "athlete-03",
        teamId: "team-01",
        amountCents: 25000,
        dueDay: 5,
        description: null
      })
    );
  });

  it("recusa dia de vencimento fora da faixa que o banco aceita", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("finance-view-plans"));
    fireEvent.press(screen.getByTestId("plan-athlete-03-edit"));
    fireEvent.changeText(screen.getByTestId("plan-amount"), "250");
    fireEvent.changeText(screen.getByTestId("plan-due-day"), "31");
    fireEvent.press(screen.getByTestId("plan-submit"));

    expect(screen.getByTestId("plan-validation")).toBeTruthy();
    expect(mockRepository.upsertBillingPlan).not.toHaveBeenCalled();
  });

  it("explica o vazio dizendo qual é o próximo passo", async () => {
    mockRepository.listCoachCharges.mockResolvedValue([]);
    mockRepository.listBillingRoster.mockResolvedValue([roster[1]]);

    render(<FinanceScreen />);

    await waitFor(() => expect(screen.getByTestId("finance-empty")).toBeTruthy());
    // Sem nenhum plano definido, o caminho é definir mensalidade — não gerar cobrança.
    expect(screen.getByTestId("finance-open-plans")).toBeTruthy();
  });

  it("traduz a falha do backend no carregamento", async () => {
    mockRepository.listCoachCharges.mockRejectedValue(new Error("permission denied for table charges"));

    render(<FinanceScreen />);

    await waitFor(() => expect(screen.getByTestId("finance-error")).toBeTruthy());
  });
});
