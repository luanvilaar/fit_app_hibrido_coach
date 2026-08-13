import type { SupabaseClient } from "@supabase/supabase-js";
import handler from "./mercadopago";

const mockServiceRoleClient = jest.fn();
const mockGetValidAccessToken = jest.fn();
const mockIsValidSignature = jest.fn();

jest.mock("../_lib/auth", () => ({
  serviceRoleClient: (...args: unknown[]) => mockServiceRoleClient(...args)
}));

jest.mock("../_lib/connection", () => ({
  ConnectionMissingError: class ConnectionMissingError extends Error {},
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args)
}));

jest.mock("../_lib/env", () => ({
  mercadoPagoWebhookSecret: () => "webhook-secret"
}));

jest.mock("../_lib/webhook-signature", () => ({
  isValidSignature: (...args: unknown[]) => mockIsValidSignature(...args)
}));

const intent = {
  id: "intent-1",
  charge_id: "charge-1",
  athlete_id: "athlete-1",
  coach_id: "coach-1",
  provider_payment_id: "987"
};

const storeIntent = {
  id: "store-intent-1",
  order_id: "order-1",
  buyer_id: "athlete-1",
  seller_coach_id: "coach-1",
  provider_payment_id: "987"
};

function createClient(options: {
  foundIntent?: typeof intent | null;
  foundStoreIntent?: typeof storeIntent | null;
  paymentInsertError?: { code?: string } | null;
}) {
  const intentSelect = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: options.foundIntent ?? null, error: null })
  };
  const intentUpdate = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null })
  };
  const paymentInsert = {
    insert: jest.fn().mockResolvedValue({ error: options.paymentInsertError ?? null })
  };
  const storeIntentSelect = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: options.foundStoreIntent ?? null, error: null })
  };
  const storeIntentUpdate = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null })
  };
  const rpc = jest.fn().mockResolvedValue({ data: "order-1", error: null });
  const from = jest.fn((table: string) => {
    if (table === "charge_payment_intents") {
      return intentSelect.maybeSingle.mock.calls.length === 0 ? intentSelect : intentUpdate;
    }

    if (table === "store_payment_intents") {
      return storeIntentSelect.maybeSingle.mock.calls.length === 0 ? storeIntentSelect : storeIntentUpdate;
    }

    return paymentInsert;
  });

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    intentSelect,
    intentUpdate,
    paymentInsert,
    storeIntentSelect,
    storeIntentUpdate,
    rpc
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsValidSignature.mockResolvedValue(true);
  mockGetValidAccessToken.mockResolvedValue({ accessToken: "access-token" });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function request(body: unknown) {
  return new Request("https://fitblock.app/api/webhooks/mercadopago", {
    method: "POST",
    headers: { "x-signature": "ts=1700000000,v1=signature", "x-request-id": "request-1" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/webhooks/mercadopago", () => {
  it("recusa evento sem assinatura válida", async () => {
    mockIsValidSignature.mockResolvedValue(false);

    const response = await handler(request({ type: "payment", data: { id: "987" } }));

    expect(response.status).toBe(401);
    expect(mockServiceRoleClient).not.toHaveBeenCalled();
  });

  it("relê o pagamento e grava receita aprovada", async () => {
    const fake = createClient({ foundIntent: intent });
    mockServiceRoleClient.mockReturnValue(fake.client);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 987,
        status: "approved",
        transaction_amount: 12.34,
        payment_method_id: "pix",
        date_approved: "2026-08-16T14:20:00.000Z"
      })
    }) as unknown as typeof fetch;

    const response = await handler(request({ type: "payment", data: { id: "987" } }));

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/987",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer access-token" })
      })
    );
    expect(fake.paymentInsert.insert).toHaveBeenCalledWith({
      charge_id: "charge-1",
      amount_cents: 1234,
      source: "mercado_pago",
      payment_method: "pix",
      paid_at: "2026-08-16",
      provider_payment_id: "987",
      created_by: null
    });
  });

  it("trata conflito do índice único como reentrega bem-sucedida", async () => {
    const fake = createClient({ foundIntent: intent, paymentInsertError: { code: "23505" } });
    mockServiceRoleClient.mockReturnValue(fake.client);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 987,
        status: "approved",
        transaction_amount: 12.34,
        payment_method_id: "pix",
        date_approved: "2026-08-16T14:20:00.000Z"
      })
    }) as unknown as typeof fetch;

    await expect(handler(request({ type: "payment", data: { id: "987" } }))).resolves.toMatchObject({
      status: 200
    });
  });

  it("não confia no status do aviso e só atualiza o que a API do provedor informa", async () => {
    const fake = createClient({ foundIntent: intent });
    mockServiceRoleClient.mockReturnValue(fake.client);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 987, status: "rejected" })
    }) as unknown as typeof fetch;

    await handler(request({ type: "payment", data: { id: "987" }, status: "approved" }));

    expect(fake.paymentInsert.insert).not.toHaveBeenCalled();
    expect(fake.intentUpdate.update).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("libera o programa somente no settlement do pedido aprovado", async () => {
    const fake = createClient({ foundStoreIntent: storeIntent });
    mockServiceRoleClient.mockReturnValue({ ...fake.client, rpc: fake.rpc });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 987,
        status: "approved",
        transaction_amount: 199,
        payment_method_id: "pix",
        date_approved: "2026-08-16T14:20:00.000Z"
      })
    }) as unknown as typeof fetch;

    const response = await handler(request({ type: "payment", data: { id: "987" } }));

    expect(response.status).toBe(200);
    expect(fake.storeIntentUpdate.update).toHaveBeenCalledWith({ status: "approved" });
    expect(fake.rpc).toHaveBeenCalledWith("settle_store_order", {
      p_provider_payment_id: "987",
      p_amount_cents: 19900,
      p_paid_at: "2026-08-16T14:20:00.000Z"
    });
  });

  it("ignora um pagamento que não pertence às intenções desta aplicação", async () => {
    const fake = createClient({ foundIntent: null });
    mockServiceRoleClient.mockReturnValue(fake.client);

    const response = await handler(request({ type: "payment", data: { id: "other" } }));

    expect(response.status).toBe(200);
    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
  });
});
