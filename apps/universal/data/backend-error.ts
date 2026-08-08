/**
 * Traduz falhas do Supabase em mensagens úteis para quem está usando o app.
 * As exceções levantadas pelas RPCs já são legíveis em português e passam intactas.
 */
export function describeBackendError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (!message) return "Não foi possível concluir a operação. Tente novamente.";
  if (/permission denied/i.test(message)) return "Você não tem permissão para esta operação.";
  if (/jwt|not authenticated/i.test(message)) return "Sua sessão expirou. Entre novamente para continuar.";
  if (/does not exist/i.test(message)) {
    return "Recurso indisponível no servidor. Confirme se as migrations pendentes foram aplicadas.";
  }
  if (/foreign key constraint/i.test(message)) {
    return "Não é possível excluir: este item está sendo usado em outro lugar.";
  }
  if (/fetch failed|network/i.test(message)) return "Sem conexão com o servidor. Tente novamente.";
  if (/violates check constraint/i.test(message)) {
    return "Algum valor enviado está fora da faixa permitida. Revise as respostas.";
  }

  return message;
}
