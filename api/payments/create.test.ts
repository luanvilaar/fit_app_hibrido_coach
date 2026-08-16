import type { SupabaseClient } from "@supabase/supabase-js";
import { ConnectionMissingError } from "../_lib/connection";
import handlerModule from "./create";
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

function createClient(options: {
  charge?: Record<string, unknown> | null;
  balance?: Record<string, unknown> | null;
  attempts?: number;
  insertError?: { code?: string } | null;
}) {
  const chargeQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: options.charge ?? null, error: null })
  };
  const balanceQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: options.balance ?? null, error: null })
  };
  const attemptsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: options.insertError ?? null })
  };
  Object.assign(attemptsQuery, {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ count: options.attempts ?? 0, error: null }))
  });
  const from = jest.fn((table: string) => {
    if (table === "charges") return chargeQuery;
    if (table === "charge_balances") return balanceQuery;
    if (table === "charge_payment_intents") return attemptsQuery;
    return attemptsQuery;
  });

  return { client: { from } as unknown as SupabaseClient, from, intentQuery: attemptsQuery };
}

const charge = {
  id: "charge-1",
  coach_id: "coach-1",
  athlete_id: "athlete-1",
  description: "Mensalidade agosto",
  cancelled_at: null
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticate.mockResolvedValue({ id: "athlete-1", email: "aluno@example.com" });
  mockGetValidAccessToken.mockResolvedValue({
    accessToken: "access-token",
    publicKey: null,
    liveMode: false
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("POST /api/payments/create", () => {
  it("converte centavos para reais e usa uma chave estável por tentativa", async () => {
    const { client } = createClient({ charge, balance: { outstanding_amount_cents: 1234 } });
    mockServiceRoleClient.mockReturnValue(client);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 987,
        status: "pending",
        date_of_expiration: "2026-08-19T12:00:00.000Z",
        point_of_interaction: {
          transaction_data: { qr_code: "000201...", qr_code_base64: "base64" }
        }
      })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await handler(
      new Request("https://fitblock.app/api/payments/create", {
        method: "POST",
        body: JSON.stringify({ charge_id: "charge-1", method: "pix" })
      })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-idempotency-key": "charge-1:1234:1" }),
        body: expect.stringContaining('"transaction_amount":12.34')
      })
    );
    expect(await response.json()).toMatchObject({
      payment_id: "987",
      amount_cents: 1234,
      qr_code: "000201..."
    });
  });

  it("exige o método PIX antes de consultar o provedor", async () => {
    const { client } = createClient({ charge });
    mockServiceRoleClient.mockReturnValue(client);

    const response = await handler(
      new Request("https://fitblock.app/api/payments/create", {
        method: "POST",
        body: JSON.stringify({ charge_id: "charge-1", method: "credit_card" })
      })
    );

    expect(response.status).toBe(400);
    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
  });

  it("traduz a ausência da conexão do coach para conflito compreensível", async () => {
    const { client } = createClient({ charge, balance: { outstanding_amount_cents: 1000 } });
    mockServiceRoleClient.mockReturnValue(client);
    mockGetValidAccessToken.mockRejectedValue(new ConnectionMissingError());

    const response = await handler(
      new Request("https://fitblock.app/api/payments/create", {
        method: "POST",
        body: JSON.stringify({ charge_id: "charge-1", method: "pix" })
      })
    );

    expect(response.status).toBe(409);
  });
});
