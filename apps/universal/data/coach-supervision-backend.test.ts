import type { SupabaseClient } from "@supabase/supabase-js";
import { CoachSupervisionBackendError, createCoachSupervisionRepository } from "../../../packages/backend/src/coach-supervision-repository";

function clientWith(data: unknown, error: { message: string; code?: string } | null = null) {
  return { rpc: jest.fn().mockResolvedValue({ data, error }) } as unknown as SupabaseClient;
}

describe("contrato de acompanhamento", () => {
  it("usa as três RPCs de leitura com os parâmetros de escopo", async () => {
    const client = clientWith([]); const repository = createCoachSupervisionRepository(client);
    await repository.listRoster(); await repository.listAthleteSessions("athlete-1", "2026-08-01", "2026-08-31"); await repository.getAthleteSession("athlete-1", "session-1");
    expect(client.rpc).toHaveBeenNthCalledWith(1, "list_coach_supervision_roster");
    expect(client.rpc).toHaveBeenNthCalledWith(2, "list_coach_supervision_sessions", { p_athlete_id: "athlete-1", p_from: "2026-08-01", p_to: "2026-08-31" });
    expect(client.rpc).toHaveBeenNthCalledWith(3, "get_coach_supervision_session", { p_athlete_id: "athlete-1", p_session_id: "session-1" });
  });

  it("preserva operação e código de erros do Supabase", async () => {
    await expect(createCoachSupervisionRepository(clientWith(null, { message: "função ausente", code: "PGRST202" })).listRoster()).rejects.toMatchObject<Partial<CoachSupervisionBackendError>>({ operation: "listRoster", message: "função ausente", code: "PGRST202" });
  });
});
