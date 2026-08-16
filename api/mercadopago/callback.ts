import { serviceRoleClient } from "../_lib/auth.js";
import { encryptSecret } from "../_lib/crypto.js";
import { appOrigin, encryptionKeyMaterial, mercadoPagoConfig } from "../_lib/env.js";
import { methodNotAllowed, redirect } from "../_lib/http.js";
import { exchangeAuthorizationCode, expiresAtFrom } from "../_lib/mercadopago.js";

/**
 * O retorno do Mercado Pago depois que o coach autoriza.
 *
 * Quem chega aqui é o navegador do coach vindo do provedor, sem o JWT do app — por isso a
 * identidade não vem de um token, e sim do `state` que guardamos ao iniciar o fluxo. É esse
 * vínculo que impede o callback de aceitar um `code` de origem qualquer e conectar a conta de um
 * terceiro ao coach errado.
 *
 * Sempre termina em redirect para o painel, com o resultado na query: quem está do outro lado é
 * uma janela de navegador, não código esperando JSON.
 */
async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");

  const panel = `${appOrigin()}/app/coach/financeiro`;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // O coach clicou em "cancelar" na tela do Mercado Pago.
  if (url.searchParams.get("error")) {
    return redirect(`${panel}?mp=cancelado`);
  }

  if (!code || !state) {
    return redirect(`${panel}?mp=erro`);
  }

  try {
    const client = serviceRoleClient();

    // Uso único: o update condicionado a `consumed_at is null` é o que impede replay do mesmo
    // state por duas requisições simultâneas — quem perde a corrida não recebe linha de volta.
    const { data: claimed, error: claimError } = await client
      .from("payment_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state", state)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("coach_id")
      .maybeSingle();

    if (claimError) throw claimError;

    if (!claimed) {
      return redirect(`${panel}?mp=estado_invalido`);
    }

    const config = mercadoPagoConfig();

    const token = await exchangeAuthorizationCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code
    });

    const keyMaterial = encryptionKeyMaterial();

    const { error: upsertError } = await client.from("payment_provider_connections").upsert(
      {
        coach_id: claimed.coach_id,
        provider: "mercado_pago",
        provider_user_id: String(token.user_id),
        access_token_encrypted: await encryptSecret(token.access_token, keyMaterial),
        refresh_token_encrypted: await encryptSecret(token.refresh_token, keyMaterial),
        expires_at: expiresAtFrom(token.expires_in),
        public_key: token.public_key ?? null,
        live_mode: token.live_mode ?? config.mode === "live",
        connected_at: new Date().toISOString()
      },
      { onConflict: "coach_id,provider" }
    );

    if (upsertError) throw upsertError;

    // Estados vencidos não têm mais utilidade e a tabela não deve virar um log de tentativas.
    await client
      .from("payment_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    return redirect(`${panel}?mp=conectado`);
  } catch (error: unknown) {
    console.error("[pagamentos] callback:", error);
    return redirect(`${panel}?mp=erro`);
  }
}

export default { fetch: handler };
