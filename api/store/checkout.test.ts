import type { SupabaseClient } from "@supabase/supabase-js";
import { ConnectionMissingError } from "../_lib/connection";
import handlerModule from "./checkout";
const handler = handlerModule.fetch;

const mockAuthenticate = jest.fn();
const mockServiceRoleClient = jest.fn();
const mockGetValidAccessToken = jest.fn();

jest.mock("../_lib/auth", () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  serviceRoleClient: (...args: unknown[]) => mockServiceRoleClient(...args)
}));

jest.mock("../_lib/connection", () => ({
  ConnectionMissingError: class ConnectionMissingError extends Error {},
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args)
}));

jest.mock("../_lib/env", () => ({
  appOrigin: () => "https://fitblock.app"
}));

const product = {
  id: "product-1",
  seller_coach_id: "coach-1",
  title: "Base de Força",
  price_cents: 19900,
  status: "published" as "published" | "draft"
};

function createClient(options: {
  product?: typeof product | null;
  existingOrder?: { id: string; seller_coach_id: string; total_amount_cents: number; status: "pending" } | null;
  existingIntent?: { provider_payment_id: string; status: "pending"; amount_cents: number; qr_code: string; qr_code_base64: string; expires_at: string } | null;
  attempts?: number;
  paymentInsertError?: { code?: string } | null;
}) {
  const productQuery = query({ data: options.product === undefined ? product : options.product });
  const orderQuery = query({ data: options.existingOrder ?? null });
  const intentQuery = query({ data: options.existingIntent ?? null });
  const attemptsQuery = query({ count: options.attempts ?? 0 });
  const orderItemInsert = query({ error: null });
  const orderUpdate = query({ error: null });

  const from = jest.fn((table: string) => {
    if (table === "store_products") return productQuery;
    if (table === "store_orders") return options.existingOrder === undefined ? orderQuery : orderQuery;
    if (table === "store_payment_intents") {
      return options.existingOrder && options.existingIntent ? intentQuery : attemptsQuery;
    }
    if (table === "store_order_items") return orderItemInsert;
    return orderUpdate;
  });

  // The checkout uses the same table twice: pending order lookup, then order insert/update.
  orderQuery.insert = jest.fn().mockReturnValue(orderQuery);
  orderQuery.select = jest.fn().mockReturnValue(orderQuery);
  orderQuery.single = jest.fn().mockResolvedValue({
    data: { id: "order-1", seller_coach_id: product.seller_coach_id, total_amount_cents: product.price_cents, status: "pending" },
    error: null
  });
  orderQuery.update = jest.fn().mockReturnValue(orderQuery);
  orderQuery.eq = jest.fn().mockReturnValue(orderQuery);

  const paymentIntents = {
    insert: jest.fn().mockResolvedValue({ error: options.paymentInsertError ?? null })
  };
  const client = { from } as unknown as SupabaseClient;
  return { client, from, paymentIntents, attemptsQuery, orderQuery, orderItemInsert };
}

function query(result: { data?: unknown; error?: unknown; count?: number }) {
  const value = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null }),
    single: jest.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ count: result.count ?? null, error: result.error ?? null }))
  } as unknown as Record<string, jest.Mock | ((resolve: (value: unknown) => unknown) => Promise<unknown>)>;
  return value;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticate.mockResolvedValue({ id: "athlete-1", email: "aluno@example.com" });
  mockGetValidAccessToken.mockResolvedValue({ accessToken: "access-token", publicKey: null, liveMode: false });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("POST /api/store/checkout", () => {
  it("usa o preço do produto e uma chave idempotente por pedido", async () => {
    const fake = createClient({});
    mockServiceRoleClient.mockReturnValue(fake.client);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 987,
        status: "pending",
        date_of_expiration: "2026-08-19T12:00:00.000Z",
        point_of_interaction: { transaction_data: { qr_code: "000201...", qr_code_base64: "base64" } }
      })
    }) as unknown as typeof fetch;

    const response = await handler(new Request("https://fitblock.app/api/store/checkout", {
      method: "POST",
      body: JSON.stringify({ product_id: "product-1", method: "pix" })
    }));

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-idempotency-key": "store:order-1:19900:1" }),
        body: expect.stringContaining('"transaction_amount":199')
      })
    );
    expect(await response.json()).toMatchObject({ payment_id: "987", amount_cents: 19900, qr_code: "000201..." });
  });

  it("não permite comprar produto que saiu da vitrine", async () => {
    const fake = createClient({ product: { ...product, status: "draft" } });
    mockServiceRoleClient.mockReturnValue(fake.client);

    const response = await handler(new Request("https://fitblock.app/api/store/checkout", {
      method: "POST",
      body: JSON.stringify({ product_id: "product-1", method: "pix" })
    }));

    expect(response.status).toBe(404);
    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
  });

  it("devolve conflito quando o coach ainda não conectou o Mercado Pago", async () => {
    const fake = createClient({});
    mockServiceRoleClient.mockReturnValue(fake.client);
    mockGetValidAccessToken.mockRejectedValue(new ConnectionMissingError());

    const response = await handler(new Request("https://fitblock.app/api/store/checkout", {
      method: "POST",
      body: JSON.stringify({ product_id: "product-1", method: "pix" })
    }));

    expect(response.status).toBe(409);
  });

  it("reusa um PIX pendente sem criar outro pagamento", async () => {
    const fake = createClient({
      existingOrder: { id: "order-1", seller_coach_id: "coach-1", total_amount_cents: 19900, status: "pending" },
      existingIntent: {
        provider_payment_id: "123",
        status: "pending",
        amount_cents: 19900,
        qr_code: "existing-code",
        qr_code_base64: "existing-base64",
        expires_at: "2026-08-19T12:00:00.000Z"
      }
    });
    mockServiceRoleClient.mockReturnValue(fake.client);

    const response = await handler(new Request("https://fitblock.app/api/store/checkout", {
      method: "POST",
      body: JSON.stringify({ product_id: "product-1", method: "pix" })
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ payment_id: "123", qr_code: "existing-code" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
