import { describeBackendError } from "@/data/backend-error";

describe("describeBackendError", () => {
  it("traduz violação de chave estrangeira em mensagem amigável", () => {
    const error = new Error(
      'update or delete on table "session_templates" violates foreign key constraint "session_instances_template_id_fkey" on table "session_instances"'
    );
    expect(describeBackendError(error)).toBe("Não é possível excluir: este item está sendo usado em outro lugar.");
  });

  it("mantém mensagens conhecidas: permissão, sessão expirada, recurso ausente e rede", () => {
    expect(describeBackendError(new Error("permission denied for table teams"))).toBe(
      "Você não tem permissão para esta operação."
    );
    expect(describeBackendError(new Error("JWT expired"))).toBe(
      "Sua sessão expirou. Entre novamente para continuar."
    );
    expect(describeBackendError(new Error('function "list_team_members" does not exist'))).toBe(
      "Recurso indisponível no servidor. Confirme se as migrations pendentes foram aplicadas."
    );
    expect(describeBackendError(new Error("fetch failed"))).toBe("Sem conexão com o servidor. Tente novamente.");
  });

  it("repassa mensagens legíveis que não casam com nenhum padrão conhecido", () => {
    expect(describeBackendError(new Error("A equipe precisa ter ao menos um coach."))).toBe(
      "A equipe precisa ter ao menos um coach."
    );
  });

  it("usa mensagem padrão quando o erro não tem texto", () => {
    expect(describeBackendError("algo não tipado")).toBe("Não foi possível concluir a operação. Tente novamente.");
  });
});
