import { authenticate, isCoach, serviceRoleClient } from "../_lib/auth.js";
import { randomToken } from "../_lib/crypto.js";
import { mercadoPagoConfig } from "../_lib/env.js";
import { failure, json, logAndFail, methodNotAllowed } from "../_lib/http.js";
import { authorizationUrl } from "../_lib/mercadopago.js";

/** Dez minutos é folga suficiente para o coach autorizar sem deixar um state válido por aí. */
const STATE_TTL_MINUTES = 10;

/**
 * Começa a conexão da conta do coach.
 *
 * Devolve a URL de autorização em vez de redirecionar: quem chama é o app com um JWT no header, e
 * um `302` não carregaria esse header adiante. O app abre a URL retornada.
 */
async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    const user = await authenticate(request);

    if (!user) return failure("Sua sessão expirou. Entre novamente.", 401);

    const client = serviceRoleClient();

    if (!(await isCoach(client, user.id))) {
      return failure("Apenas treinadores podem conectar uma conta de recebimento.", 403);
    }

    const config = mercadoPagoConfig();
    const state = randomToken();

    const { error } = await client.from("payment_oauth_states").insert({
      state,
      coach_id: user.id,
      expires_at: new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString()
    });

    if (error) throw error;

    return json({
      authorization_url: authorizationUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state
      }),
      mode: config.mode
    });
  } catch (error: unknown) {
    return logAndFail("connect", error, "Não foi possível iniciar a conexão com o Mercado Pago.");
  }
}

export default { fetch: handler };
