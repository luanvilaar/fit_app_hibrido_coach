import {
  MercadoPagoError,
  authorizationUrl,
  exchangeAuthorizationCode,
  expiresAtFrom,
  refreshAccessToken
} from "./mercadopago";

const tokenResponse = {
  access_token: "APP_USR-access",
  refresh_token: "TG-refresh",
  expires_in: 15552000,
  user_id: 123456789,
  public_key: "APP_USR-public",
  live_mode: false
};

function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
  const spy = jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body
  });

  global.fetch = spy as unknown as typeof fetch;

  return spy;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("url de autorização", () => {
  const input = {
    clientId: "app-1",
    redirectUri: "https://fitblock.app/api/mercadopago/callback",
    state: "state-123"
  };

  it("aponta para o domínio de autorização do Mercado Pago", () => {
    expect(authorizationUrl(input)).toContain("https://auth.mercadopago.com/authorization");
  });

  it("leva os parâmetros que o provedor exige", () => {
    const url = new URL(authorizationUrl(input));

    expect(url.searchParams.get("client_id")).toBe("app-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("platform_id")).toBe("mp");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("redirect_uri")).toBe(input.redirectUri);
  });

  it("pede offline_access, sem o qual não existe refresh token", () => {
    // Sem esse escopo a conexão morre em 180 dias e o coach precisa refazer tudo à mão.
    expect(new URL(authorizationUrl(input)).searchParams.get("scope")).toContain("offline_access");
  });
});

describe("troca do código por token", () => {
  it("envia grant_type de authorization_code com as credenciais da aplicação", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 200, body: tokenResponse });

    await exchangeAuthorizationCode({
      clientId: "app-1",
      clientSecret: "secret",
      redirectUri: "https://fitblock.app/api/mercadopago/callback",
      code: "code-abc"
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/oauth/token");
    expect(JSON.parse(init.body)).toEqual({
      grant_type: "authorization_code",
      client_id: "app-1",
      client_secret: "secret",
      code: "code-abc",
      redirect_uri: "https://fitblock.app/api/mercadopago/callback"
    });
  });

  it("traduz a falha do provedor em erro com status", async () => {
    mockFetch({ ok: false, status: 400, body: { message: "invalid_grant" } });

    await expect(
      exchangeAuthorizationCode({
        clientId: "app-1",
        clientSecret: "secret",
        redirectUri: "https://fitblock.app/callback",
        code: "expirado"
      })
    ).rejects.toMatchObject<Partial<MercadoPagoError>>({
      name: "MercadoPagoError",
      message: "invalid_grant",
      status: 400
    });
  });

  it("recusa resposta sem os campos que a conexão depende", async () => {
    // Um 200 sem refresh_token deixaria a conexão gravada e quebrada meses depois.
    mockFetch({ ok: true, status: 200, body: { access_token: "só-isso" } });

    await expect(
      exchangeAuthorizationCode({
        clientId: "app-1",
        clientSecret: "secret",
        redirectUri: "https://fitblock.app/callback",
        code: "code"
      })
    ).rejects.toThrow(/inesperada/i);
  });
});

describe("renovação do token", () => {
  it("envia grant_type de refresh_token", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 200, body: tokenResponse });

    await refreshAccessToken({
      clientId: "app-1",
      clientSecret: "secret",
      refreshToken: "TG-antigo"
    });

    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
      grant_type: "refresh_token",
      client_id: "app-1",
      client_secret: "secret",
      refresh_token: "TG-antigo"
    });
  });

  it("devolve o refresh token novo, que o provedor rotaciona a cada uso", async () => {
    mockFetch({
      ok: true,
      status: 200,
      body: { ...tokenResponse, refresh_token: "TG-novo" }
    });

    const renewed = await refreshAccessToken({
      clientId: "app-1",
      clientSecret: "secret",
      refreshToken: "TG-antigo"
    });

    expect(renewed.refresh_token).toBe("TG-novo");
  });
});

describe("validade do token", () => {
  it("converte segundos em instante absoluto", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");

    expect(expiresAtFrom(3600, now)).toBe("2026-08-15T13:00:00.000Z");
  });

  it("cobre os 180 dias que o Mercado Pago concede", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");

    expect(expiresAtFrom(15552000, now)).toBe("2027-02-11T00:00:00.000Z");
  });
});
