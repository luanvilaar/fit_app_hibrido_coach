import type { FitBlockSupabaseClient } from "./supabase";
import type { CreateTrainingGroupRequest } from "./coach-flow-repository";

export type TeamMembershipStatus = "none" | "pending" | "member";

/** Grupo disponível para vínculo, com o coach responsável já resolvido e o status do usuário atual. */
export type DiscoverableTeamRecord = {
  id: string;
  name: string;
  description: string;
  level: CreateTrainingGroupRequest["level"];
  objective: string;
  coach_display_name: string;
  athlete_count: number;
  membership_status: TeamMembershipStatus;
  /** id da solicitação pendente do usuário autenticado para este grupo; null fora do status "pending". */
  join_request_id: string | null;
};

export type TeamJoinRequestStatus = "pending" | "accepted" | "declined" | "canceled";

export type TeamJoinRequestRecord = {
  id: string;
  team_id: string;
  athlete_id: string;
  status: TeamJoinRequestStatus;
  created_at: string;
};

/** Solicitação de vínculo com o nome do atleta resolvido, para a tela do coach responder. */
export type TeamJoinRequestWithAthleteRecord = TeamJoinRequestRecord & {
  athlete_display_name: string;
};

export type ProfileRecord = {
  user_id: string;
  display_name: string | null;
};

export class TeamDiscoveryBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "TeamDiscoveryBackendError";
  }
}

export function createTeamDiscoveryRepository(client: FitBlockSupabaseClient) {
  return {
    /** Nome de exibição já salvo do usuário autenticado, se houver; RLS restringe à própria linha. */
    async getMyProfile(userId: string): Promise<ProfileRecord | null> {
      const { data, error } = await client
        .from("profiles")
        .select("user_id,display_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw new TeamDiscoveryBackendError(error.message, "getMyProfile");
      }

      return (data as ProfileRecord | null) ?? null;
    },

    async listDiscoverableTeams(): Promise<DiscoverableTeamRecord[]> {
      const { data, error } = await client.rpc("list_discoverable_teams");

      if (error) {
        throw new TeamDiscoveryBackendError(error.message, "listDiscoverableTeams");
      }

      return (data ?? []) as DiscoverableTeamRecord[];
    },

    async requestTeamJoin(teamId: string): Promise<TeamJoinRequestRecord> {
      const { data, error } = await client.rpc("request_team_join", { p_team_id: teamId }).single();

      if (error) {
        throw new TeamDiscoveryBackendError(error.message, "requestTeamJoin");
      }

      return data as TeamJoinRequestRecord;
    },

    async cancelTeamJoinRequest(requestId: string): Promise<void> {
      const { error } = await client.rpc("cancel_team_join_request", { p_request_id: requestId });

      if (error) {
        throw new TeamDiscoveryBackendError(error.message, "cancelTeamJoinRequest");
      }
    },

    /** Solicitações pendentes de um grupo; só coaches da equipe podem chamar (lado coach). */
    async listTeamJoinRequests(teamId: string): Promise<TeamJoinRequestWithAthleteRecord[]> {
      const { data, error } = await client.rpc("list_team_join_requests", { p_team_id: teamId });

      if (error) {
        throw new TeamDiscoveryBackendError(error.message, "listTeamJoinRequests");
      }

      return (data ?? []) as TeamJoinRequestWithAthleteRecord[];
    },

    /** Aceitar cria o vínculo em team_members; recusar só marca a solicitação como declined. */
    async respondTeamJoinRequest(requestId: string, accept: boolean): Promise<void> {
      const { error } = await client.rpc("respond_team_join_request", {
        p_request_id: requestId,
        p_accept: accept
      });

      if (error) {
        throw new TeamDiscoveryBackendError(error.message, "respondTeamJoinRequest");
      }
    },

    /** Define o nome de exibição do usuário autenticado (coach ou atleta). */
    async updateMyDisplayName(displayName: string): Promise<ProfileRecord> {
      const { data, error } = await client
        .rpc("update_my_display_name", { p_display_name: displayName })
        .single();

      if (error) {
        throw new TeamDiscoveryBackendError(error.message, "updateMyDisplayName");
      }

      return data as ProfileRecord;
    }
  };
}
