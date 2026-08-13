import { authenticate, serviceRoleClient } from "../_lib/auth";
import { ConnectionMissingError, getValidAccessToken } from "../_lib/connection";
import { appOrigin } from "../_lib/env";
import { failure, json, logAndFail, methodNotAllowed } from "../_lib/http";

const PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type ChargeRow = {
  id: string;
  coach_id: string;
  athlete_id: string;
  description: string;
  cancelled_at: string | null;
};

/**
 * Cria o pagamento PIX de uma cobrança, na conta do treinador dono dela.
 *
 * O valor é sempre relido do saldo no banco, nunca aceito do corpo da requisição: um
 * `amount` vindo do cliente seria o próprio aluno dizendo quanto deve.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    const user = await authenticate(request);

    if (!user) return failure("Sua sessão expirou. Entre novamente.", 401);

    const body: unknown = await request.json().catch(() => null);
    const input =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const chargeId =
      typeof input.charge_id === "string"
        ? input.charge_id.trim()
        : null;
    const method =
      typeof input.method === "string"
        ? input.method
        : null;

    if (!chargeId || method !== "pix") {
      return failure('Informe uma cobrança e o método de pagamento "pix".');
    }

    const client = serviceRoleClient();

    const { data: charge, error: chargeError } = await client
      .from("charges")
      .select("id, coach_id, athlete_id, description, cancelled_at")
      .eq("id", chargeId)
      .maybeSingle<ChargeRow>();

    if (chargeError) throw chargeError;

    // Mesma resposta para "não existe" e "não é sua": distinguir as duas confirmaria a
    // existência de cobranças de outras pessoas para quem ficar sondando ids.
    if (!charge || charge.athlete_id !== user.id) {
      return failure("Cobrança não encontrada.", 404);
    }

    if (charge.cancelled_at) return failure("Esta cobrança foi cancelada.", 409);

    const { data: balance, error: balanceError } = await client
      .from("charge_balances")
      .select("outstanding_amount_cents")
      .eq("charge_id", chargeId)
      .maybeSingle<{ outstanding_amount_cents: number }>();

    if (balanceError) throw balanceError;

    const outstanding = balance?.outstanding_amount_cents ?? 0;

    if (outstanding <= 0) return failure("Esta cobrança já está quitada.", 409);

    if (!user.email) {
      return failure("Sua conta precisa ter um e-mail para gerar o PIX.", 400);
    }

    // O número da tentativa faz parte da chave: uma nova tentativa pode gerar outro PIX,
    // enquanto um retry da mesma chamada mantém a chave anterior até a intenção ser gravada.
    const { count: previousAttempts, error: attemptsError } = await client
      .from("charge_payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("charge_id", chargeId)
      .eq("amount_cents", outstanding);

    if (attemptsError) throw attemptsError;

    const attempt = (previousAttempts ?? 0) + 1;

    let connection: Awaited<ReturnType<typeof getValidAccessToken>>;

    try {
      connection = await getValidAccessToken(client, charge.coach_id);
    } catch (error: unknown) {
      if (error instanceof ConnectionMissingError) {
        return failure(
          "Seu treinador ainda não conectou uma conta para receber pagamentos pelo app.",
          409
        );
      }
      throw error;
    }

    const response = await fetch(PAYMENTS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.accessToken}`,
        "content-type": "application/json",
        // Estável por cobrança e saldo: dois toques no botão não viram dois PIX.
        "x-idempotency-key": `${chargeId}:${outstanding}:${attempt}`
      },
      body: JSON.stringify({
        // O provedor espera REAIS decimais, não centavos. Trocar isso cobra 100× a mais.
        transaction_amount: Number((outstanding / 100).toFixed(2)),
        description: charge.description,
        payment_method_id: "pix",
        payer: { email: user.email },
        external_reference: chargeId,
        notification_url: `${appOrigin()}/api/webhooks/mercadopago`
      })
    });

    const payment: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("[pagamentos] create:", payment);
      return failure("O Mercado Pago recusou a criação do pagamento. Tente de novo.", 502);
    }

    const parsed = payment as {
      id?: number | string;
      status?: string;
      date_of_expiration?: string;
      point_of_interaction?: {
        transaction_data?: { qr_code?: string; qr_code_base64?: string };
      };
    };

    if (!parsed.id) {
      return failure("Resposta inesperada do Mercado Pago.", 502);
    }

    const transaction = parsed.point_of_interaction?.transaction_data;

    const { error: intentError } = await client.from("charge_payment_intents").insert({
      charge_id: chargeId,
      athlete_id: charge.athlete_id,
      coach_id: charge.coach_id,
      provider_payment_id: String(parsed.id),
      amount_cents: outstanding,
      method: "pix",
      status: "pending",
      qr_code: transaction?.qr_code ?? null,
      qr_code_base64: transaction?.qr_code_base64 ?? null,
      expires_at: parsed.date_of_expiration ?? null
    });

    // O provedor e o índice único fazem a proteção contra duas chamadas concorrentes. Se uma
    // delas já gravou a mesma intenção, ambas podem responder sucesso para o app.
    if (intentError && intentError.code !== "23505") throw intentError;

    return json({
      payment_id: String(parsed.id),
      status: parsed.status ?? "pending",
      amount_cents: outstanding,
      qr_code: transaction?.qr_code ?? null,
      qr_code_base64: transaction?.qr_code_base64 ?? null,
      expires_at: parsed.date_of_expiration ?? null
    });
  } catch (error: unknown) {
    return logAndFail("create", error, "Não foi possível gerar o pagamento.");
  }
}
