import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { renderPasswordResetEmail, renderWelcomeEmail, type RenderedEmail } from "../_lib/email-templates.js";
import { supabaseAuthHookSecret, supabaseConfig } from "../_lib/env.js";
import { failure, json, logAndFail, methodNotAllowed } from "../_lib/http.js";
import { sendTransactionalEmail } from "../_lib/resend.js";

/**
 * "Send Email Hook" do Supabase (Authentication > Hooks > Send Email).
 *
 * O Supabase para de mandar seu próprio e-mail de confirmação/recuperação assim que este hook é
 * habilitado no painel — a partir daí, TODO e-mail de autenticação passa por aqui. Se este
 * endpoint falhar silenciosamente, ninguém confirma conta nem redefine senha; por isso qualquer
 * erro depois da assinatura validada responde 5xx (Supabase reentrega) em vez de engolir o erro.
 *
 * A assinatura é obrigatória: sem ela, qualquer um que descubra esta URL poderia mandar enviar um
 * e-mail de "redefinição de senha" com um link de sua escolha, em nome da FitBlock.
 */

type SupabaseHookUser = {
  id: string;
  email?: string | null;
};

type SupabaseHookEmailData = {
  token_hash: string;
  email_action_type: string;
  redirect_to: string;
};

type SupabaseHookPayload = {
  user: SupabaseHookUser;
  email_data: SupabaseHookEmailData;
};

// Prazo do link de recuperação exibido no e-mail. Supabase controla o valor real em
// Authentication > Email > OTP Expiration — mantenha este texto alinhado se trocar lá.
const RECOVERY_LINK_EXPIRY_COPY = "1 hora";

function isSupabaseHookPayload(value: unknown): value is SupabaseHookPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  const user = candidate.user;
  const emailData = candidate.email_data;

  if (typeof user !== "object" || user === null) return false;
  if (typeof emailData !== "object" || emailData === null) return false;

  const userRecord = user as Record<string, unknown>;
  const emailDataRecord = emailData as Record<string, unknown>;

  return (
    typeof userRecord.id === "string"
    && typeof emailDataRecord.token_hash === "string"
    && typeof emailDataRecord.email_action_type === "string"
    && typeof emailDataRecord.redirect_to === "string"
  );
}

function buildVerifyUrl(emailData: SupabaseHookEmailData): string {
  const url = new URL("/auth/v1/verify", supabaseConfig().url);
  url.searchParams.set("token", emailData.token_hash);
  url.searchParams.set("type", emailData.email_action_type);
  url.searchParams.set("redirect_to", emailData.redirect_to);
  return url.toString();
}

/**
 * Tipos de e-mail que o Supabase pode disparar sem um template dedicado nesta fase (magic link,
 * troca de e-mail, reautenticação). O app hoje não usa nenhum deles, mas o hook, uma vez
 * habilitado, responde por TODOS os tipos — melhor um e-mail genérico de marca do que a conta
 * ficar sem confirmação por um tipo não previsto.
 */
function renderFallbackEmail(email: string, actionUrl: string): RenderedEmail {
  const reset = renderPasswordResetEmail({ email, resetUrl: actionUrl, expiresIn: RECOVERY_LINK_EXPIRY_COPY });
  return {
    subject: "Uma ação é necessária na sua conta FitBlock",
    html: reset.html
      .replace("RECUPERAÇÃO DE CONTA", "CONFIRMAÇÃO NECESSÁRIA")
      .replace("Vamos trocar sua senha.", "Confirme esta ação.")
      .replace("Definir nova senha", "Confirmar")
  };
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const rawBody = await request.text().catch(() => "");

  let payload: unknown;

  try {
    const webhook = new Webhook(supabaseAuthHookSecret());
    payload = webhook.verify(rawBody, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? ""
    });
  } catch (error: unknown) {
    if (error instanceof WebhookVerificationError) return failure("Assinatura inválida.", 401);
    return logAndFail("supabase-auth-email:verify", error, "Não foi possível validar o webhook.");
  }

  if (!isSupabaseHookPayload(payload)) {
    return failure("Payload inesperado do Supabase Auth Hook.", 400);
  }

  const email = payload.user.email;
  if (!email) return json({ received: true }); // Sem e-mail cadastrado, não há para onde mandar.

  try {
    const actionUrl = buildVerifyUrl(payload.email_data);
    let rendered: RenderedEmail;

    switch (payload.email_data.email_action_type) {
      case "signup":
        rendered = renderWelcomeEmail({ email, actionUrl });
        break;
      case "recovery":
        rendered = renderPasswordResetEmail({
          email,
          resetUrl: actionUrl,
          expiresIn: RECOVERY_LINK_EXPIRY_COPY
        });
        break;
      default:
        rendered = renderFallbackEmail(email, actionUrl);
    }

    await sendTransactionalEmail({ to: email, subject: rendered.subject, html: rendered.html });
  } catch (error: unknown) {
    return logAndFail("supabase-auth-email:send", error, "Não foi possível enviar o e-mail.");
  }

  return json({ received: true });
}

export default { fetch: handler };
