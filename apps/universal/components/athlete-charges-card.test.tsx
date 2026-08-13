import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { AthleteChargeRecord } from "@fitblock/backend";
import { AthleteChargesCard } from "@/components/athlete-charges-card";

const mockRepository = {
  listMyCharges: jest.fn()
};
const mockGetSession = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn(), auth: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createBillingRepository: () => mockRepository
}));

function charge(patch: Partial<AthleteChargeRecord> = {}): AthleteChargeRecord {
  return {
    id: "charge-1",
    coach_display_name: "Luan Vilar",
    reference_month: "2026-08-01",
    description: "Mensalidade",
    due_date: "2026-08-10",
    original_amount_cents: 30000,
    paid_amount_cents: 0,
    outstanding_amount_cents: 30000,
    status: "pending",
    is_overdue: false,
    ...patch
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "jwt-token" } } });
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe("mensalidade do atleta", () => {
  it("some da tela quando o treinador não cobra pela plataforma", async () => {
    mockRepository.listMyCharges.mockResolvedValue([]);

    render(<AthleteChargesCard />);

    // Um card vazio diria ao aluno que existe cobrança onde não existe.
    await waitFor(() => expect(mockRepository.listMyCharges).toHaveBeenCalled());
    expect(screen.queryByTestId("athlete-charges-card")).toBeNull();
  });

  it("destaca o atraso acima do histórico", async () => {
    mockRepository.listMyCharges.mockResolvedValue([
      charge({ id: "julho", due_date: "2026-07-10", is_overdue: true, status: "overdue" })
    ]);

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charges-overdue")).toBeTruthy());
    expect(screen.getByTestId("athlete-charge-julho")).toBeTruthy();
  });

  it("mostra o próximo vencimento quando nada venceu ainda", async () => {
    mockRepository.listMyCharges.mockResolvedValue([charge()]);

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charges-next")).toBeTruthy());
    expect(screen.queryByTestId("athlete-charges-overdue")).toBeNull();
  });

  it("diz que está tudo em dia quando não há saldo", async () => {
    mockRepository.listMyCharges.mockResolvedValue([
      charge({ outstanding_amount_cents: 0, paid_amount_cents: 30000, status: "paid" })
    ]);

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charges-clear")).toBeTruthy());
  });

  it("lista o histórico de competências", async () => {
    mockRepository.listMyCharges.mockResolvedValue([
      charge({ id: "agosto", reference_month: "2026-08-01" }),
      charge({
        id: "julho",
        reference_month: "2026-07-01",
        outstanding_amount_cents: 0,
        paid_amount_cents: 30000,
        status: "paid"
      })
    ]);

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charge-agosto")).toBeTruthy());
    expect(screen.getByTestId("athlete-charge-julho")).toBeTruthy();
  });

  it("traduz a falha do backend em vez de sumir calado", async () => {
    mockRepository.listMyCharges.mockRejectedValue(new Error("permission denied for table charges"));

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charges-error")).toBeTruthy());
  });

  it("só mostra pagar agora para cobranças com saldo e não canceladas", async () => {
    mockRepository.listMyCharges.mockResolvedValue([
      charge({ id: "aberta" }),
      charge({ id: "paga", outstanding_amount_cents: 0, status: "paid" }),
      charge({ id: "cancelada", status: "cancelled" })
    ]);

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charge-pay-aberta")).toBeTruthy());
    expect(screen.queryByTestId("athlete-charge-pay-paga")).toBeNull();
    expect(screen.queryByTestId("athlete-charge-pay-cancelada")).toBeNull();
  });

  it("mostra ao atleta a mensagem do treinador sem conexão quando a API responde 409", async () => {
    mockRepository.listMyCharges.mockResolvedValue([charge()]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Seu treinador ainda não conectou uma conta para receber pagamentos pelo app." })
    });

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charge-pay-charge-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("athlete-charge-pay-charge-1"));

    await waitFor(() => expect(screen.getByTestId("athlete-payment-error")).toBeTruthy());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/payments/create",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer jwt-token" }),
        body: JSON.stringify({ charge_id: "charge-1", method: "pix" })
      })
    );
  });

  it("abre o diálogo com QR e copia-e-cola depois de gerar o PIX", async () => {
    mockRepository.listMyCharges.mockResolvedValue([charge()]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        payment_id: "987",
        status: "pending",
        qr_code: "000201PIX",
        qr_code_base64: "base64-qr",
        expires_at: null,
        amount_cents: 30000
      })
    });

    render(<AthleteChargesCard />);

    await waitFor(() => expect(screen.getByTestId("athlete-charge-pay-charge-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("athlete-charge-pay-charge-1"));

    await waitFor(() => expect(screen.getByTestId("athlete-payment-qr")).toBeTruthy());
    expect(screen.getByTestId("athlete-payment-code")).toHaveDisplayValue("000201PIX");
    expect(screen.getByTestId("athlete-payment-polling")).toBeTruthy();
  });

  it("encerra o polling e fecha o diálogo quando a cobrança é quitada", async () => {
    jest.useFakeTimers();
    mockRepository.listMyCharges
      .mockResolvedValueOnce([charge()])
      .mockResolvedValueOnce([
        charge({ outstanding_amount_cents: 0, paid_amount_cents: 30000, status: "paid" })
      ]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        payment_id: "987",
        status: "pending",
        qr_code: "000201PIX",
        qr_code_base64: null,
        expires_at: null,
        amount_cents: 30000
      })
    });

    render(<AthleteChargesCard />);
    await waitFor(() => expect(screen.getByTestId("athlete-charge-pay-charge-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("athlete-charge-pay-charge-1"));
    await waitFor(() => expect(screen.getByTestId("athlete-payment-dialog")).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("athlete-payment-dialog")).toBeNull();
    jest.useRealTimers();
  });
});
