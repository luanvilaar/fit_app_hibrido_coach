import type { Href } from "expo-router";

export const appRoles = ["coach", "athlete", "owner"] as const;

export type AppRole = (typeof appRoles)[number];

export type UserRoles = {
  userId: string | null;
  roles: AppRole[];
  coachTeamIds: string[];
  athleteTeamIds: string[];
};

export const emptyUserRoles: UserRoles = {
  userId: null,
  roles: [],
  coachTeamIds: [],
  athleteTeamIds: []
};

/** Rota usada quando alguém sem o papel exigido tenta abrir uma área restrita. */
export const roleFallbackRoute: Href = "/app/hoje";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<string[]>((accumulated, item) => {
    const normalized = readString(item);
    if (normalized && !accumulated.includes(normalized)) accumulated.push(normalized);
    return accumulated;
  }, []);
}

function isAppRole(value: string): value is AppRole {
  return (appRoles as readonly string[]).includes(value);
}

/**
 * Converte o payload da RPC `current_user_roles` no modelo de papéis do app.
 * A entrada é tratada como desconhecida porque atravessa a fronteira do backend.
 */
export function normalizeUserRoles(payload: unknown): UserRoles {
  if (!payload || typeof payload !== "object") return emptyUserRoles;

  const record = payload as Record<string, unknown>;
  const declaredRoles = readStringList(record.roles).filter(isAppRole);
  const coachTeamIds = readStringList(record.coach_team_ids);
  const athleteTeamIds = readStringList(record.athlete_team_ids);
  const roles = appRoles.filter(
    (role) =>
      declaredRoles.includes(role) ||
      (role === "coach" && (record.is_coach === true || coachTeamIds.length > 0)) ||
      (role === "athlete" && (record.is_athlete === true || athleteTeamIds.length > 0)) ||
      (role === "owner" && record.is_owner === true)
  );

  return {
    userId: readString(record.user_id),
    roles,
    coachTeamIds,
    athleteTeamIds
  };
}

export function hasRole(userRoles: UserRoles, role: AppRole): boolean {
  return userRoles.roles.includes(role);
}

export function canAccessCoachArea(userRoles: UserRoles): boolean {
  return hasRole(userRoles, "coach");
}

export function canAccessOwnerArea(userRoles: UserRoles): boolean {
  return hasRole(userRoles, "owner");
}
