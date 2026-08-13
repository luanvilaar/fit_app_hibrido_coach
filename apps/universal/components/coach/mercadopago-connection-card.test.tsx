import { Linking } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { MercadoPagoConnectionCard } from "@/components/coach/mercadopago-connection-card";

const mockRepository = { getStatus: jest.fn() };

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "jwt-123" } } })
    }
  },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createPaymentConnectionRepository: () => mockRepository
}));

function mockFetch(response: { ok: boolean; body: unknown }) {
  const spy = jest.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response.body
  });

  global.fetch = spy as unknown as typeof fetch;

  return spy;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

describe("conexão com o Mercado Pago", () => {
  it("oferece conectar quando ainda não há conta", async () => {
    mockRepository.getStatus.mockResolvedValue({ connected: false });

    render(<MercadoPagoConnectionCard />);

    await waitFor(() => expect(screen.getByTestId("mercadopago-connect")).toBeTruthy());
    expect(screen.queryByTestId("mercadopago-disconnect")).toBeNull();
  });

  it("manda o JWT da sessão e abre a URL que o servidor devolve", async () => {
    mockRepository.getStatus.mockResolvedValue({ connected: false });
    const fetchSpy = mockFetch({
      ok: true,
      body: { authorization_url: "https://auth.mercadopago.com/authorization?x=1" }
    });

    render(<MercadoPagoConnectionCard />);
    await waitFor(() => expect(screen.getByTestId("mercadopago-connect")).toBeTruthy());

    fireEvent.press(screen.getByTestId("mercadopago-connect"));

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(
      "https://auth.mercadopago.com/authorization?x=1"
    ));

    // A identidade vai no header assinado; o corpo nunca carrega um coach_id.
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe("/api/mercadopago/connect");
    expect(init.headers.authorization).toBe("Bearer jwt-123");
  });

  it("mostra a conta conectada e a opção de desconectar", async () => {
    mockRepository.getStatus.mockResolvedValue({
      connected: true,
      account_email: "coach@fitblock.com",
      live_mode: true
    });

    render(<MercadoPagoConnectionCard />);

    await waitFor(() => expect(screen.getByTestId("mercadopago-connected")).toBeTruthy());
    expect(screen.getByTestId("mercadopago-disconnect")).toBeTruthy();
    expect(screen.queryByTestId("mercadopago-sandbox")).toBeNull();
  });

  it("avisa quando a conta conectada é de teste", async () => {
    mockRepository.getStatus.mockResolvedValue({
      connected: true,
      account_email: "test@fitblock.com",
      live_mode: false
    });

    render(<MercadoPagoConnectionCard />);

    // Sem este aviso o coach passa um mês recebendo em sandbox sem perceber.
    await waitFor(() => expect(screen.getByTestId("mercadopago-sandbox")).toBeTruthy());
  });

  it("pede reconexão quando a autorização venceu", async () => {
    mockRepository.getStatus.mockResolvedValue({
      connected: true,
      account_email: "coach@fitblock.com",
      live_mode: true,
      needs_reconnect: true
    });

    render(<MercadoPagoConnectionCard />);

    await waitFor(() => expect(screen.getByTestId("mercadopago-expired")).toBeTruthy());
  });

  it("desconecta e relê o estado", async () => {
    mockRepository.getStatus
      .mockResolvedValueOnce({ connected: true, account_email: "coach@fitblock.com", live_mode: true })
      .mockResolvedValueOnce({ connected: false });
    mockFetch({ ok: true, body: { connected: false } });

    render(<MercadoPagoConnectionCard />);
    await waitFor(() => expect(screen.getByTestId("mercadopago-disconnect")).toBeTruthy());

    fireEvent.press(screen.getByTestId("mercadopago-disconnect"));

    await waitFor(() => expect(screen.getByTestId("mercadopago-connect")).toBeTruthy());
  });

  it("mostra o erro que o servidor explicou, sem inventar outro", async () => {
    mockRepository.getStatus.mockResolvedValue({ connected: false });
    mockFetch({ ok: false, body: { error: "Apenas treinadores podem conectar uma conta." } });

    render(<MercadoPagoConnectionCard />);
    await waitFor(() => expect(screen.getByTestId("mercadopago-connect")).toBeTruthy());

    fireEvent.press(screen.getByTestId("mercadopago-connect"));

    await waitFor(() =>
      expect(screen.getByTestId("mercadopago-error")).toHaveTextContent(
        "Apenas treinadores podem conectar uma conta."
      )
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("traduz a falha ao ler o estado da conexão", async () => {
    mockRepository.getStatus.mockRejectedValue(new Error("permission denied"));

    render(<MercadoPagoConnectionCard />);

    await waitFor(() => expect(screen.getByTestId("mercadopago-error")).toBeTruthy());
  });
});
