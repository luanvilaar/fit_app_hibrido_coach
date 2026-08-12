import type { AddTeamMemberByEmailRequest, TeamMemberRole, UpdateTrainingGroupRequest } from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import { requiredText } from "@/data/coach-hibrido/text";

export const trainingGroupLevels = ["iniciante", "intermediário", "avançado"] as const;

export type TrainingGroupLevel = (typeof trainingGroupLevels)[number];

export type TeamForm = {
  name: string;
  description: string;
  level: TrainingGroupLevel;
  objective: string;
};

export function createInitialTeamForm(): TeamForm {
  return { name: "", description: "", level: "iniciante", objective: "" };
}

export function toTeamForm(team: {
  name: string;
  description: string;
  level: TrainingGroupLevel;
  objective: string;
}): TeamForm {
  return { name: team.name, description: team.description, level: team.level, objective: team.objective };
}

export function updateTeamField<Field extends keyof TeamForm>(
  form: TeamForm,
  field: Field,
  value: TeamForm[Field]
): TeamForm {
  return { ...form, [field]: value };
}

export function buildCreateTeamPayload(form: TeamForm) {
  return {
    name: requiredText(form.name, "Nome da equipe"),
    description: form.description.trim(),
    level: form.level,
    objective: requiredText(form.objective, "Objetivo da equipe")
  };
}

export function buildUpdateTeamPayload(teamId: string, form: TeamForm): UpdateTrainingGroupRequest {
  return { teamId, ...buildCreateTeamPayload(form) };
}

export type MemberInviteForm = {
  email: string;
  role: TeamMemberRole;
};

export function createInitialMemberInviteForm(): MemberInviteForm {
  return { email: "", role: "athlete" };
}

export function updateMemberInviteField<Field extends keyof MemberInviteForm>(
  form: MemberInviteForm,
  field: Field,
  value: MemberInviteForm[Field]
): MemberInviteForm {
  return { ...form, [field]: value };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildAddMemberPayload(teamId: string, form: MemberInviteForm): AddTeamMemberByEmailRequest {
  const email = requiredText(form.email, "E-mail").toLowerCase();

  if (!emailPattern.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }

  return { teamId, email, role: form.role };
}

/** Traduz falhas do backend em mensagens que fazem sentido para o coach. */
export function describeTeamBackendError(error: unknown): string {
  return describeBackendError(error);
}
