const mockVerify = jest.fn();
const mockSendTransactionalEmail = jest.fn();
const mockRenderWelcomeEmail = jest.fn();
const mockRenderPasswordResetEmail = jest.fn();

jest.mock("standardwebhooks", () => {
  class WebhookVerificationError extends Error {}
  return {
    Webhook: jest.fn().mockImplementation(() => ({ verify: (...args: unknown[]) => mockVerify(...args) })),
    WebhookVerificationError
  };
});

jest.mock("../_lib/env", () => ({
  supabaseAuthHookSecret: () => "test-secret",
  supabaseConfig: () => ({
    url: "https://project.supabase.co",
    serviceRoleKey: "service-role",
    anonKey: "anon"
  })
}));

jest.mock("../_lib/resend", () => ({
  sendTransactionalEmail: (...args: unknown[]) => mockSendTransactionalEmail(...args)
}));

jest.mock("../_lib/email-templates", () => ({
  renderWelcomeEmail: (...args: unknown[]) => mockRenderWelcomeEmail(...args),
  renderPasswordResetEmail: (...args: unknown[]) => mockRenderPasswordResetEmail(...args)
}));

import { WebhookVerificationError } from "standardwebhooks";
import handler from "./supabase-auth-email";

beforeEach(() => {
  jest.clearAllMocks();
  mockSendTransactionalEmail.mockResolvedValue(undefined);
  mockRenderWelcomeEmail.mockReturnValue({ subject: "Boas-vindas", html: "<p>welcome</p>" });
  mockRenderPasswordResetEmail.mockReturnValue({ subject: "Redefinir sua senha FitBlock", html: "<p>reset</p>" });
});

function request(body: unknown) {
  return new Request("https://fitblock.app/api/webhooks/supabase-auth-email", {
    method: "POST",
    headers: {
      "webhook-id": "msg-1",
      "webhook-timestamp": "1700000000",
      "webhook-signature": "v1,signature"
    },
    body: JSON.stringify(body)
  });
}

const validPayload = {
  user: { id: "user-1", email: "ana@fitblock.test" },
  email_data: {
    token_hash: "token-hash",
    email_action_type: "signup",
    redirect_to: "https://fitblock.app/entrar"
  }
};

describe("POST /api/webhooks/supabase-auth-email", () => {
  it("recusa método diferente de POST", async () => {
    const response = await handler(new Request("https://fitblock.app/api/webhooks/supabase-auth-email"));
    expect(response.status).toBe(405);
  });

  it("recusa assinatura inválida", async () => {
    mockVerify.mockImplementation(() => {
      throw new WebhookVerificationError("bad signature");
    });

    const response = await handler(request(validPayload));

    expect(response.status).toBe(401);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("recusa payload que não tem o formato esperado do Supabase", async () => {
    mockVerify.mockReturnValue({ nada: "a ver" });

    const response = await handler(request(validPayload));

    expect(response.status).toBe(400);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("envia o e-mail de boas-vindas para o tipo signup, com o link de verificação do Supabase", async () => {
    mockVerify.mockReturnValue(validPayload);

    const response = await handler(request(validPayload));

    expect(response.status).toBe(200);
    expect(mockRenderWelcomeEmail).toHaveBeenCalledWith({
      email: "ana@fitblock.test",
      actionUrl:
        "https://project.supabase.co/auth/v1/verify?token=token-hash&type=signup&redirect_to=https%3A%2F%2Ffitblock.app%2Fentrar"
    });
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith({
      to: "ana@fitblock.test",
      subject: "Boas-vindas",
      html: "<p>welcome</p>"
    });
  });

  it("envia o e-mail de redefinição de senha para o tipo recovery", async () => {
    const payload = {
      ...validPayload,
      email_data: { ...validPayload.email_data, email_action_type: "recovery" }
    };
    mockVerify.mockReturnValue(payload);

    const response = await handler(request(payload));

    expect(response.status).toBe(200);
    expect(mockRenderPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ana@fitblock.test" })
    );
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@fitblock.test", subject: "Redefinir sua senha FitBlock" })
    );
  });

  it("cai num e-mail genérico de marca para tipos sem template dedicado", async () => {
    const payload = {
      ...validPayload,
      email_data: { ...validPayload.email_data, email_action_type: "email_change" }
    };
    mockVerify.mockReturnValue(payload);

    const response = await handler(request(payload));

    expect(response.status).toBe(200);
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@fitblock.test", subject: "Uma ação é necessária na sua conta FitBlock" })
    );
  });

  it("recebe o evento sem tentar enviar quando o usuário não tem e-mail", async () => {
    mockVerify.mockReturnValue({ ...validPayload, user: { id: "user-1", email: null } });

    const response = await handler(request(validPayload));

    expect(response.status).toBe(200);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("responde 500 quando o envio falha, para o Supabase reentregar", async () => {
    mockVerify.mockReturnValue(validPayload);
    mockSendTransactionalEmail.mockRejectedValue(new Error("Resend fora do ar"));

    const response = await handler(request(validPayload));

    expect(response.status).toBe(500);
  });
});
