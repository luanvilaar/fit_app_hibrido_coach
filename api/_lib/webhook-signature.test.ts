import { buildManifest, isValidSignature, parseSignatureHeader } from "./webhook-signature";

const secret = "webhook-secret";

/** Reproduz o que o provedor assina, para o teste não depender de um hash colado à mão. */
async function sign(message: string): Promise<string> {
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

describe("cabeçalho de assinatura", () => {
  it("extrai ts e v1", () => {
    expect(parseSignatureHeader(`ts=1700000000,v1=${"a".repeat(64)}`)).toEqual({
      ts: "1700000000",
      v1: "a".repeat(64)
    });
  });

  it("tolera espaço e ordem trocada", () => {
    const v1 = "b".repeat(64);

    expect(parseSignatureHeader(` v1=${v1} , ts=123 `)).toEqual({ ts: "123", v1 });
  });

  it("recusa cabeçalho ausente ou incompleto", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader("ts=123")).toBeNull();
    expect(parseSignatureHeader("lixo")).toBeNull();
    expect(parseSignatureHeader("ts=abc,v1=abc123")).toBeNull();
  });
});

describe("manifesto", () => {
  it("segue a ordem e a pontuação que o provedor assina", () => {
    expect(buildManifest("999", "req-1", "1700000000")).toBe(
      "id:999;request-id:req-1;ts:1700000000;"
    );
  });

  it("omite o request-id quando não veio", () => {
    expect(buildManifest("999", null, "1700000000")).toBe("id:999;ts:1700000000;");
  });
});

describe("validação da assinatura", () => {
  const base = { requestId: "req-1", dataId: "999", secret };

  it("aceita a assinatura legítima", async () => {
    const v1 = await sign("id:999;request-id:req-1;ts:1700000000;");

    await expect(
      isValidSignature({ ...base, signatureHeader: `ts=1700000000,v1=${v1}` })
    ).resolves.toBe(true);
  });

  it("aceita assinatura em maiúsculas", async () => {
    const v1 = await sign("id:999;request-id:req-1;ts:1700000000;");

    await expect(
      isValidSignature({ ...base, signatureHeader: `ts=1700000000,v1=${v1.toUpperCase()}` })
    ).resolves.toBe(true);
  });

  it("recusa quando o id do pagamento foi trocado", async () => {
    // O ataque óbvio: pegar uma notificação legítima e apontá-la para outra cobrança.
    const v1 = await sign("id:999;request-id:req-1;ts:1700000000;");

    await expect(
      isValidSignature({ ...base, dataId: "1000", signatureHeader: `ts=1700000000,v1=${v1}` })
    ).resolves.toBe(false);
  });

  it("recusa quando o timestamp foi trocado", async () => {
    const v1 = await sign("id:999;request-id:req-1;ts:1700000000;");

    await expect(
      isValidSignature({ ...base, signatureHeader: `ts=1700000001,v1=${v1}` })
    ).resolves.toBe(false);
  });

  it("recusa com o segredo errado", async () => {
    const v1 = await sign("id:999;request-id:req-1;ts:1700000000;");

    await expect(
      isValidSignature({ ...base, secret: "outro", signatureHeader: `ts=1700000000,v1=${v1}` })
    ).resolves.toBe(false);
  });

  it("recusa sem cabeçalho", async () => {
    await expect(isValidSignature({ ...base, signatureHeader: null })).resolves.toBe(false);
  });
});
