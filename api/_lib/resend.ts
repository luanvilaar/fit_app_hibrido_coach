import { Resend } from "resend";
import { resendConfig } from "./env";

let client: Resend | null = null;

function resendClient(): Resend {
  if (!client) client = new Resend(resendConfig().apiKey);
  return client;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Envia um e-mail transacional (boas-vindas, redefinição de senha). Lança em caso de falha — quem
 * chama decide se isso deve derrubar a requisição (webhook do Supabase) ou só ser registrado sem
 * quebrar o fluxo que disparou o envio (signup do app).
 */
export async function sendTransactionalEmail(email: OutgoingEmail): Promise<void> {
  const { from } = resendConfig();
  const { error } = await resendClient().emails.send({
    from,
    to: email.to,
    subject: email.subject,
    html: email.html
  });

  if (error) {
    throw new Error(`Resend recusou o envio: ${error.message}`);
  }
}
