import type { FitBlockSupabaseClient } from "./supabase";

/**
 * Estado da conexão do coach com o provedor de pagamento.
 *
 * Nenhum campo sensível trafega: os tokens vivem cifrados numa tabela que o client não consegue
 * ler nem com a própria sessão (RLS habilitada e sem policy alguma). O que chega aqui vem da RPC
 * `my_payment_connection_status`, que devolve só o que a UI precisa mostrar.
 */
export type PaymentConnectionStatus = {
  connected: boolean;
  provider?: "mercado_pago";
  account_email?: string | null;
  /** false = credenciais de teste. A UI avisa, para o coach não descobrir tarde demais. */
  live_mode?: boolean;
  connected_at?: string;
  /** O token venceu e a renovação não rodou: o caminho é reconectar. */
  needs_reconnect?: boolean;
};

export class PaymentConnectionBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "PaymentConnectionBackendError";
  }
}

export function createPaymentConnectionRepository(client: FitBlockSupabaseClient) {
  return {
    async getStatus(): Promise<PaymentConnectionStatus> {
      const { data, error } = await client.rpc("my_payment_connection_status");

      if (error) {
        throw new PaymentConnectionBackendError(error.message, "getStatus");
      }

      return data as PaymentConnectionStatus;
    }
  };
}
