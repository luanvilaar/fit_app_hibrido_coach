import { render, waitFor } from "@testing-library/react-native";
import type { AthleteProgressRecord } from "@fitblock/backend";
import { ProgressScreen } from "@/components/progress-screen";

const mockRepository = {
  getProgress: jest.fn()
};

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createProgressRepository: () => mockRepository
}));

const progress: AthleteProgressRecord = {
  streak_days: 6,
  weekly_history: [
    { week_start: "2026-07-13", planned: 3, completed: 3 },
    { week_start: "2026-07-20", planned: 4, completed: 2 },
    { week_start: "2026-07-27", planned: 4, completed: 0 },
    { week_start: "2026-08-03", planned: 4, completed: 3 }
  ],
  session_history: [
    {
      session: {
        id: "instance-01",
        template_id: "template-01",
        team_id: "team-01",
        scheduled_date: "2026-08-06",
        status: "published",
        state: "completed",
        coach_note: "",
        snapshot: {
          title: "Base forte",
          blocks: [
            {
              id: "block-01",
              name: "Força principal",
              kind: "strength",
              items: [
                {
                  id: "item-01",
                  exercise_name: "Back Squat",
                  prescription: { kind: "sets-reps", rest_seconds: 120, sets: [{ set_number: 1, reps: 5 }] }
                }
              ]
            }
          ]
        },
        created_by: "coach-01",
        created_at: "2026-08-05T12:00:00.000Z",
        updated_at: "2026-08-06T10:32:00.000Z"
      },
      progress: {
        id: "progress-01",
        session_id: "instance-01",
        athlete_id: "athlete-01",
        state: "completed",
        completed_block_ids: ["block-01"],
        started_at: "2026-08-06T10:00:00.000Z",
        completed_at: "2026-08-06T10:45:00.000Z",
        created_at: "2026-08-06T10:00:00.000Z",
        updated_at: "2026-08-06T10:45:00.000Z"
      }
    }
  ],
  personal_records: [
    { exercise_name: "Back Squat", load_kg: 100, reps: 5, achieved_on: "2026-08-01" },
    { exercise_name: "Deadlift", load_kg: 140, reps: 3, achieved_on: "2026-07-20" }
  ]
};

describe("ProgressScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.getProgress.mockResolvedValue(progress);
  });

  it("mostra a sequência, os recordes e o histórico vindos do backend", async () => {
    const screen = await render(<ProgressScreen />);

    await waitFor(() => expect(screen.getByText("6")).toBeTruthy());

    expect(screen.getByText("6 dias de consistência")).toBeTruthy();
    expect(screen.getByText("100 kg")).toBeTruthy();
    expect(screen.getByText("140 kg")).toBeTruthy();
    expect(screen.getByText("Base forte")).toBeTruthy();
    expect(screen.getByText("Concluído")).toBeTruthy();
  });

  it("mostra estado vazio de recordes quando não há cargas registradas", async () => {
    mockRepository.getProgress.mockResolvedValue({ ...progress, personal_records: [] });

    const screen = await render(<ProgressScreen />);

    await waitFor(() =>
      expect(screen.getByText("Registre cargas nos seus treinos para ver recordes aqui.")).toBeTruthy()
    );
  });

  it("mostra estado vazio de histórico quando não há sessões concluídas", async () => {
    mockRepository.getProgress.mockResolvedValue({ ...progress, session_history: [] });

    const screen = await render(<ProgressScreen />);

    await waitFor(() =>
      expect(screen.getByText("Conclua um treino para começar seu histórico.")).toBeTruthy()
    );
  });

  it("comunica a falha do backend sem quebrar a tela", async () => {
    mockRepository.getProgress.mockRejectedValue(new Error("permission denied for function get_athlete_progress"));

    const screen = await render(<ProgressScreen />);

    await waitFor(() => expect(screen.getByTestId("progress-error")).toBeTruthy());
    expect(screen.getByText("Você não tem permissão para esta operação.")).toBeTruthy();
  });
});
