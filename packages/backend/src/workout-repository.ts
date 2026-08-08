import type { FitBlockSupabaseClient } from "./supabase";
import type { CalendarSessionRecord } from "./calendar-repository";
import type { AthleteSessionProgressRecord } from "./today-repository";

export type AthleteSetResultRecord = {
  id: string;
  session_id: string;
  athlete_id: string;
  /** Id do item no snapshot congelado; sem FK porque o template pode ser substituído. */
  block_item_id: string;
  set_number: number;
  reps: number | null;
  load_kg: number | null;
  completed: boolean;
};

export type SessionWorkoutRecord = {
  session: CalendarSessionRecord | null;
  progress: AthleteSessionProgressRecord | null;
  results: AthleteSetResultRecord[];
};

export type SaveSetResultRequest = {
  sessionId: string;
  blockItemId: string;
  setNumber: number;
  reps: number | null;
  loadKg: number | null;
  completed: boolean;
};

export class WorkoutBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "WorkoutBackendError";
  }
}

export function createWorkoutRepository(client: FitBlockSupabaseClient) {
  return {
    /** Sem `sessionId`, o backend devolve a sessão publicada de hoje. */
    async getSessionWorkout(sessionId?: string | null): Promise<SessionWorkoutRecord> {
      const { data, error } = await client.rpc("get_athlete_session_workout", {
        p_session_id: sessionId ?? null
      });

      if (error) {
        throw new WorkoutBackendError(error.message, "getSessionWorkout");
      }

      return data as SessionWorkoutRecord;
    },

    async saveSetResult(input: SaveSetResultRequest): Promise<AthleteSetResultRecord> {
      const { data, error } = await client
        .rpc("save_athlete_set_result", {
          p_session_id: input.sessionId,
          p_block_item_id: input.blockItemId,
          p_set_number: input.setNumber,
          p_reps: input.reps,
          p_load_kg: input.loadKg,
          p_completed: input.completed
        })
        .single();

      if (error) {
        throw new WorkoutBackendError(error.message, "saveSetResult");
      }

      return data as AthleteSetResultRecord;
    }
  };
}
