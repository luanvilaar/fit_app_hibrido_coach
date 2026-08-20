/**
 * Traduz falhas do Supabase em mensagens úteis para quem está usando o app.
 * As exceções levantadas pelas RPCs já são legíveis em português e passam intactas.
 */
export function describeBackendError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (!message) return "Não foi possível concluir a operação. Tente novamente.";
  if (/permission denied/i.test(message)) return "Você não tem permissão para esta operação.";
  if (/jwt|not authenticated/i.test(message)) return "Sua sessão expirou. Entre novamente para continuar.";
  if (/row-level security/i.test(message)) {
    return "A operação foi bloqueada pelas permissões do servidor. Confirme se as migrations pendentes foram aplicadas.";
  }
  if (/could not find the function.*schema cache/i.test(message)) {
    return "O servidor ainda não reconheceu a atualização. Aguarde alguns segundos e tente novamente.";
  }
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
