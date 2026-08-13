/** Respostas padronizadas das funções de pagamento. */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

/**
 * A mensagem que chega ao usuário é sempre em português e sem detalhe interno: erro de pagamento
 * é justamente onde um stack trace vira mapa para quem está sondando.
 */
export function failure(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

export function methodNotAllowed(allowed: string): Response {
  return new Response(JSON.stringify({ error: "Método não permitido." }), {
    status: 405,
    headers: { "content-type": "application/json; charset=utf-8", allow: allowed }
  });
}

/**
 * Registra a causa real no log do servidor e devolve ao cliente só o que ele pode saber. Sem isto
 * a escolha vira "esconder o erro de todo mundo" ou "vazar o interno para o cliente".
 */
export function logAndFail(context: string, error: unknown, message: string, status = 500): Response {
  console.error(`[pagamentos] ${context}:`, error);
  return failure(message, status);
}
