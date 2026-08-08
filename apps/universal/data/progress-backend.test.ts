import type { SupabaseClient } from "@supabase/supabase-js";
import { ProgressBackendError, createProgressRepository, type AthleteProgressRecord } from "@fitblock/backend";

const progressRecord: AthleteProgressRecord = {
  streak_days: 4,
  weekly_history: [{ week_start: "2026-08-03", planned: 4, completed: 3 }],
  session_history: [],
  personal_records: [{ exercise_name: "Back Squat", load_kg: 100, reps: 5, achieved_on: "2026-08-01" }]
};

function createMockClient(options?: { error?: { message: string } }) {
  const client = {
    rpc: jest.fn().mockResolvedValue({
      data: options?.error ? null : progressRecord,
      error: options?.error ?? null
    })
  } as unknown as SupabaseClient;

  return { client, rpc: client.rpc as jest.Mock };
}

describe("progress backend repository", () => {
  it("busca o progresso do atleta com a janela padrão de 8 semanas", async () => {
    const { client, rpc } = createMockClient();
    const repository = createProgressRepository(client);

    await expect(repository.getProgress()).resolves.toEqual(progressRecord);
    expect(rpc).toHaveBeenCalledWith("get_athlete_progress", { p_weeks: 8 });
  });

  it("encaminha uma janela customizada de semanas", async () => {
    const { client, rpc } = createMockClient();
    const repository = createProgressRepository(client);

    await repository.getProgress(12);

    expect(rpc).toHaveBeenCalledWith("get_athlete_progress", { p_weeks: 12 });
  });

  it("traduz falhas do Supabase em erro de operação de progresso", async () => {
    const { client } = createMockClient({ error: { message: "permission denied for function get_athlete_progress" } });
    const repository = createProgressRepository(client);

    await expect(repository.getProgress()).rejects.toMatchObject<Partial<ProgressBackendError>>({
      name: "ProgressBackendError",
      message: "permission denied for function get_athlete_progress",
      operation: "getProgress"
    });
  });
});
