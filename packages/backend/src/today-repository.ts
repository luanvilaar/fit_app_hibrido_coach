import type { FitBlockSupabaseClient } from "./supabase";
import type { CalendarSessionRecord } from "./calendar-repository";

export type AthleteSessionState = "started" | "completed" | "partially_completed" | "skipped";

export type AthleteSessionProgressRecord = {
  id: string;
  session_id: string;
  athlete_id: string;
  state: AthleteSessionState;
  completed_block_ids: string[];
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Lista fechada, espelhada na check constraint athlete_daily_checkins_pain_region_check. */
export type CheckinPainRegion =
  | "pescoco"
  | "ombro"
  | "cotovelo"
  | "punho_mao"
  | "costas"
  | "lombar"
  | "quadril"
  | "coxa"
  | "joelho"
  | "panturrilha"
  | "tornozelo_pe"
  | "outro";

export type AthleteCheckinRecord = {
  id: string;
  athlete_id: string;
  checkin_date: string;
  /** As sete respostas vão de 1 (pior) a 5 (melhor), todas na mesma direção. */
  sleep_score: number;
  energy_score: number;
  muscle_recovery_score: number;
  /** Já invertido para a direção única: 1 = muito estressado, 5 = tranquilo. */
  stress_score: number;
  mood_score: number;
  motivation_score: number;
  /** Resposta subjetiva "prontidão geral"; não confundir com `readiness`. */
  overall_readiness_score: number;
  pain_region: CheckinPainRegion | null;
  /** De 0 a 10; sempre preenchida quando há região. */
  pain_intensity: number | null;
  /** Média das sete respostas, derivada no banco. */
  readiness: number;
  note: string;
};

export type AthleteWeekSummary = {
  start: string;
  end: string;
  planned: number;
  completed: number;
  /** Posição da sessão de hoje entre as sessões já prescritas na semana. */
  position: number;
};

export type TodayDashboardRecord = {
  reference_date: string;
  session: CalendarSessionRecord | null;
  progress: AthleteSessionProgressRecord | null;
  next_session: CalendarSessionRecord | null;
  week: AthleteWeekSummary;
  streak_days: number;
  checkin: AthleteCheckinRecord | null;
};

export type SaveCheckinRequest = {
  sleepScore: number;
  energyScore: number;
  muscleRecoveryScore: number;
  stressScore: number;
  moodScore: number;
  motivationScore: number;
  overallReadinessScore: number;
  /** Região e intensidade andam juntas: as duas ou nenhuma. */
  painRegion?: CheckinPainRegion | null;
  painIntensity?: number | null;
  note?: string;
  checkinDate?: string;
};

export const emptyWeekSummary: AthleteWeekSummary = {
  start: "",
  end: "",
  planned: 0,
  completed: 0,
  position: 0
};

export class TodayBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "TodayBackendError";
  }
}

export function createTodayRepository(client: FitBlockSupabaseClient) {
  return {
    async getToday(referenceDate?: string): Promise<TodayDashboardRecord> {
      const { data, error } = await client.rpc("get_athlete_today", {
        p_reference_date: referenceDate ?? null
      });

      if (error) {
        throw new TodayBackendError(error.message, "getToday");
      }

      return data as TodayDashboardRecord;
    },

    async startSession(sessionId: string): Promise<AthleteSessionProgressRecord> {
      const { data, error } = await client
        .rpc("start_athlete_session", { p_session_id: sessionId })
        .single();

      if (error) {
        throw new TodayBackendError(error.message, "startSession");
      }

      return data as AthleteSessionProgressRecord;
    },

    async completeSession(
      sessionId: string,
      state: AthleteSessionState = "completed"
    ): Promise<AthleteSessionProgressRecord> {
      const { data, error } = await client
        .rpc("complete_athlete_session", { p_session_id: sessionId, p_state: state })
        .single();

      if (error) {
        throw new TodayBackendError(error.message, "completeSession");
      }

      return data as AthleteSessionProgressRecord;
    },

    async toggleBlock(sessionId: string, blockId: string): Promise<AthleteSessionProgressRecord> {
      const { data, error } = await client
        .rpc("toggle_athlete_block", { p_session_id: sessionId, p_block_id: blockId })
        .single();

      if (error) {
        throw new TodayBackendError(error.message, "toggleBlock");
      }

      return data as AthleteSessionProgressRecord;
    },

    async saveCheckin(input: SaveCheckinRequest): Promise<AthleteCheckinRecord> {
      const { data, error } = await client
        .rpc("upsert_athlete_checkin", {
          p_sleep_score: input.sleepScore,
          p_energy_score: input.energyScore,
          p_muscle_recovery_score: input.muscleRecoveryScore,
          p_stress_score: input.stressScore,
          p_mood_score: input.moodScore,
          p_motivation_score: input.motivationScore,
          p_overall_readiness_score: input.overallReadinessScore,
          p_pain_region: input.painRegion ?? null,
          p_pain_intensity: input.painIntensity ?? null,
          p_note: input.note ?? "",
          p_checkin_date: input.checkinDate ?? null
        })
        .single();

      if (error) {
        throw new TodayBackendError(error.message, "saveCheckin");
      }

      return data as AthleteCheckinRecord;
    }
  };
}
