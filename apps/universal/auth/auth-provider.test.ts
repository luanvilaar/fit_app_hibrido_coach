import { getAuthErrorMessage } from "./auth-provider";

describe("mensagens de autenticação", () => {
  it("não revela se o e-mail já possui conta", () => {
    expect(getAuthErrorMessage({ code: "email_exists" })).toBe(
      "Não foi possível concluir a operação. Tente novamente mais tarde."
    );
    expect(getAuthErrorMessage({ code: "user_already_exists" })).toBe(
      "Não foi possível concluir a operação. Tente novamente mais tarde."
    );
  });

  it("não revela se o usuário existe no fluxo de recuperação", () => {
    expect(getAuthErrorMessage({ code: "user_not_found" })).toBe(
      "Não foi possível concluir a operação. Tente novamente mais tarde."
    );
    expect(getAuthErrorMessage({ code: "email_not_confirmed" })).toBe(
      "Não foi possível concluir a operação. Tente novamente mais tarde."
    );
  });
});
