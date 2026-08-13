/**
 * Cifra dos tokens do provedor antes de encostarem no banco.
 *
 * O `access_token` do Mercado Pago vale 180 dias e movimenta dinheiro na conta do coach. Guardá-lo
 * em texto claro significa que qualquer cópia do banco — backup, dump de suporte, acesso indevido
 * ao painel — é uma credencial pronta para uso. Cifrado, o vazamento da tabela sozinho não basta:
 * a chave vive apenas nas variáveis de ambiente do servidor.
 *
 * AES-256-GCM pela Web Crypto, que existe tanto no runtime do Vercel quanto no Node moderno — sem
 * dependência nova e sem `node:crypto`, que amarraria o código a um runtime só.
 */

const ALGORITHM = "AES-GCM";
/** 96 bits é o tamanho de nonce recomendado para GCM. */
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * O buffer é declarado explicitamente como `ArrayBuffer`: `new Uint8Array(n)` sozinho é inferido
 * sobre `ArrayBufferLike`, que inclui `SharedArrayBuffer` e não satisfaz `BufferSource` da Web
 * Crypto.
 */
function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function importKey(keyMaterial: string): Promise<CryptoKey> {
  const raw = decodeBase64(keyMaterial);

  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `PAYMENT_TOKEN_ENCRYPTION_KEY precisa ter ${KEY_BYTES} bytes em base64 (gere com "openssl rand -base64 32").`
    );
  }

  return crypto.subtle.importKey("raw", raw, ALGORITHM, false, ["encrypt", "decrypt"]);
}

/**
 * Devolve `base64(iv || ciphertext+tag)`. O IV é aleatório por chamada e viaja junto: em GCM ele
 * não é segredo, mas repeti-lo com a mesma chave quebra a cifra inteira.
 */
export async function encryptSecret(plaintext: string, keyMaterial: string): Promise<string> {
  const key = await importKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), iv.length);

  return encodeBase64(packed);
}

export async function decryptSecret(packedBase64: string, keyMaterial: string): Promise<string> {
  const key = await importKey(keyMaterial);
  const packed = decodeBase64(packedBase64);

  if (packed.length <= IV_BYTES) {
    throw new Error("Token cifrado inválido.");
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: packed.slice(0, IV_BYTES) },
    key,
    packed.slice(IV_BYTES)
  );

  return new TextDecoder().decode(plaintext);
}

/** `state` do OAuth: aleatório o bastante para não ser adivinhado, e seguro em URL. */
export function randomToken(bytes = 32): string {
  return encodeBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
