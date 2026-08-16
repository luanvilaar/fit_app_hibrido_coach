import { serviceRoleClient } from "../_lib/auth.js";
import { ConnectionMissingError, getValidAccessToken } from "../_lib/connection.js";
import { mercadoPagoWebhookSecret } from "../_lib/env.js";
import { failure, json, logAndFail, methodNotAllowed } from "../_lib/http.js";
import { isValidSignature } from "../_lib/webhook-signature.js";

const PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type PaymentIntent = {
  id: string;
  charge_id: string;
  athlete_id: string;
  coach_id: string;
  provider_payment_id: string;
  amount_cents: number;
};

type StorePaymentIntent = {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_coach_id: string;
  provider_payment_id: string;
  amount_cents: number;
};

type MercadoPagoPayment = {
  id?: number | string;
  status?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  external_reference?: string;
  date_approved?: string | null;
};

type MercadoPagoNotification = {
  type?: string;
  data?: { id?: number | string };
};

export type PaymentIntentStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

export function mapPaymentStatus(status: string | undefined): PaymentIntentStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "pending":
    case "in_process":
    default:
      // Estados transitórios e estados desconhecidos não podem quitar a cobrança.
      return "pending";
  }
}

function notificationDataId(payload: MercadoPagoNotification): string | null {
  const value = payload.data?.id;

  if (typeof value !== "string" && typeof value !== "number") return null;

  const dataId = String(value).trim();
  return dataId.length > 0 ? dataId : null;
}

function dateOnly(value: string | null | undefined): string {
  if (!value) {
    throw new Error("O pagamento aprovado não trouxe a data de aprovação.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("O Mercado Pago devolveu uma data de aprovação inválida.");
  }

  return date.toISOString().slice(0, 10);
}

async function fetchPayment(accessToken: string, paymentId: string): Promise<MercadoPagoPayment> {
  const response = await fetch(`${PAYMENTS_URL}/${encodeURIComponent(paymentId)}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    }
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok || typeof payload !== "object" || payload === null) {
    throw new Error(`Leitura do pagamento no Mercado Pago falhou (HTTP ${response.status}).`);
  }

  return payload as MercadoPagoPayment;
}

async function settleChargePayment(
  client: ReturnType<typeof serviceRoleClient>,
  intent: PaymentIntent,
  payment: MercadoPagoPayment
) {
  const status = mapPaymentStatus(payment.status);

  if (String(payment.id ?? "") !== intent.provider_payment_id) {
    throw new Error("O identificador confirmado não corresponde à intenção de cobrança.");
  }

  if (payment.external_reference !== intent.charge_id) {
    throw new Error("A referência externa não corresponde à cobrança.");
  }

  if (status !== "approved") {
    const { error: updateError } = await client
      .from("charge_payment_intents")
      .update({ status })
      .eq("id", intent.id);

    if (updateError) throw updateError;
    return;
  }

  if (
    typeof payment.transaction_amount !== "number"
    || !Number.isFinite(payment.transaction_amount)
    || payment.transaction_amount <= 0
  ) {
    throw new Error("O pagamento aprovado não trouxe um valor válido.");
  }

  const amountCents = Math.round(payment.transaction_amount * 100);
  if (amountCents !== intent.amount_cents) {
    throw new Error("O valor confirmado não corresponde à intenção de cobrança.");
  }

  const { error: paymentError } = await client.from("charge_payments").insert({
    charge_id: intent.charge_id,
    amount_cents: amountCents,
    source: "mercado_pago",
    payment_method: payment.payment_method_id === "pix" ? "pix" : "credit_card",
    paid_at: dateOnly(payment.date_approved),
    provider_payment_id: String(payment.id ?? intent.provider_payment_id),
    created_by: null
  });

  // O índice único é a idempotência do webhook: a reentrega do mesmo pagamento é sucesso.
  if (paymentError && paymentError.code !== "23505") throw paymentError;

  const { error: updateError } = await client
    .from("charge_payment_intents")
    .update({ status: "approved" })
    .eq("id", intent.id);

  if (updateError) throw updateError;
}

async function settleStorePayment(
  client: ReturnType<typeof serviceRoleClient>,
  intent: StorePaymentIntent,
  payment: MercadoPagoPayment
) {
  const status = mapPaymentStatus(payment.status);

  if (String(payment.id ?? "") !== intent.provider_payment_id) {
    throw new Error("O identificador confirmado não corresponde à intenção da compra.");
  }

  if (payment.external_reference !== intent.order_id) {
    throw new Error("A referência externa não corresponde ao pedido.");
  }

  if (status !== "approved") {
    const { error: updateError } = await client
      .from("store_payment_intents")
      .update({ status })
      .eq("id", intent.id);

    if (updateError) throw updateError;
    return;
  }

  if (
    typeof payment.transaction_amount !== "number"
    || !Number.isFinite(payment.transaction_amount)
    || payment.transaction_amount <= 0
  ) {
    throw new Error("A compra aprovada não trouxe um valor válido.");
  }

  const amountCents = Math.round(payment.transaction_amount * 100);
  if (amountCents !== intent.amount_cents) {
    throw new Error("O valor confirmado não corresponde ao pedido.");
  }

  const { error: settleError } = await client.rpc("settle_store_order", {
    p_provider_payment_id: intent.provider_payment_id,
    p_amount_cents: amountCents,
    p_paid_at: payment.date_approved ?? null
  });

  if (settleError) throw settleError;
}

/**
 * Recebe apenas o aviso de mudança; o estado verdadeiro é relido no Mercado Pago depois da
 * assinatura. Assim, um corpo forjado ou antigo nunca consegue dar baixa numa cobrança.
 */
async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const rawBody = await request.text().catch(() => "");
  let notification: MercadoPagoNotification;

  try {
    const parsed: unknown = JSON.parse(rawBody);

    if (typeof parsed !== "object" || parsed === null) throw new Error("corpo inválido");

    notification = parsed as MercadoPagoNotification;
  } catch {
    return failure("Assinatura inválida.", 401);
  }

  const dataId = notificationDataId(notification);

  if (!dataId) return failure("Assinatura inválida.", 401);

  try {
    const valid = await isValidSignature({
      signatureHeader: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId,
      secret: mercadoPagoWebhookSecret()
    });

    if (!valid) return failure("Assinatura inválida.", 401);
  } catch (error: unknown) {
    return logAndFail("webhook-signature", error, "Não foi possível validar o webhook.");
  }

  // A aplicação só processa pagamentos. Outros eventos assinados recebem 200 para o provedor
  // não insistir numa notificação que está fora do escopo desta integração.
  if (notification.type !== "payment") return json({ received: true });

  try {
    const client = serviceRoleClient();
    const { data: intent, error: intentError } = await client
      .from("charge_payment_intents")
      .select("id, charge_id, athlete_id, coach_id, provider_payment_id, amount_cents")
      .eq("provider", "mercado_pago")
      .eq("provider_payment_id", dataId)
      .maybeSingle<PaymentIntent>();

    if (intentError) throw intentError;

    let storeIntent: StorePaymentIntent | null = null;

    if (!intent) {
      const { data: nextStoreIntent, error: storeIntentError } = await client
        .from("store_payment_intents")
        .select("id, order_id, buyer_id, seller_coach_id, provider_payment_id, amount_cents")
        .eq("provider", "mercado_pago")
        .eq("provider_payment_id", dataId)
        .maybeSingle<StorePaymentIntent>();

      if (storeIntentError) throw storeIntentError;
      storeIntent = nextStoreIntent;
    }

    // O evento pode pertencer a outra aplicação que usa as mesmas credenciais. 200 evita retry
    // infinito sem revelar nada sobre as cobranças locais.
    if (!intent && !storeIntent) return json({ received: true });

    const coachId = intent?.coach_id ?? storeIntent?.seller_coach_id;
    if (!coachId) return json({ received: true });

    let connection: Awaited<ReturnType<typeof getValidAccessToken>>;

    try {
      connection = await getValidAccessToken(client, coachId);
    } catch (error: unknown) {
      if (error instanceof ConnectionMissingError) {
        console.error("[pagamentos] webhook: conexão do coach ausente", coachId);
        throw error;
      }

      throw error;
    }

    const payment = await fetchPayment(connection.accessToken, dataId);
    if (intent) await settleChargePayment(client, intent, payment);
    if (storeIntent) await settleStorePayment(client, storeIntent, payment);
  } catch (error: unknown) {
    // Falhas internas precisam de resposta não-2xx para o provedor repetir a notificação.
    console.error("[pagamentos] webhook:", error);
    return failure("Webhook não processado.", 500);
  }

  return json({ received: true });
}

export default { fetch: handler };
