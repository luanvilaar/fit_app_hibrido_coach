import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { encryptionKeyMaterial, mercadoPagoConfig } from "./env.js";
import { expiresAtFrom, refreshAccessToken } from "./mercadopago.js";

export type ProviderConnection = {
  coach_id: string;
  provider_user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  public_key: string | null;
  live_mode: boolean;
};

export class ConnectionMissingError extends Error {
  constructor() {
    super("Este treinador ainda não conectou uma conta de recebimento.");
    this.name = "ConnectionMissingError";
  }
}

/**
 * Renova com folga em vez de esperar o vencimento: um token que expira entre a checagem e a
 * chamada ao provedor derrubaria um pagamento já em curso.
 */
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export function needsRenewal(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() - now.getTime() <= RENEW_BEFORE_MS;
}

/**
 * O access token utilizável do coach, renovando quando está perto de vencer.
 *
 * A renovação regrava **os dois** tokens: o Mercado Pago rotaciona o `refresh_token` a cada uso, e
 * manter o antigo faria a conexão morrer na renovação seguinte — com o agravante de só aparecer
 * meses depois, quando ninguém mais lembra desta linha.
 */
export async function getValidAccessToken(
  client: SupabaseClient,
  coachId: string
): Promise<{ accessToken: string; publicKey: string | null; liveMode: boolean }> {
  const { data, error } = await client
    .from("payment_provider_connections")
    .select(
      "coach_id, provider_user_id, access_token_encrypted, refresh_token_encrypted, expires_at, public_key, live_mode"
    )
    .eq("coach_id", coachId)
    .eq("provider", "mercado_pago")
    .maybeSingle<ProviderConnection>();

  if (error) throw error;
  if (!data) throw new ConnectionMissingError();

  const keyMaterial = encryptionKeyMaterial();

  if (!needsRenewal(data.expires_at)) {
    return {
      accessToken: await decryptSecret(data.access_token_encrypted, keyMaterial),
      publicKey: data.public_key,
      liveMode: data.live_mode
    };
  }

  const config = mercadoPagoConfig();

  const renewed = await refreshAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: await decryptSecret(data.refresh_token_encrypted, keyMaterial)
  });

  const { error: updateError } = await client
    .from("payment_provider_connections")
    .update({
      access_token_encrypted: await encryptSecret(renewed.access_token, keyMaterial),
      refresh_token_encrypted: await encryptSecret(renewed.refresh_token, keyMaterial),
      expires_at: expiresAtFrom(renewed.expires_in),
      public_key: renewed.public_key ?? data.public_key
    })
    .eq("coach_id", coachId)
    .eq("provider", "mercado_pago");

  if (updateError) throw updateError;

  return {
    accessToken: renewed.access_token,
    publicKey: renewed.public_key ?? data.public_key,
    liveMode: data.live_mode
  };
}
