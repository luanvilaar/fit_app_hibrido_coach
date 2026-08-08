import type { FitBlockSupabaseClient } from "./supabase";

export const teamMemberRoles = ["coach", "athlete"] as const;

export type TeamMemberRole = (typeof teamMemberRoles)[number];

export type UserRolesRecord = {
  user_id: string | null;
  is_coach: boolean;
  is_athlete: boolean;
  is_owner: boolean;
  roles: (TeamMemberRole | "owner")[];
  coach_team_ids: string[];
  athlete_team_ids: string[];
};

export const emptyUserRolesRecord: UserRolesRecord = {
  user_id: null,
  is_coach: false,
  is_athlete: false,
  is_owner: false,
  roles: [],
  coach_team_ids: [],
  athlete_team_ids: []
};

export class RolesBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "RolesBackendError";
  }
}

export function createRolesRepository(client: FitBlockSupabaseClient) {
  return {
    async getCurrentUserRoles(): Promise<UserRolesRecord> {
      const { data, error } = await client.rpc("current_user_roles");

      if (error) {
        throw new RolesBackendError(error.message, "getCurrentUserRoles");
      }

      return (data ?? emptyUserRolesRecord) as UserRolesRecord;
    }
  };
}
