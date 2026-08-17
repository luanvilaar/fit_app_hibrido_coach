jest.mock("./env", () => ({
  publicAppUrl: () => "https://fitblock.test"
}));

import { renderPasswordResetEmail, renderWelcomeEmail } from "./email-templates";

describe("renderWelcomeEmail", () => {
  it("deriva o primeiro nome do e-mail e usa o link de ação recebido", () => {
    const { subject, html } = renderWelcomeEmail({
      email: "ana.silva@fitblock.test",
      actionUrl: "https://fitblock.test/auth/v1/verify?token=abc&type=signup"
    });

    expect(subject).toBe("Ana, seu processo começa agora");
    expect(html).toContain("Ana, seu processo");
    expect(html).toContain("https://fitblock.test/auth/v1/verify?token=abc&amp;type=signup");
  });

  it("aponta as imagens para o domínio público configurado", () => {
    const { html } = renderWelcomeEmail({ email: "ana@fitblock.test", actionUrl: "https://fitblock.test/x" });

    expect(html).toContain("https://fitblock.test/email/wordmark-white.png");
    expect(html).toContain("https://fitblock.test/email/hero-welcome.jpg");
  });

  it("mantém a composição Dark Performance e diferencia confirmação de boas-vindas", () => {
    const confirmation = renderWelcomeEmail({ email: "ana@fitblock.test", actionUrl: "https://fitblock.test/x" });
    const welcome = renderWelcomeEmail({
      email: "ana@fitblock.test",
      actionUrl: "https://fitblock.test/x",
      purpose: "welcome"
    });

    expect(confirmation.html).toContain("Confirmar acesso");
    expect(welcome.html).toContain("Abrir meu treino");
    expect(confirmation.html).toContain("#050507");
    expect(confirmation.html).toContain("#16161D");
    expect(confirmation.html).toContain("#7132F5");
    expect(confirmation.html).toContain("Barlow Condensed");
    expect(confirmation.html).toContain("Inter");
  });

  it("escapa HTML no e-mail para não injetar marcação a partir de dado do usuário", () => {
    const { html } = renderWelcomeEmail({
      email: '"><script>alert(1)</script>@fitblock.test',
      actionUrl: "https://fitblock.test/x"
    });

    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("renderPasswordResetEmail", () => {
  it("inclui o e-mail do destinatário, o link e o prazo de expiração", () => {
    const { subject, html } = renderPasswordResetEmail({
      email: "ana@fitblock.test",
      resetUrl: "https://fitblock.test/auth/v1/verify?token=xyz&type=recovery",
      expiresIn: "1 hora"
    });

    expect(subject).toBe("Redefinir sua senha FitBlock");
    expect(html).toContain("ana@fitblock.test");
    expect(html).toContain("https://fitblock.test/auth/v1/verify?token=xyz&amp;type=recovery");
    expect(html).toContain("Este link expira em 1 hora");
    expect(html).toContain("Defina uma nova senha.");
    expect(html).toContain("#292934");
  });

  it("escapa HTML no e-mail e no prazo para não injetar marcação a partir de dado do usuário", () => {
    const { html } = renderPasswordResetEmail({
      email: '<img src=x onerror=alert(1)>@fitblock.test',
      resetUrl: "https://fitblock.test/x",
      expiresIn: "1 hora"
    });

    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
