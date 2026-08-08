import { describeMembershipStatus, validateDisplayName } from "@/data/team-discovery";

describe("status de vínculo com grupo", () => {
  it("não mostra texto quando não há vínculo nem solicitação", () => {
    expect(describeMembershipStatus("none")).toBeNull();
  });

  it("mostra texto de solicitação pendente", () => {
    expect(describeMembershipStatus("pending")).toBe("Solicitação pendente");
  });

  it("mostra texto de vínculo ativo", () => {
    expect(describeMembershipStatus("member")).toBe("Vinculado");
  });
});

describe("validação do nome de exibição", () => {
  it("rejeita nome vazio", () => {
    expect(() => validateDisplayName("   ")).toThrow("Informe um nome com pelo menos 2 caracteres.");
  });

  it("rejeita nome com um único caractere", () => {
    expect(() => validateDisplayName("A")).toThrow("Informe um nome com pelo menos 2 caracteres.");
  });

  it("remove espaços nas pontas de um nome válido", () => {
    expect(validateDisplayName("  Maria Lima  ")).toBe("Maria Lima");
  });
});
