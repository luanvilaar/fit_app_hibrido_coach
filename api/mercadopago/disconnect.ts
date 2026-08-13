import { authenticate, serviceRoleClient } from "../_lib/auth";
import { failure, json, logAndFail, methodNotAllowed } from "../_lib/http";

/**
 * Desconecta a conta do coach.
 *
 * Apaga a linha inteira em vez de marcar como inativa: o que está guardado é uma credencial, e
 * credencial revogada não tem por que continuar existindo cifrada no banco. O histórico do que já
 * foi pago vive em `charge_payments` e não depende desta tabela.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  try {
    const user = await authenticate(request);

    if (!user) return failure("Sua sessão expirou. Entre novamente.", 401);

    const client = serviceRoleClient();

    const { error } = await client
      .from("payment_provider_connections")
      .delete()
      .eq("coach_id", user.id);

    if (error) throw error;

    return json({ connected: false });
  } catch (error: unknown) {
    return logAndFail("disconnect", error, "Não foi possível desconectar a conta.");
  }
}
