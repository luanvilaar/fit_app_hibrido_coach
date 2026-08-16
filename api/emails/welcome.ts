import { authenticate } from "../_lib/auth";
import { publicAppUrl } from "../_lib/env";
import { renderWelcomeEmail } from "../_lib/email-templates";
import { failure, json, logAndFail, methodNotAllowed } from "../_lib/http";
import { sendTransactionalEmail } from "../_lib/resend";

/**
 * Dispara o e-mail de boas-vindas quando a conta já nasce confirmada (projeto Supabase com
 * "Confirm email" desligado — `signUp()` devolve sessão na hora, sem o Supabase mandar e-mail de
 * confirmação e sem o Auth Hook disparar). Quando a confirmação está ligada, o e-mail de
 * boas-vindas sai pelo "Send Email Hook" (`api/webhooks/supabase-auth-email.ts`), combinado com o
 * link de confirmação real — este endpoint fica ocioso nesse caso, sem duplicar envio.
 *
 * A identidade vem sempre do token da própria sessão recém-criada, nunca de um `email` no corpo:
 * senão qualquer chamada autenticada conseguiria mandar este endpoint escrever para outra pessoa.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const user = await authenticate(request);
  if (!user) return failure("Sua sessão expirou. Entre novamente.", 401);
  if (!user.email) return failure("Sua conta precisa ter um e-mail.", 400);

  try {
    const { subject, html } = renderWelcomeEmail({
      email: user.email,
      actionUrl: `${publicAppUrl()}/app/hoje`
    });

    await sendTransactionalEmail({ to: user.email, subject, html });
  } catch (error: unknown) {
    return logAndFail("emails/welcome", error, "Não foi possível enviar o e-mail de boas-vindas.");
  }

  return json({ sent: true });
}
