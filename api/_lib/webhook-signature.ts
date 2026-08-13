/**
 * Validação da assinatura das notificações do Mercado Pago.
 *
 * O webhook é um endpoint público: sem esta checagem, qualquer um que descubra a URL consegue
 * afirmar "o pagamento X foi aprovado" e dar baixa numa cobrança sem ter pago nada. É a única
 * coisa que separa uma notificação legítima de um POST forjado.
 *
 * O provedor manda `x-signature: ts=<ts>,v1=<hmac>` e `x-request-id`. O manifesto assinado é
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, com HMAC-SHA256 do segredo do webhook.
 */

export type SignatureParts = { ts: string; v1: string } | null;

export function parseSignatureHeader(header: string | null): SignatureParts {
  if (!header) return null;

  let ts: string | null = null;
  let v1: string | null = null;

  for (const piece of header.split(",")) {
    const separator = piece.indexOf("=");

    if (separator === -1) continue;

    const key = piece.slice(0, separator).trim();
    const value = piece.slice(separator + 1).trim();

    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }

  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[a-f\d]{64}$/i.test(v1)) return null;

  return { ts, v1 };
}

/** Campos ausentes saem do manifesto — é assim que o provedor o monta. */
export function buildManifest(dataId: string, requestId: string | null, ts: string): string {
  let manifest = `id:${dataId};`;

  if (requestId) manifest += `request-id:${requestId};`;

  manifest += `ts:${ts};`;

  return manifest;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Comparação em tempo constante. `a === b` em string sai no primeiro byte diferente, e essa
 * diferença de tempo é suficiente para adivinhar a assinatura byte a byte.
 */
function timingSafeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;

  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ (b.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export async function isValidSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string;
  secret: string;
}): Promise<boolean> {
  const parts = parseSignatureHeader(input.signatureHeader);

  if (!parts) return false;

  const expected = await hmacHex(
    input.secret,
    buildManifest(input.dataId, input.requestId, parts.ts)
  );

  return timingSafeEqual(expected, parts.v1.toLowerCase());
}
