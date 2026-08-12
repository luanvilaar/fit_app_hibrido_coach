import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { TodayDashboardRecord } from "@fitblock/backend";
import { TodayScreen } from "@/components/today-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRepository = {
  getToday: jest.fn(),
  startSession: jest.fn(),
  completeSession: jest.fn(),
  toggleBlock: jest.fn()
};

const mockCalendarRepository = {
  listPublishedSessions: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace })
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createTodayRepository: () => mockRepository,
  createCalendarRepository: () => mockCalendarRepository
}));

const dashboard: TodayDashboardRecord = {
  reference_date: "2026-08-06",
  session: {
    id: "instance-01",
    template_id: "template-01",
    team_id: "team-01",
    scheduled_date: "2026-08-06",
    status: "published",
    state: "available",
    coach_note: "Controle o ritmo nas primeiras séries.",
    snapshot: {
      title: "Base forte",
      blocks: [
        {
          id: "11111111-1111-1111-1111-111111111111",
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
  progress: null,
  next_session: null,
  week: { start: "2026-08-03", end: "2026-08-09", planned: 4, completed: 3, position: 2 },
  streak_days: 5,
  checkin: null
};

/** Prontidão 3,4: cai na faixa amarela, entre o verde (>= 4,0) e o vermelho (< 3,0). */
const checkin = {
  id: "checkin-01",
  athlete_id: "athlete-01",
  checkin_date: "2026-08-06",
  sleep_score: 4,
  energy_score: 3,
  muscle_recovery_score: 3,
  stress_score: 3,
  mood_score: 4,
  motivation_score: 4,
  overall_readiness_score: 3,
  pain_region: null,
  pain_intensity: null,
  readiness: 3.43,
  note: ""
};

const progress = {
  id: "progress-01",
  session_id: "instance-01",
  athlete_id: "athlete-01",
  state: "started" as const,
  completed_block_ids: [],
  started_at: "2026-08-06T10:00:00.000Z",
  completed_at: null,
  created_at: "2026-08-06T10:00:00.000Z",
  updated_at: "2026-08-06T10:00:00.000Z"
};

describe("TodayScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.getToday.mockResolvedValue(dashboard);
    mockRepository.startSession.mockResolvedValue(progress);
    mockRepository.toggleBlock.mockResolvedValue({
      ...progress,
      completed_block_ids: ["11111111-1111-1111-1111-111111111111"]
    });
    mockCalendarRepository.listPublishedSessions.mockResolvedValue([]);
  });

  it("mostra a sessão publicada de hoje com dados do backend", async () => {
    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByText("Base forte")).toBeTruthy());

    expect(screen.getByText("SESSÃO DISPONÍVEL")).toBeTruthy();
    expect(screen.getByText("Treino 02 · Semana de 03/08")).toBeTruthy();
    expect(screen.getByText("3 de 4 sessões concluídas")).toBeTruthy();
    expect(screen.getByText("5 treinos de consistência")).toBeTruthy();
    expect(screen.getByText("Controle o ritmo nas primeiras séries.")).toBeTruthy();
  });

  it("inicia a sessão no backend e abre a rota de execução", async () => {
    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByTestId("start-workout")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("start-workout"));

    await waitFor(() => expect(mockRepository.startSession).toHaveBeenCalledWith("instance-01"));
    expect(mockPush).toHaveBeenCalledWith("/app/treino?sessionId=instance-01");
  });

  it("registra a conclusão de um bloco", async () => {
    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByTestId("today-block-0")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("today-block-0"));

    await waitFor(() =>
      expect(mockRepository.toggleBlock).toHaveBeenCalledWith(
        "instance-01",
        "11111111-1111-1111-1111-111111111111"
      )
    );
  });

  it("convida para o check-in quando o dia ainda não tem registro", async () => {
    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByTestId("open-checkin")).toBeTruthy());

    expect(screen.getByText("Check-in do dia pendente")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("open-checkin"));

    expect(mockPush).toHaveBeenCalledWith("/app/prontidao");
  });

  it("exibe a prontidão registrada e permite editá-la", async () => {
    mockRepository.getToday.mockResolvedValue({ ...dashboard, checkin });

    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByText("3,4")).toBeTruthy());

    expect(screen.getByText("Atenção ao volume")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("edit-checkin"));

    expect(mockPush).toHaveBeenCalledWith("/app/prontidao");
  });

  it("destaca a dor localizada informada no check-in", async () => {
    mockRepository.getToday.mockResolvedValue({
      ...dashboard,
      checkin: { ...checkin, pain_region: "joelho" as const, pain_intensity: 6 }
    });

    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByTestId("readiness-pain")).toBeTruthy());
    expect(screen.getByText("Dor: joelho 6/10")).toBeTruthy();
  });

  it("mostra o estado vazio quando não há sessão publicada para o dia", async () => {
    mockRepository.getToday.mockResolvedValue({ ...dashboard, session: null });

    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByTestId("today-empty")).toBeTruthy());
    expect(screen.getByText("SEM SESSÃO HOJE")).toBeTruthy();
  });

  it("comunica a falha do backend sem quebrar a tela", async () => {
    mockRepository.getToday.mockRejectedValue(new Error("permission denied for function get_athlete_today"));

    const screen = await render(<TodayScreen />);

    await waitFor(() => expect(screen.getByTestId("today-error")).toBeTruthy());
    expect(screen.getByText("Você não tem permissão para esta operação.")).toBeTruthy();
  });
});
