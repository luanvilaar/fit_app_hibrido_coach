import type { TeamMembershipStatus } from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";

export const membershipStatusLabels: Record<TeamMembershipStatus, string | null> = {
  none: null,
  pending: "Solicitação pendente",
  member: "Vinculado"
};

/** Texto para o status de vínculo do atleta com um grupo; null quando não há nada a mostrar. */
export function describeMembershipStatus(status: TeamMembershipStatus): string | null {
  return membershipStatusLabels[status];
}

/** Nome de exibição exige ao menos 2 caracteres, mesma regra da RPC update_my_display_name. */
export function validateDisplayName(value: string): string {
  const normalized = value.trim();

  if (normalized.length < 2) {
    throw new Error("Informe um nome com pelo menos 2 caracteres.");
  }

  return normalized;
}

/** Traduz falhas do backend em mensagens que fazem sentido para quem está pedindo vínculo. */
export function describeTeamDiscoveryBackendError(error: unknown): string {
  return describeBackendError(error);
}
