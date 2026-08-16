const mockAuthenticate = jest.fn();
const mockSendTransactionalEmail = jest.fn();
const mockRenderWelcomeEmail = jest.fn();

jest.mock("../_lib/auth", () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args)
}));

jest.mock("../_lib/env", () => ({
  publicAppUrl: () => "https://fitblock.test"
}));

jest.mock("../_lib/resend", () => ({
  sendTransactionalEmail: (...args: unknown[]) => mockSendTransactionalEmail(...args)
}));

jest.mock("../_lib/email-templates", () => ({
  renderWelcomeEmail: (...args: unknown[]) => mockRenderWelcomeEmail(...args)
}));

import handler from "./welcome";

beforeEach(() => {
  jest.clearAllMocks();
  mockSendTransactionalEmail.mockResolvedValue(undefined);
  mockRenderWelcomeEmail.mockReturnValue({ subject: "Boas-vindas", html: "<p>welcome</p>" });
});

function request(token?: string) {
  return new Request("https://fitblock.app/api/emails/welcome", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
}

describe("POST /api/emails/welcome", () => {
  it("recusa método diferente de POST", async () => {
    const response = await handler(new Request("https://fitblock.app/api/emails/welcome"));
    expect(response.status).toBe(405);
  });

  it("recusa quem não está autenticado", async () => {
    mockAuthenticate.mockResolvedValue(null);

    const response = await handler(request());

    expect(response.status).toBe(401);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("recusa conta sem e-mail", async () => {
    mockAuthenticate.mockResolvedValue({ id: "user-1", email: null });

    const response = await handler(request("token"));

    expect(response.status).toBe(400);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("manda o boas-vindas para o e-mail da própria sessão autenticada, nunca do corpo da requisição", async () => {
    mockAuthenticate.mockResolvedValue({ id: "user-1", email: "ana@fitblock.test" });

    const response = await handler(request("token"));

    expect(response.status).toBe(200);
    expect(mockRenderWelcomeEmail).toHaveBeenCalledWith({
      email: "ana@fitblock.test",
      actionUrl: "https://fitblock.test/app/hoje"
    });
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith({
      to: "ana@fitblock.test",
      subject: "Boas-vindas",
      html: "<p>welcome</p>"
    });
  });

  it("responde com erro quando o envio falha", async () => {
    mockAuthenticate.mockResolvedValue({ id: "user-1", email: "ana@fitblock.test" });
    mockSendTransactionalEmail.mockRejectedValue(new Error("Resend fora do ar"));

    const response = await handler(request("token"));

    expect(response.status).toBe(500);
  });
});
