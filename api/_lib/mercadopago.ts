/**
 * O contrato do Mercado Pago que usamos, num arquivo só.
 *
 * Referências: OAuth em `https://auth.mercadopago.com/authorization` e
 * `POST https://api.mercadopago.com/oauth/token`.
 */

const AUTHORIZATION_URL = "https://auth.mercadopago.com/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";

/** O que o `POST /oauth/token` devolve, nas duas modalidades (código e refresh). */
export type MercadoPagoTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number | string;
  public_key?: string;
  live_mode?: boolean;
  scope?: string;
  token_type?: string;
};

export type AuthorizationUrlInput = {
  clientId: string;
  redirectUri: string;
  state: string;
};

/**
 * `offline_access` é obrigatório: sem esse escopo o Mercado Pago não emite `refresh_token`, e a
 * conexão morreria em 180 dias exigindo que o coach refizesse tudo à mão.
 */
export function authorizationUrl({ clientId, redirectUri, state }: AuthorizationUrlInput): string {
  const url = new URL(AUTHORIZATION_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "offline_access read write");

  return url.toString();
}

function isTokenResponse(value: unknown): value is MercadoPagoTokenResponse {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.access_token === "string"
    && typeof candidate.refresh_token === "string"
    && typeof candidate.expires_in === "number"
    && (typeof candidate.user_id === "number" || typeof candidate.user_id === "string")
  );
}

export class MercadoPagoError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

async function requestToken(body: Record<string, string>): Promise<MercadoPagoTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const description =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as Record<string, unknown>).message)
        : `HTTP ${response.status}`;

    throw new MercadoPagoError(description, response.status);
  }

  if (!isTokenResponse(payload)) {
    throw new MercadoPagoError("Resposta inesperada do Mercado Pago na troca de token.", 502);
  }

  return payload;
}

export type ExchangeInput = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
};

export function exchangeAuthorizationCode(input: ExchangeInput): Promise<MercadoPagoTokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri
  });
}

/**
 * O Mercado Pago **rotaciona o `refresh_token` a cada renovação**. Guardar só o novo
 * `access_token` e manter o refresh antigo derruba a conexão na renovação seguinte — quem chama
 * precisa regravar os dois.
 */
export function refreshAccessToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<MercadoPagoTokenResponse> {
  return requestToken({
    grant_type: "refresh_token",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken
  });
}

/** `expires_in` chega em segundos; o banco guarda o instante absoluto. */
export function expiresAtFrom(expiresIn: number, now: Date = new Date()): string {
  return new Date(now.getTime() + expiresIn * 1000).toISOString();
}
