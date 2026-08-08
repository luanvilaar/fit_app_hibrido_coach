import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { AthleteCheckinRecord, TodayDashboardRecord } from "@fitblock/backend";
import { ReadinessCheckinScreen } from "@/components/readiness-checkin-screen";

const mockReplace = jest.fn();
const mockRepository = {
  getToday: jest.fn(),
  saveCheckin: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() })
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createTodayRepository: () => mockRepository
}));

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

const dashboard = {
  reference_date: "2026-08-06",
  session: null,
  progress: null,
  next_session: null,
  week: { start: "2026-08-03", end: "2026-08-09", planned: 4, completed: 3, position: 2 },
  streak_days: 5,
  checkin: null
} as unknown as TodayDashboardRecord;

const questionSlugs = ["sono", "energia", "recuperacao", "estresse", "humor", "motivacao", "prontidao"];

/** Responde as sete perguntas em sequência, aguardando o avanço animado entre cada uma. */
async function answerAllStepByStep(screen: Awaited<ReturnType<typeof render>>, score: number) {
  for (const slug of questionSlugs) {
    await waitFor(() => expect(screen.getByTestId(`checkin-${slug}-${score}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`checkin-${slug}-${score}`));
  }
  await waitFor(() => expect(screen.getByTestId("save-checkin")).toBeTruthy());
}

describe("ReadinessCheckinScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.getToday.mockResolvedValue(dashboard);
    mockRepository.saveCheckin.mockResolvedValue(checkin);
  });

  it("mostra uma pergunta por vez e só libera o botão salvar após a sétima resposta", async () => {
    const screen = await render(<ReadinessCheckinScreen />);

    await waitFor(() => expect(screen.getByTestId("checkin-sono-4")).toBeTruthy());
    expect(screen.queryByTestId("checkin-energia-4")).toBeNull();
    expect(screen.queryByTestId("save-checkin")).toBeNull();

    for (const slug of questionSlugs.slice(0, -1)) {
      await waitFor(() => expect(screen.getByTestId(`checkin-${slug}-4`)).toBeTruthy());
      await fireEvent.press(screen.getByTestId(`checkin-${slug}-4`));
    }

    await waitFor(() => expect(screen.getByTestId("checkin-prontidao-4")).toBeTruthy());
    expect(screen.queryByTestId("save-checkin")).toBeNull();

    await fireEvent.press(screen.getByTestId("checkin-prontidao-4"));

    await waitFor(() => expect(screen.getByTestId("save-checkin")).toBeTruthy());
    expect(screen.getByTestId("save-checkin").props.accessibilityState.disabled).toBe(false);
  });

  it("mostra o progresso da pergunta e permite voltar preservando a resposta", async () => {
    const screen = await render(<ReadinessCheckinScreen />);

    await waitFor(() => expect(screen.getByText("Pergunta 1 de 7")).toBeTruthy());
    expect(screen.queryByTestId("checkin-step-back")).toBeNull();

    await fireEvent.press(screen.getByTestId("checkin-sono-4"));

    await waitFor(() => expect(screen.getByText("Pergunta 2 de 7")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("checkin-step-back"));

    await waitFor(() => expect(screen.getByText("Pergunta 1 de 7")).toBeTruthy());
    expect(screen.getByTestId("checkin-sono-4").props.accessibilityState.selected).toBe(true);
  });

  it("salva as sete respostas e volta para a Hoje", async () => {
    const screen = await render(<ReadinessCheckinScreen />);

    await answerAllStepByStep(screen, 4);

    expect(screen.getByText("Sua prontidão hoje: 4,0 / 5")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("save-checkin"));

    await waitFor(() =>
      expect(mockRepository.saveCheckin).toHaveBeenCalledWith({
        sleepScore: 4,
        energyScore: 4,
        muscleRecoveryScore: 4,
        stressScore: 4,
        moodScore: 4,
        motivationScore: 4,
        overallReadinessScore: 4,
        painRegion: null,
        painIntensity: null,
        note: ""
      })
    );
    expect(mockReplace).toHaveBeenCalledWith("/app/hoje");
  });

  it("envia a dor localizada quando o atleta informa região e intensidade", async () => {
    const screen = await render(<ReadinessCheckinScreen />);

    await answerAllStepByStep(screen, 4);

    await fireEvent.press(screen.getByTestId("pain-toggle"));
    await fireEvent.press(screen.getByTestId("pain-region-joelho"));
    await fireEvent.press(screen.getByTestId("pain-intensity-6"));
    await fireEvent.press(screen.getByTestId("save-checkin"));

    await waitFor(() =>
      expect(mockRepository.saveCheckin).toHaveBeenCalledWith(
        expect.objectContaining({ painRegion: "joelho", painIntensity: 6 })
      )
    );
  });

  it("pré-preenche o check-in já registrado no dia", async () => {
    mockRepository.getToday.mockResolvedValue({ ...dashboard, checkin });

    const screen = await render(<ReadinessCheckinScreen />);

    await waitFor(() => expect(screen.getByTestId("checkin-sono-3").props.accessibilityState.selected).toBe(true));

    const prefilledScores: Record<string, number> = {
      sono: 3,
      energia: 2,
      recuperacao: 2,
      estresse: 4,
      humor: 4,
      motivacao: 3,
      prontidao: 2
    };

    for (const slug of questionSlugs) {
      const testId = `checkin-${slug}-${prefilledScores[slug]}`;
      await waitFor(() => expect(screen.getByTestId(testId)).toBeTruthy());
      expect(screen.getByTestId(testId).props.accessibilityState.selected).toBe(true);
      await fireEvent.press(screen.getByTestId(testId));
    }

    await waitFor(() => expect(screen.getByTestId("save-checkin")).toBeTruthy());
    expect(screen.getByTestId("save-checkin").props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText("Sua prontidão hoje: 2,9 / 5")).toBeTruthy();
  });

  it("comunica a falha do backend sem quebrar a tela", async () => {
    mockRepository.saveCheckin.mockRejectedValue(new Error("Responda as sete perguntas do check-in."));

    const screen = await render(<ReadinessCheckinScreen />);

    await answerAllStepByStep(screen, 3);
    await fireEvent.press(screen.getByTestId("save-checkin"));

    await waitFor(() => expect(screen.getByTestId("checkin-error")).toBeTruthy());
    expect(screen.getByText("Responda as sete perguntas do check-in.")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
