const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => mockSend(...args) }
  }))
}));

jest.mock("./env", () => ({
  resendConfig: () => ({ apiKey: "re_test", from: "FitBlock Training <noreply@fitblock.test>" })
}));

import { sendTransactionalEmail } from "./resend";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("sendTransactionalEmail", () => {
  it("manda o e-mail com o remetente configurado", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await sendTransactionalEmail({ to: "ana@fitblock.test", subject: "Oi", html: "<p>Oi</p>" });

    expect(mockSend).toHaveBeenCalledWith({
      from: "FitBlock Training <noreply@fitblock.test>",
      to: "ana@fitblock.test",
      subject: "Oi",
      html: "<p>Oi</p>"
    });
  });

  it("lança quando o Resend recusa o envio", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "domínio não verificado", statusCode: 403, name: "invalid_from_address" }
    });

    await expect(
      sendTransactionalEmail({ to: "ana@fitblock.test", subject: "Oi", html: "<p>Oi</p>" })
    ).rejects.toThrow("domínio não verificado");
  });
});
