import type { CalendarSessionRecord } from "./calendar-repository";
import type { AthleteSetResultRecord } from "./workout-repository";
import type { FitBlockSupabaseClient } from "./supabase";

export type CoachSupervisionRosterRecord = {
  athlete_id: string;
  display_name: string;
  team_id: string;
  team_name: string;
};

export type CoachSupervisionSessionRecord = CalendarSessionRecord & {
  team_name: string;
  progress_state: "started" | "completed" | "partially_completed" | "skipped" | null;
  completed_block_ids: string[] | null;
};

export type CoachSupervisionWorkout = {
  session: CalendarSessionRecord | null;
  progress: {
    state: CoachSupervisionSessionRecord["progress_state"];
    completed_block_ids: string[];
  } | null;
  results: AthleteSetResultRecord[];
};

export class CoachSupervisionBackendError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "CoachSupervisionBackendError";
  }
}

export function createCoachSupervisionRepository(client: FitBlockSupabaseClient) {
  return {
    async listRoster(): Promise<CoachSupervisionRosterRecord[]> {
      const { data, error } = await client.rpc("list_coach_supervision_roster");
      if (error) throw new CoachSupervisionBackendError(error.message, "listRoster", error.code);
      return (data ?? []) as CoachSupervisionRosterRecord[];
    },

    async listAthleteSessions(athleteId: string, from: string, to: string): Promise<CoachSupervisionSessionRecord[]> {
      const { data, error } = await client.rpc("list_coach_supervision_sessions", {
        p_athlete_id: athleteId,
        p_from: from,
        p_to: to
      });
      if (error) throw new CoachSupervisionBackendError(error.message, "listAthleteSessions", error.code);
      return (data ?? []) as CoachSupervisionSessionRecord[];
    },

    async getAthleteSession(athleteId: string, sessionId: string): Promise<CoachSupervisionWorkout> {
      const { data, error } = await client.rpc("get_coach_supervision_session", {
        p_athlete_id: athleteId,
        p_session_id: sessionId
      });
      if (error) throw new CoachSupervisionBackendError(error.message, "getAthleteSession", error.code);
      return data as CoachSupervisionWorkout;
    }
  };
}
