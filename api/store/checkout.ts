import { authenticate, serviceRoleClient } from "../_lib/auth.js";
import { ConnectionMissingError, getValidAccessToken } from "../_lib/connection.js";
import { appOrigin } from "../_lib/env.js";
import { failure, json, logAndFail, methodNotAllowed } from "../_lib/http.js";

const PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type ProductRow = {
  id: string;
  seller_coach_id: string;
  title: string;
  price_cents: number;
  status: "draft" | "review" | "published" | "archived";
};

type PendingOrderRow = {
  id: string;
  seller_coach_id: string;
  total_amount_cents: number;
  status: "pending";
  store_order_items: Array<{ product_id: string }>;
};

type PaymentPayload = {
  id?: number | string;
  status?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
};

/**
 * Inicia o checkout PIX de um produto publicado.
 *
 * O produto e o vendedor são relidos no servidor. O cliente só escolhe o produto; não escolhe
 * preço, coach recebedor ou conteúdo liberado.
 */
async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    const user = await authenticate(request);

    if (!user) return failure("Sua sessão expirou. Entre novamente.", 401);
    if (!user.email) return failure("Sua conta precisa ter um e-mail para comprar.", 400);

    const body: unknown = await request.json().catch(() => null);
    const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const productId = typeof input.product_id === "string" ? input.product_id.trim() : null;
    const method = typeof input.method === "string" ? input.method : null;

    if (!productId || method !== "pix") {
      return failure('Informe um produto e o método de pagamento "pix".');
    }

    const client = serviceRoleClient();
    const { data: product, error: productError } = await client
      .from("store_products")
      .select("id, seller_coach_id, title, price_cents, status")
      .eq("id", productId)
      .maybeSingle<ProductRow>();

    if (productError) throw productError;

    if (!product || product.status !== "published") {
      return failure("Produto não encontrado ou indisponível.", 404);
    }

    const { data: existingOrder, error: existingOrderError } = await client
      .from("store_orders")
      .select("id, seller_coach_id, total_amount_cents, status, store_order_items!inner(product_id)")
      .eq("buyer_id", user.id)
      .eq("status", "pending")
      .eq("store_order_items.product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PendingOrderRow>();

    if (existingOrderError) throw existingOrderError;

    if (existingOrder) {
      const { data: existingIntent, error: existingIntentError } = await client
        .from("store_payment_intents")
        .select("provider_payment_id, status, amount_cents, qr_code, qr_code_base64, expires_at")
        .eq("order_id", existingOrder.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingIntentError) throw existingIntentError;

      if (existingIntent) {
        return json({
          order_id: existingOrder.id,
          payment_id: existingIntent.provider_payment_id,
          status: existingIntent.status,
          amount_cents: existingIntent.amount_cents,
          qr_code: existingIntent.qr_code ?? null,
          qr_code_base64: existingIntent.qr_code_base64 ?? null,
          expires_at: existingIntent.expires_at ?? null
        });
      }
    }

    let connection: Awaited<ReturnType<typeof getValidAccessToken>>;

    try {
      connection = await getValidAccessToken(client, product.seller_coach_id);
    } catch (error: unknown) {
      if (error instanceof ConnectionMissingError) {
        return failure(
          "Este coach ainda não conectou uma conta para receber pagamentos pelo app.",
          409
        );
      }
      throw error;
    }

    const order = existingOrder
      ? existingOrder
      : await createOrder(client, {
          buyerId: user.id,
          productId: product.id,
          sellerCoachId: product.seller_coach_id,
          amountCents: product.price_cents
        });

    const { count: previousAttempts, error: attemptsError } = await client
      .from("store_payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id)
      .eq("amount_cents", product.price_cents);

    if (attemptsError) throw attemptsError;

    const attempt = (previousAttempts ?? 0) + 1;
    const response = await fetch(PAYMENTS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.accessToken}`,
        "content-type": "application/json",
        "x-idempotency-key": `store:${order.id}:${product.price_cents}:${attempt}`
      },
      body: JSON.stringify({
        transaction_amount: Number((product.price_cents / 100).toFixed(2)),
        description: product.title,
        payment_method_id: "pix",
        payer: { email: user.email },
        external_reference: order.id,
        notification_url: `${appOrigin()}/api/webhooks/mercadopago`
      })
    });

    const payment: PaymentPayload = (await response.json().catch(() => null)) as PaymentPayload;

    if (!response.ok) {
      await client.from("store_orders").update({ status: "cancelled" }).eq("id", order.id);
      console.error("[marketplace] checkout:", payment);
      return failure("O Mercado Pago recusou a criação do pagamento. Tente de novo.", 502);
    }

    if (!payment.id) return failure("Resposta inesperada do Mercado Pago.", 502);

    const transaction = payment.point_of_interaction?.transaction_data;
    const { error: intentError } = await client.from("store_payment_intents").insert({
      order_id: order.id,
      buyer_id: user.id,
      seller_coach_id: product.seller_coach_id,
      provider_payment_id: String(payment.id),
      amount_cents: product.price_cents,
      method: "pix",
      status: "pending",
      qr_code: transaction?.qr_code ?? null,
      qr_code_base64: transaction?.qr_code_base64 ?? null,
      expires_at: payment.date_of_expiration ?? null
    });

    if (intentError && intentError.code !== "23505") throw intentError;

    return json({
      order_id: order.id,
      payment_id: String(payment.id),
      status: payment.status ?? "pending",
      amount_cents: product.price_cents,
      qr_code: transaction?.qr_code ?? null,
      qr_code_base64: transaction?.qr_code_base64 ?? null,
      expires_at: payment.date_of_expiration ?? null
    });
  } catch (error: unknown) {
    return logAndFail("store-checkout", error, "Não foi possível iniciar a compra.");
  }
}

async function createOrder(
  client: ReturnType<typeof serviceRoleClient>,
  input: { buyerId: string; productId: string; sellerCoachId: string; amountCents: number }
) {
  const { data: order, error: orderError } = await client
    .from("store_orders")
    .insert({
      buyer_id: input.buyerId,
      seller_coach_id: input.sellerCoachId,
      total_amount_cents: input.amountCents,
      status: "pending"
    })
    .select("id, seller_coach_id, total_amount_cents, status")
    .single();

  if (orderError) throw orderError;

  const { error: itemError } = await client.from("store_order_items").insert({
    order_id: order.id,
    product_id: input.productId,
    quantity: 1,
    unit_price_cents: input.amountCents
  });

  if (itemError) throw itemError;

  return { ...order, store_order_items: [{ product_id: input.productId }] } as PendingOrderRow;
}

export default { fetch: handler };
