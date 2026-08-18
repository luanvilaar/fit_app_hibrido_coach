import type { FitBlockSupabaseClient } from "./supabase";

export type SessionInstanceState =
  | "available"
  | "started"
  | "completed"
  | "partially_completed"
  | "missed"
  | "cancelled"
  | "rescheduled"
  | "plan_locked"
  | "recovery";

export type CalendarSessionRecord = {
  id: string;
  template_id: string;
  team_id: string;
  scheduled_date: string;
  status: "draft" | "published";
  state: SessionInstanceState;
  snapshot: Record<string, unknown>;
  /** Mensagem do coach para a sessão; string vazia quando não há recado. */
  coach_note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CalendarProgramDayType = "rest" | "recovery" | "assessment" | "unprogrammed";

/** Dia não executável de uma instância de programa. Não possui template nem sessão iniciável. */
export type CalendarProgramDayRecord = {
  id: string;
  entry_type: "program_day";
  scheduled_date: string;
  day_type: CalendarProgramDayType;
  title: string;
  session_instance_id: null;
};

export type CalendarEntryRecord = CalendarSessionRecord | CalendarProgramDayRecord;

export function isCalendarSessionEntry(entry: CalendarEntryRecord): entry is CalendarSessionRecord {
  return !("entry_type" in entry && entry.entry_type === "program_day");
}

export type CalendarRangeRequest = {
  from: string;
  to: string;
};

export class CalendarBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "CalendarBackendError";
  }
}

export function createCalendarRepository(client: FitBlockSupabaseClient) {
  return {
    async listPublishedSessions(input: CalendarRangeRequest): Promise<CalendarSessionRecord[]> {
      const { data, error } = await client.rpc("list_athlete_calendar", {
        p_from: input.from,
        p_to: input.to
      });

      if (error) {
        throw new CalendarBackendError(error.message, "listPublishedSessions");
      }

      return (data ?? []) as CalendarSessionRecord[];
    },

    async listCalendarEntries(input: CalendarRangeRequest): Promise<CalendarEntryRecord[]> {
      const { data, error } = await client.rpc("list_athlete_calendar_entries", {
        p_from: input.from,
        p_to: input.to
      });

      if (error) {
        throw new CalendarBackendError(error.message, "listCalendarEntries");
      }

      return ((data ?? []) as Array<Record<string, unknown>>).map((entry) => {
        if (entry.entry_type === "program_day") {
          return {
            id: String(entry.id),
            entry_type: "program_day",
            scheduled_date: String(entry.scheduled_date),
            day_type: entry.day_type as CalendarProgramDayType,
            title: String(entry.title ?? "Sem programação"),
            session_instance_id: null
          };
        }

        return entry as unknown as CalendarSessionRecord;
      });
    },

    async getPublishedSession(sessionId: string): Promise<CalendarSessionRecord> {
      const { data, error } = await client
        .rpc("get_athlete_session", { p_session_id: sessionId })
        .single();

      if (error) {
        throw new CalendarBackendError(error.message, "getPublishedSession");
      }

      return data as CalendarSessionRecord;
    }
  };
}
