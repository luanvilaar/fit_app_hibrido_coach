import { publicAppUrl } from "./env.js";

/**
 * Endereço mostrado no rodapé dos e-mails transacionais. Puramente de apresentação — trocar aqui
 * não muda o remetente real (`RESEND_FROM_EMAIL`), só o texto "fale com a gente em...".
 */
const SUPPORT_EMAIL = "suporte@fitblock.com.br";

export type RenderedEmail = { subject: string; html: string };

/** Escapa o mínimo necessário para texto entrar em HTML sem quebrar marcação ou injetar script. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "atleta.silva@fitblock.com" → "Atleta". Mesma derivação usada no shell do app (athlete-shell.tsx). */
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

export function renderWelcomeEmail(input: { email: string; actionUrl: string }): RenderedEmail {
  const firstName = escapeHtml(deriveFirstName(input.email));
  const actionUrl = escapeHtml(input.actionUrl);
  const supportEmail = escapeHtml(SUPPORT_EMAIL);

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Bem-vindo(a) à FitBlock</title>
<!--[if mso]>
<noscript>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
</noscript>
<![endif]-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; display: block; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #050507; }
  a { text-decoration: none; }
  @media screen and (max-width: 600px) {
    .fb-container { width: 100% !important; }
    .fb-px { padding-left: 20px !important; padding-right: 20px !important; }
    .fb-py { padding-top: 28px !important; padding-bottom: 28px !important; }
    .fb-headline { font-size: 26px !important; line-height: 30px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#050507;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Sua conta FitBlock está pronta. Entre agora e veja seu treino do dia.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050507;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="fb-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Logo -->
          <tr>
            <td align="center" class="fb-py" style="padding-bottom:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:9px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="9" height="9">
                      <tr><td width="9" height="9" bgcolor="#7132F5" style="width:9px;height:9px;border-radius:9px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td valign="middle">
                    ${logoImgTag()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero photo -->
          <tr>
            <td style="border-radius:20px 20px 0 0;overflow:hidden;line-height:0;font-size:0;">
              <img src="${emailAssetUrl("hero-welcome.jpg")}" width="600" height="338" alt="Atleta em competição FitBlock" style="display:block;width:100%;max-width:600px;height:auto;">
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td class="fb-px" bgcolor="#16161D" style="background-color:#16161D;border:1px solid #292934;border-top:none;border-radius:0 0 20px 20px;padding:40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.4px;color:#8A5CFF;text-transform:uppercase;padding-bottom:12px;">
                    BEM-VINDO(A) À FITBLOCK
                  </td>
                </tr>
                <tr>
                  <td class="fb-headline" style="font-family:'Barlow Condensed',Arial Narrow,Arial,sans-serif;font-weight:800;font-size:32px;line-height:36px;letter-spacing:-0.3px;color:#F8F8FA;padding-bottom:16px;">
                    ${firstName}, seu processo&nbsp;começa&nbsp;agora.
                  </td>
                </tr>
                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:23px;color:#A5A5B3;padding-bottom:28px;">
                    Sua conta na FitBlock Training foi criada. A partir de agora, seu treino do dia, sua evolução e o acompanhamento do seu coach ficam a um toque de distância.
                  </td>
                </tr>

                <!-- CTA button (bulletproof table button) -->
                <tr>
                  <td style="padding-bottom:32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#7132F5" style="border-radius:999px;">
                          <a href="${actionUrl}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:'Inter',Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;line-height:18px;color:#FFFFFF;text-decoration:none;">
                            Abrir meu treino&nbsp;→
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="border-top:1px solid #292934;padding-top:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="20" valign="top" style="padding-bottom:16px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="6" height="6">
                            <tr><td width="6" height="6" bgcolor="#8A5CFF" style="width:6px;height:6px;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          </table>
                        </td>
                        <td valign="top" style="padding-bottom:16px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#A5A5B3;">
                          <span style="color:#F8F8FA;font-weight:600;">Treino do dia sempre à mão</span><br>veja exatamente o que fazer, sem procurar.
                        </td>
                      </tr>
                      <tr>
                        <td width="20" valign="top" style="padding-bottom:16px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="6" height="6">
                            <tr><td width="6" height="6" bgcolor="#8A5CFF" style="width:6px;height:6px;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          </table>
                        </td>
                        <td valign="top" style="padding-bottom:16px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#A5A5B3;">
                          <span style="color:#F8F8FA;font-weight:600;">Evolução registrada automaticamente</span><br>cada sessão fica no seu histórico.
                        </td>
                      </tr>
                      <tr>
                        <td width="20" valign="top">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="6" height="6">
                            <tr><td width="6" height="6" bgcolor="#8A5CFF" style="width:6px;height:6px;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          </table>
                        </td>
                        <td valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#A5A5B3;">
                          <span style="color:#F8F8FA;font-weight:600;">Seu coach acompanha de perto</span><br>feedback e ajustes direto na sua rotina.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#747482;">
                    Você recebeu este e-mail porque criou uma conta na FitBlock Training.<br>
                    Dúvidas? Fale com a gente em <a href="mailto:${supportEmail}" style="color:#8E8E9D;text-decoration:underline;">${supportEmail}</a>.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#4A4A56;">
                    © 2026 FitBlock Training. Todos os direitos reservados.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: `${deriveFirstName(input.email)}, seu processo começa agora`, html };
}

export function renderPasswordResetEmail(input: {
  email: string;
  resetUrl: string;
  expiresIn: string;
}): RenderedEmail {
  const email = escapeHtml(input.email);
  const resetUrl = escapeHtml(input.resetUrl);
  const expiresIn = escapeHtml(input.expiresIn);
  const supportEmail = escapeHtml(SUPPORT_EMAIL);

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Redefinir senha — FitBlock</title>
<!--[if mso]>
<noscript>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
</noscript>
<![endif]-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; display: block; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #050507; }
  a { text-decoration: none; }
  @media screen and (max-width: 600px) {
    .fb-container { width: 100% !important; }
    .fb-px { padding-left: 20px !important; padding-right: 20px !important; }
    .fb-py { padding-top: 28px !important; padding-bottom: 28px !important; }
    .fb-headline { font-size: 26px !important; line-height: 30px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#050507;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Recebemos um pedido para redefinir sua senha. O link expira em ${expiresIn}.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050507;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="fb-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Logo -->
          <tr>
            <td align="center" class="fb-py" style="padding-bottom:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:9px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="9" height="9">
                      <tr><td width="9" height="9" bgcolor="#7132F5" style="width:9px;height:9px;border-radius:9px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td valign="middle">
                    ${logoImgTag()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero photo (shorter band — this is a utility email, not a campaign moment) -->
          <tr>
            <td style="border-radius:20px 20px 0 0;overflow:hidden;line-height:0;font-size:0;">
              <img src="${emailAssetUrl("hero-reset.jpg")}" width="600" height="180" alt="FitBlock Training" style="display:block;width:100%;max-width:600px;height:auto;">
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td class="fb-px" bgcolor="#16161D" style="background-color:#16161D;border:1px solid #292934;border-top:none;border-radius:0 0 20px 20px;padding:40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.4px;color:#8A5CFF;text-transform:uppercase;padding-bottom:12px;">
                    RECUPERAÇÃO DE CONTA
                  </td>
                </tr>
                <tr>
                  <td class="fb-headline" style="font-family:'Barlow Condensed',Arial Narrow,Arial,sans-serif;font-weight:800;font-size:32px;line-height:36px;letter-spacing:-0.3px;color:#F8F8FA;padding-bottom:16px;">
                    Vamos trocar sua senha.
                  </td>
                </tr>
                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:23px;color:#A5A5B3;padding-bottom:8px;">
                    Recebemos um pedido para redefinir a senha da conta FitBlock associada a
                  </td>
                </tr>
                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:23px;font-weight:700;color:#F8F8FA;padding-bottom:28px;">
                    ${email}
                  </td>
                </tr>

                <!-- CTA button (bulletproof table button) -->
                <tr>
                  <td style="padding-bottom:20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#7132F5" style="border-radius:999px;">
                          <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:'Inter',Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;line-height:18px;color:#FFFFFF;text-decoration:none;">
                            Definir nova senha&nbsp;→
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:19px;color:#8E8E9D;padding-bottom:24px;">
                    Este link expira em ${expiresIn} por segurança. Se ele expirar, é só pedir um novo na tela de login.
                  </td>
                </tr>

                <!-- Security notice -->
                <tr>
                  <td style="border-top:1px solid #292934;padding-top:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#747482;">
                          Se você não pediu essa alteração, pode ignorar este e-mail com segurança — sua senha atual continua a mesma e nenhuma outra ação é necessária.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#747482;">
                    Este é um e-mail de segurança sobre sua conta FitBlock Training.<br>
                    Dúvidas? Fale com a gente em <a href="mailto:${supportEmail}" style="color:#8E8E9D;text-decoration:underline;">${supportEmail}</a>.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#4A4A56;">
                    © 2026 FitBlock Training. Todos os direitos reservados.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: "Redefinir sua senha FitBlock", html };
}
