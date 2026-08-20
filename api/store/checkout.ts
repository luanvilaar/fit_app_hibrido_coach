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
  // Produto excluído pelo coach continua existindo só para honrar o histórico de quem já comprou.
  deleted_at: string | null;
};

type PendingOrderRow = {
  id: string;
  seller_coach_id: string;
  total_amount_cents: number;
  status: "pending";
  program_start_date: string;
  program_version_id: string | null;
  store_order_items: Array<{ product_id: string }>;
};

type ProgramVersionRow = {
  id: string;
};

type PaymentPayload = {
  id?: number | string;
  status?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
};

function parseProgramStartDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value.trim()
    : null;
}

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
    const programStartDate = parseProgramStartDate(input.start_date);

    if (!productId || method !== "pix" || !programStartDate) {
      return failure('Informe um produto, a data inicial (AAAA-MM-DD) e o método de pagamento "pix".');
    }

    const client = serviceRoleClient();
    const { data: product, error: productError } = await client
      .from("store_products")
      .select("id, seller_coach_id, title, price_cents, status, deleted_at")
      .eq("id", productId)
      .maybeSingle<ProductRow>();

    if (productError) throw productError;

    if (!product || product.status !== "published" || product.deleted_at !== null) {
      return failure("Produto não encontrado ou indisponível.", 404);
    }

    const { data: existingOrder, error: existingOrderError } = await client
      .from("store_orders")
      .select("id, seller_coach_id, total_amount_cents, status, program_start_date, program_version_id, store_order_items!inner(product_id)")
      .eq("buyer_id", user.id)
      .eq("status", "pending")
      .eq("store_order_items.product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PendingOrderRow>();

    if (existingOrderError) throw existingOrderError;

    if (existingOrder) {
      if (!existingOrder.program_version_id) {
        return failure("Este PIX pendente não possui uma versão segura do programa. Aguarde a expiração e inicie uma nova compra.", 409);
      }
      if (existingOrder.program_start_date !== programStartDate) {
        return failure("Já existe um PIX pendente para este programa com outra data inicial. Conclua ou aguarde a expiração dele antes de escolher uma nova data.", 409);
      }
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

    // A versão é congelada antes da criação do PIX. O webhook nunca recebe nem
    // recalcula este identificador a partir do catálogo que pode ter sido editado.
    const { data: currentVersion, error: currentVersionError } = existingOrder
      ? { data: null, error: null }
      : await client
          .from("store_program_versions")
          .select("id")
          .eq("product_id", product.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle<ProgramVersionRow>();

    if (currentVersionError) throw currentVersionError;
    if (!existingOrder && !currentVersion) {
      return failure("Este programa ainda não possui uma versão publicada para compra.", 409);
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
          amountCents: product.price_cents,
          programStartDate,
          programVersionId: currentVersion!.id
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
  input: {
    buyerId: string;
    productId: string;
    sellerCoachId: string;
    amountCents: number;
    programStartDate: string;
    programVersionId: string;
  }
) {
  const { data: order, error: orderError } = await client
    .from("store_orders")
    .insert({
      buyer_id: input.buyerId,
      seller_coach_id: input.sellerCoachId,
      total_amount_cents: input.amountCents,
      program_start_date: input.programStartDate,
      program_version_id: input.programVersionId,
      status: "pending"
    })
    .select("id, seller_coach_id, total_amount_cents, status, program_start_date, program_version_id")
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
