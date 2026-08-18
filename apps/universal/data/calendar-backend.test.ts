import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CalendarBackendError,
  createCalendarRepository,
  type CalendarSessionRecord
} from "@fitblock/backend";

const session: CalendarSessionRecord = {
  id: "instance-01",
  template_id: "template-01",
  team_id: "team-01",
  scheduled_date: "2026-08-10",
  status: "published",
  state: "available",
  coach_note: "",
  snapshot: { title: "Lower Strength", blocks: [] },
  created_by: "coach-01",
  created_at: "2026-08-05T12:00:00.000Z",
  updated_at: "2026-08-05T12:00:00.000Z"
};

function createMockClient(options?: { listError?: { message: string }; sessionError?: { message: string } }) {
  const listRpc = jest.fn().mockResolvedValue({
    data: options?.listError ? null : [session],
    error: options?.listError ?? null
  });
  const sessionRpc = jest.fn().mockReturnValue({
    single: jest.fn().mockResolvedValue({
      data: options?.sessionError ? null : session,
      error: options?.sessionError ?? null
    })
  });
  const client = {
    rpc: jest.fn().mockImplementation((name: string) => {
      if (name === "list_athlete_calendar" || name === "list_athlete_calendar_entries") return listRpc();
      return sessionRpc();
    })
  } as unknown as SupabaseClient;

  return { client, rpc: client.rpc as jest.Mock, listRpc, sessionRpc };
}

describe("calendar backend repository", () => {
  it("lists published sessions for the requested calendar range", async () => {
    const { client, rpc } = createMockClient();
    const repository = createCalendarRepository(client);

    await expect(
      repository.listPublishedSessions({ from: "2026-08-01", to: "2026-08-31" })
    ).resolves.toEqual([session]);

    expect(rpc).toHaveBeenCalledWith("list_athlete_calendar", {
      p_from: "2026-08-01",
      p_to: "2026-08-31"
    });
  });

  it("loads a published session snapshot for prescription display", async () => {
    const { client, rpc } = createMockClient();
    const repository = createCalendarRepository(client);

    await expect(repository.getPublishedSession("instance-01")).resolves.toEqual(session);
    expect(rpc).toHaveBeenCalledWith("get_athlete_session", { p_session_id: "instance-01" });
  });

  it("lê dias não executáveis do programa junto das sessões reais", async () => {
    const { client, listRpc, rpc } = createMockClient();
    listRpc.mockResolvedValueOnce({
      data: [
        { ...session, entry_type: "session", day_type: "training", title: "Lower Strength", session_instance_id: session.id },
        { id: "delivery-rest", entry_type: "program_day", scheduled_date: "2026-08-18", day_type: "rest", title: "Descanso", session_instance_id: null },
        { id: "delivery-recovery", entry_type: "program_day", scheduled_date: "2026-08-19", day_type: "recovery", title: "Recuperação", session_instance_id: null },
        { id: "delivery-assessment", entry_type: "program_day", scheduled_date: "2026-08-20", day_type: "assessment", title: "Avaliação", session_instance_id: null },
        { id: "delivery-empty", entry_type: "program_day", scheduled_date: "2026-08-21", day_type: "unprogrammed", title: "Sem programação", session_instance_id: null }
      ],
      error: null
    });
    const repository = createCalendarRepository(client);

    const entries = await repository.listCalendarEntries({ from: "2026-08-17", to: "2026-08-23" });

    expect(rpc).toHaveBeenCalledWith("list_athlete_calendar_entries", {
      p_from: "2026-08-17",
      p_to: "2026-08-23"
    });
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "instance-01", scheduled_date: "2026-08-10" }),
      expect.objectContaining({ day_type: "rest", scheduled_date: "2026-08-18", session_instance_id: null }),
      expect.objectContaining({ day_type: "recovery", scheduled_date: "2026-08-19", session_instance_id: null }),
      expect.objectContaining({ day_type: "assessment", scheduled_date: "2026-08-20", session_instance_id: null }),
      expect.objectContaining({ day_type: "unprogrammed", scheduled_date: "2026-08-21", session_instance_id: null })
    ]));
  });

  it("translates Supabase errors into calendar operation errors", async () => {
    const { client } = createMockClient({ listError: { message: "Sessão não autorizada." } });
    const repository = createCalendarRepository(client);

    await expect(repository.listPublishedSessions({ from: "2026-08-01", to: "2026-08-31" })).rejects.toMatchObject<
      Partial<CalendarBackendError>
    >({
      name: "CalendarBackendError",
      message: "Sessão não autorizada.",
      operation: "listPublishedSessions"
    });
  });
});
