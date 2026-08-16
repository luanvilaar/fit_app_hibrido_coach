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

export function resendConfig() {
  return {
    apiKey: required("RESEND_API_KEY"),
    from: required("RESEND_FROM_EMAIL")
  };
}

/**
 * Domínio público do app, sem barra no final. Usado para montar URLs absolutas nos e-mails
 * (imagens, links) — um e-mail não tem `window.location`, então precisa vir de configuração.
 * Deliberadamente separada de `appOrigin()`: aquela exige `MERCADOPAGO_REDIRECT_URI`, e e-mail
 * não pode depender de pagamento estar configurado para funcionar.
 */
export function publicAppUrl(): string {
  return required("PUBLIC_APP_URL").replace(/\/+$/, "");
}

/**
 * Segredo do "Send Email Hook" do Supabase, no formato bruto "v1,whsec_...". A biblioteca
 * `standardwebhooks` espera só a parte depois de "v1,whsec_" — o prefixo some aqui, perto de onde
 * a variável é lida, para o resto do código nunca precisar saber desse detalhe do formato.
 */
export function supabaseAuthHookSecret(): string {
  return required("SUPABASE_AUTH_HOOK_SECRET").replace(/^v1,whsec_/, "");
}
