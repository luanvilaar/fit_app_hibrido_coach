import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TodayBackendError,
  createTodayRepository,
  type AthleteCheckinRecord
} from "@fitblock/backend";

const checkin: AthleteCheckinRecord = {
  id: "checkin-01",
  athlete_id: "athlete-01",
  checkin_date: "2026-08-06",
  sleep_score: 3,
  energy_score: 2,
  muscle_recovery_score: 2,
  stress_score: 4,
  mood_score: 4,
  motivation_score: 3,
  overall_readiness_score: 2,
  pain_region: null,
  pain_intensity: null,
  readiness: 2.86,
  note: ""
};

function createMockClient(options?: { error?: { message: string } }) {
  const client = {
    rpc: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: options?.error ? null : checkin,
        error: options?.error ?? null
      })
    })
  } as unknown as SupabaseClient;

  return { client, rpc: client.rpc as jest.Mock };
}

describe("today backend repository", () => {
  // Os nomes de parâmetro da RPC são strings invisíveis ao TypeScript e a migration é
  // aplicada à mão: um erro de digitação aqui só apareceria contra o banco real.
  it("envia as sete respostas do check-in com os nomes de parâmetro da RPC", async () => {
    const { client, rpc } = createMockClient();
    const repository = createTodayRepository(client);

    await expect(
      repository.saveCheckin({
        sleepScore: 3,
        energyScore: 2,
        muscleRecoveryScore: 2,
        stressScore: 4,
        moodScore: 4,
        motivationScore: 3,
        overallReadinessScore: 2
      })
    ).resolves.toEqual(checkin);

    expect(rpc).toHaveBeenCalledWith("upsert_athlete_checkin", {
      p_sleep_score: 3,
      p_energy_score: 2,
      p_muscle_recovery_score: 2,
      p_stress_score: 4,
      p_mood_score: 4,
      p_motivation_score: 3,
      p_overall_readiness_score: 2,
      p_pain_region: null,
      p_pain_intensity: null,
      p_note: "",
      p_checkin_date: null
    });
  });

  it("encaminha a dor localizada quando o atleta informa região e intensidade", async () => {
    const { client, rpc } = createMockClient();
    const repository = createTodayRepository(client);

    await repository.saveCheckin({
      sleepScore: 4,
      energyScore: 4,
      muscleRecoveryScore: 3,
      stressScore: 4,
      moodScore: 4,
      motivationScore: 4,
      overallReadinessScore: 4,
      painRegion: "joelho",
      painIntensity: 6,
      note: "Incomodou no agachamento."
    });

    expect(rpc).toHaveBeenCalledWith(
      "upsert_athlete_checkin",
      expect.objectContaining({
        p_pain_region: "joelho",
        p_pain_intensity: 6,
        p_note: "Incomodou no agachamento."
      })
    );
  });

  it("traduz falhas do Supabase em erro de operação do check-in", async () => {
    const { client } = createMockClient({ error: { message: "Responda as sete perguntas do check-in." } });
    const repository = createTodayRepository(client);

    await expect(
      repository.saveCheckin({
        sleepScore: 3,
        energyScore: 3,
        muscleRecoveryScore: 3,
        stressScore: 3,
        moodScore: 3,
        motivationScore: 3,
        overallReadinessScore: 3
      })
    ).rejects.toMatchObject<Partial<TodayBackendError>>({
      name: "TodayBackendError",
      message: "Responda as sete perguntas do check-in.",
      operation: "saveCheckin"
    });
  });
});
