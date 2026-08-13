/**
 * As variáveis que as funções de pagamento exigem, lidas num lugar só.
 *
 * Falta de configuração aqui é erro de operação, não de usuário: a função morre na primeira
 * chamada com o nome exato da variável ausente, em vez de falhar adiante com "invalid token" e
 * mandar alguém depurar o Mercado Pago.
 */

export type MercadoPagoMode = "test" | "live";

function required(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Variável de ambiente ausente: ${name}. Configure-a no projeto do Vercel.`);
  }

  return value.trim();
}

export function mercadoPagoConfig() {
  const mode = (process.env.MERCADOPAGO_MODE ?? "test").trim();

  if (mode !== "test" && mode !== "live") {
    throw new Error('MERCADOPAGO_MODE precisa ser "test" ou "live".');
  }

  return {
    clientId: required("MERCADOPAGO_CLIENT_ID"),
    clientSecret: required("MERCADOPAGO_CLIENT_SECRET"),
    redirectUri: required("MERCADOPAGO_REDIRECT_URI"),
    mode: mode as MercadoPagoMode
  };
}

export function supabaseConfig() {
  return {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: required("EXPO_PUBLIC_SUPABASE_ANON_KEY")
  };
}

export function encryptionKeyMaterial(): string {
  return required("PAYMENT_TOKEN_ENCRYPTION_KEY");
}

export function mercadoPagoWebhookSecret(): string {
  return required("MERCADOPAGO_WEBHOOK_SECRET");
}

/**
 * Para onde mandar o coach depois do callback do OAuth. Derivado do próprio `redirect_uri` para
 * não exigir mais uma variável só para saber o domínio do app.
 */
export function appOrigin(): string {
  return new URL(required("MERCADOPAGO_REDIRECT_URI")).origin;
}
