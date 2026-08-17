import { publicAppUrl } from "./env.js";

/** Endereço exibido no rodapé dos e-mails transacionais. */
const SUPPORT_EMAIL = "suporte@fitblock.com.br";

/**
 * Espelho compacto dos tokens Dark Performance usados pelo app.
 * E-mails precisam de valores CSS literais para clientes como Outlook, então este tema mantém
 * os mesmos tokens sem depender do bundle React Native no runtime da função.
 */
const emailTheme = {
  background: "#050507", // fb.bgDeep
  surface: "#16161D", // fb.surface02
  border: "#292934", // fb.border
  purple: "#7132F5", // fb.purple500
  purpleAccessible: "#A27CFF", // colors.mentionLink
  text: "#F8F8FA", // fb.textPrimary
  textSecondary: "#A5A5B3", // fb.textSecondary
  textMuted: "#8E8E9D", // colors.textMutedAccessible
  textQuiet: "#747482" // fb.textMuted
} as const;

const fontStack = {
  display: "'Barlow Condensed',Arial Narrow,Arial,sans-serif",
  interface: "'Inter',Helvetica,Arial,sans-serif"
} as const;

export type RenderedEmail = { subject: string; html: string };
type WelcomeEmailPurpose = "confirmation" | "welcome";

type TransactionalEmailLayout = {
  preheader: string;
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
  hero?: { alt: string; fileName: string; height: number };
};

/** Escapa o mínimo necessário para texto entrar em HTML sem quebrar marcação ou injetar script. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "atleta.silva@fitblock.com" → "Atleta". Mesma derivação usada no shell do app. */
function deriveFirstName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const firstToken = localPart.split(/[._-]/)[0] || "atleta";
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

function emailAssetUrl(fileName: string): string {
  return `${publicAppUrl()}/email/${fileName}`;
}

function logoImgTag(): string {
  return `<img src="${emailAssetUrl("wordmark-white.png")}" width="112" height="22" alt="FITBLOCK" style="display:block;width:112px;height:22px;">`;
}

/**
 * Uma composição única para mensagens transacionais: superfície grafite, informação alinhada à
 * esquerda, uma única ação roxa e regras finas — o mesmo vocabulário do app Dark Performance.
 */
function renderTransactionalEmail(layout: TransactionalEmailLayout): string {
  const supportEmail = escapeHtml(SUPPORT_EMAIL);
  const hero = layout.hero
    ? `<tr>
            <td style="line-height:0;font-size:0;">
              <img src="${emailAssetUrl(layout.hero.fileName)}" width="600" height="${layout.hero.height}" alt="${escapeHtml(layout.hero.alt)}" style="display:block;width:100%;max-width:600px;height:auto;">
            </td>
          </tr>`
    : "";
  const panelRadius = layout.hero ? "0 0 20px 20px" : "20px";

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<!--[if mso]>
<noscript>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
</noscript>
<![endif]-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0; mso-table-rspace:0; }
  img { -ms-interpolation-mode:bicubic; border:0; line-height:100%; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100% !important; background-color:${emailTheme.background}; }
  a { text-decoration:none; }
  @media screen and (max-width:600px) {
    .fb-container { width:100% !important; }
    .fb-panel { padding:28px 24px !important; }
    .fb-title { font-size:34px !important; line-height:36px !important; }
    .fb-frame { padding:28px 16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${emailTheme.background};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${layout.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${emailTheme.background};">
    <tr>
      <td class="fb-frame" align="center" style="padding:48px 16px;">
        <table role="presentation" class="fb-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
          <tr>
            <td style="padding:0 0 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="8" height="8">
                      <tr><td width="8" height="8" bgcolor="${emailTheme.purple}" style="width:8px;height:8px;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td valign="middle">${logoImgTag()}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${hero}
          <tr>
            <td class="fb-panel" bgcolor="${emailTheme.surface}" style="background-color:${emailTheme.surface};border:1px solid ${emailTheme.border};border-radius:${panelRadius};padding:40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="fb-title" style="font-family:${fontStack.display};font-size:42px;line-height:40px;font-weight:800;letter-spacing:-0.6px;color:${emailTheme.text};padding-bottom:18px;">
                    ${layout.title}
                  </td>
                </tr>
                <tr>
                  <td style="font-family:${fontStack.interface};font-size:15px;line-height:24px;color:${emailTheme.textSecondary};padding-bottom:28px;">
                    ${layout.body}
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${emailTheme.purple}" style="border-radius:999px;">
                          <a href="${layout.actionUrl}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${fontStack.interface};font-size:15px;line-height:18px;font-weight:700;color:#FFFFFF;text-decoration:none;">
                            ${layout.actionLabel}&nbsp;&rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid ${emailTheme.border};padding-top:20px;font-family:${fontStack.interface};font-size:13px;line-height:20px;color:${emailTheme.textMuted};">
                    ${layout.footer}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;font-family:${fontStack.interface};font-size:12px;line-height:18px;color:${emailTheme.textQuiet};">
              Dúvidas? Fale com a gente em <a href="mailto:${supportEmail}" style="color:${emailTheme.purpleAccessible};text-decoration:underline;">${supportEmail}</a>.
            </td>
          </tr>
          <tr>
            <td style="padding:12px 8px 0;font-family:${fontStack.interface};font-size:11px;line-height:16px;color:${emailTheme.textQuiet};">
              &copy; 2026 FitBlock Training. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderWelcomeEmail(input: {
  email: string;
  actionUrl: string;
  purpose?: WelcomeEmailPurpose;
}): RenderedEmail {
  const firstName = escapeHtml(deriveFirstName(input.email));
  const isConfirmation = (input.purpose ?? "confirmation") === "confirmation";
  const actionUrl = escapeHtml(input.actionUrl);

  return {
    subject: `${deriveFirstName(input.email)}, seu processo começa agora`,
    html: renderTransactionalEmail({
      preheader: isConfirmation
        ? "Confirme seu acesso à FitBlock e comece seu processo."
        : "Sua conta FitBlock está pronta. Veja seu treino do dia.",
      title: `${firstName}, seu processo começa agora.`,
      body: isConfirmation
        ? "Sua conta FitBlock Training foi criada. Confirme seu acesso para entrar, ver o treino do dia e acompanhar a sua evolução."
        : "Sua conta FitBlock Training está pronta. Seu treino do dia, sua evolução e o acompanhamento do seu coach ficam a um toque de distância.",
      actionLabel: isConfirmation ? "Confirmar acesso" : "Abrir meu treino",
      actionUrl,
      footer: isConfirmation
        ? "Esta confirmação protege o acesso à sua conta. Se você não criou uma conta FitBlock, pode ignorar esta mensagem."
        : "Você recebeu esta mensagem porque criou uma conta na FitBlock Training.",
      hero: { alt: "Atleta em treinamento FitBlock", fileName: "hero-welcome.jpg", height: 338 }
    })
  };
}

export function renderPasswordResetEmail(input: {
  email: string;
  resetUrl: string;
  expiresIn: string;
}): RenderedEmail {
  const email = escapeHtml(input.email);
  const resetUrl = escapeHtml(input.resetUrl);
  const expiresIn = escapeHtml(input.expiresIn);

  return {
    subject: "Redefinir sua senha FitBlock",
    html: renderTransactionalEmail({
      preheader: `Recebemos um pedido para redefinir sua senha. O link expira em ${expiresIn}.`,
      title: "Defina uma nova senha.",
      body: `Recebemos um pedido para redefinir a senha da conta FitBlock associada a <strong style="color:${emailTheme.text};font-weight:700;">${email}</strong>.`,
      actionLabel: "Definir nova senha",
      actionUrl: resetUrl,
      footer: `Este link expira em ${expiresIn} por segurança. Se você não solicitou esta alteração, ignore este e-mail — sua senha atual continua a mesma.`,
      hero: { alt: "Treino FitBlock", fileName: "hero-reset.jpg", height: 180 }
    })
  };
}
