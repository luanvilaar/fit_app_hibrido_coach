import type { FitBlockSupabaseClient } from "./supabase";
import type { CalendarSessionRecord } from "./calendar-repository";
import type { AthleteSessionProgressRecord } from "./today-repository";

export type WeeklyHistoryEntry = {
  week_start: string;
  planned: number;
  completed: number;
};

export type SessionHistoryEntry = {
  session: CalendarSessionRecord;
  progress: AthleteSessionProgressRecord;
};

export type PersonalRecordEntry = {
  exercise_name: string;
  load_kg: number;
  reps: number | null;
  achieved_on: string;
};

export type AthleteProgressRecord = {
  streak_days: number;
  weekly_history: WeeklyHistoryEntry[];
  session_history: SessionHistoryEntry[];
  personal_records: PersonalRecordEntry[];
};

export class ProgressBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "ProgressBackendError";
  }
}

export function createProgressRepository(client: FitBlockSupabaseClient) {
  return {
    async getProgress(weeks = 8): Promise<AthleteProgressRecord> {
      const { data, error } = await client.rpc("get_athlete_progress", { p_weeks: weeks });

      if (error) {
        throw new ProgressBackendError(error.message, "getProgress");
      }

      return data as AthleteProgressRecord;
    }
  };
}
