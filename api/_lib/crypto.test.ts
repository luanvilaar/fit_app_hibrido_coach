import { decryptSecret, encryptSecret, randomToken } from "./crypto";

/** 32 bytes em base64, como a variável de ambiente exige. */
const key = Buffer.alloc(32, 7).toString("base64");
const otherKey = Buffer.alloc(32, 9).toString("base64");

describe("cifra dos tokens do provedor", () => {
  it("devolve o mesmo texto depois de cifrar e decifrar", async () => {
    const token = "APP_USR-1234567890abcdef";

    expect(await decryptSecret(await encryptSecret(token, key), key)).toBe(token);
  });

  it("preserva acento e caractere não-ASCII", async () => {
    const value = "conexão-do-treinador-ção-🔐";

    expect(await decryptSecret(await encryptSecret(value, key), key)).toBe(value);
  });

  it("nunca produz o mesmo texto cifrado duas vezes", async () => {
    // IV aleatório por chamada: repetir o par (chave, IV) em GCM quebra a cifra inteira.
    const first = await encryptSecret("token", key);
    const second = await encryptSecret("token", key);

    expect(first).not.toBe(second);
    expect(await decryptSecret(first, key)).toBe("token");
    expect(await decryptSecret(second, key)).toBe("token");
  });

  it("não entrega o segredo com a chave errada", async () => {
    const packed = await encryptSecret("token", key);

    await expect(decryptSecret(packed, otherKey)).rejects.toThrow();
  });

  it("recusa texto cifrado adulterado", async () => {
    // É o que a autenticação do GCM existe para pegar: byte trocado invalida a tag.
    const packed = await encryptSecret("token", key);
    const bytes = Buffer.from(packed, "base64");
    bytes[bytes.length - 1] ^= 0xff;

    await expect(decryptSecret(bytes.toString("base64"), key)).rejects.toThrow();
  });

  it("recusa carga curta demais para conter IV e conteúdo", async () => {
    await expect(decryptSecret(Buffer.alloc(8).toString("base64"), key)).rejects.toThrow(
      /inválido/i
    );
  });

  it("exige chave de 32 bytes e diz como gerar", async () => {
    await expect(encryptSecret("token", Buffer.alloc(16).toString("base64"))).rejects.toThrow(
      /openssl rand -base64 32/
    );
  });
});

describe("state do OAuth", () => {
  it("não repete entre chamadas", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));

    expect(tokens.size).toBe(50);
  });

  it("é seguro para viajar em query string", () => {
    // `+`, `/` e `=` do base64 padrão quebram ou mudam de sentido dentro de uma URL.
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
