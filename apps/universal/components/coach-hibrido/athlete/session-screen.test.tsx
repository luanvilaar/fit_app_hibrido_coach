import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { CalendarSessionRecord } from "@fitblock/backend";
import { AthleteSessionScreen } from "@/components/coach-hibrido/athlete/session-screen";

const mockReplace = jest.fn();

const mockWorkoutRepository = {
  getSessionWorkout: jest.fn(),
  saveSetResult: jest.fn(),
  submitBlockScore: jest.fn(),
  listBlockLeaderboard: jest.fn()
};

const mockTodayRepository = {
  toggleBlock: jest.fn(),
  completeSession: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace })
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createWorkoutRepository: () => mockWorkoutRepository,
  createTodayRepository: () => mockTodayRepository
}));

const session = {
  id: "session-1",
  team_id: "team-1",
  scheduled_date: "2026-08-12",
  status: "published",
  state: "available",
  coach_note: "Controle o ritmo nas primeiras séries.",
  snapshot: {
    title: "Terça pesada",
    blocks: [
      {
        id: "block-strength",
        name: "Força & Acessórios",
        kind: "strength",
        details: {
          schema_version: 3,
          body: "@Front Squat\n4 x 3-5\ntrabalhe com cargas pesadas.",
          volume: { sets: 4, reps: 16, source: "auto" }
        },
        items: [
          {
            id: "item-front-squat",
            exercise_slug: "front-squat",
            exercise_name: "Front Squat",
            exercise_video_url: "https://youtu.be/abc",
            prescription: { kind: "reference" }
          }
        ]
      },
      {
        id: "block-metcon",
        name: "Metcon",
        kind: "metcon",
        details: {
          schema_version: 3,
          body: "21-15-9\nThruster\nPull Up",
          protocol: { type: "for-time", time_cap_minutes: 12 },
          ranking: { enabled: true, score_type: "time" }
        },
        items: []
      }
    ]
  },
  updated_at: "2026-08-11T10:00:00.000Z"
} as unknown as CalendarSessionRecord;

const progress = {
  id: "progress-1",
  session_id: "session-1",
  athlete_id: "athlete-1",
  state: "started",
  completed_block_ids: [],
  started_at: "2026-08-12T10:00:00.000Z",
  completed_at: null,
  created_at: "2026-08-12T10:00:00.000Z",
  updated_at: "2026-08-12T10:00:00.000Z"
};

async function renderScreen() {
  const view = render(<AthleteSessionScreen sessionId="session-1" />);
  await waitFor(() => expect(screen.getByTestId("athlete-block-block-strength")).toBeTruthy());
  return view;
}

describe("AthleteSessionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkoutRepository.getSessionWorkout.mockResolvedValue({ session, progress, results: [] });
    mockWorkoutRepository.listBlockLeaderboard.mockResolvedValue([]);
    mockWorkoutRepository.saveSetResult.mockResolvedValue({});
    mockWorkoutRepository.submitBlockScore.mockResolvedValue({});
    mockTodayRepository.toggleBlock.mockResolvedValue({ ...progress, completed_block_ids: ["block-strength"] });
    mockTodayRepository.completeSession.mockResolvedValue({ ...progress, state: "completed" });
  });

  it("mostra o título, o recado do coach e o progresso de blocos", async () => {
    await renderScreen();

    expect(screen.getByText("Terça pesada")).toBeTruthy();
    expect(screen.getByTestId("session-coach-note")).toBeTruthy();
    expect(screen.getByTestId("session-progress")).toHaveTextContent("0 de 2 blocos");
    expect(screen.getByTestId("athlete-block-state-block-strength")).toHaveTextContent(
      "EM EXECUÇÃO · BLOCO 1 DE 2"
    );
  });

  it("mostra o texto do treino como o coach escreveu", async () => {
    await renderScreen();

    expect(screen.getByText("4 x 3-5")).toBeTruthy();
    expect(screen.getByText("trabalhe com cargas pesadas.")).toBeTruthy();
  });

  it("transforma a menção em link de vídeo do movimento", async () => {
    await renderScreen();

    expect(screen.getByTestId("movement-front-squat")).toBeTruthy();
  });

  it("mostra o protocolo e o volume que o coach definiu", async () => {
    await renderScreen();

    expect(screen.getByTestId("athlete-block-meta-block-strength")).toHaveTextContent("4 séries · 16 reps");
    expect(screen.getByTestId("athlete-block-meta-block-metcon")).toHaveTextContent("For time · limite 12 min");
  });

  it("marca o bloco como concluído e atualiza o progresso", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("athlete-block-done-block-strength"));

    await waitFor(() =>
      expect(mockTodayRepository.toggleBlock).toHaveBeenCalledWith("session-1", "block-strength")
    );
    await waitFor(() => expect(screen.getByTestId("session-progress")).toHaveTextContent("1 de 2 blocos"));
    expect(screen.getByText("Bloco concluído.")).toBeTruthy();
    expect(screen.getByTestId("athlete-block-next-block-strength")).toHaveTextContent("Abrir próximo: Metcon");

    fireEvent.press(screen.getByTestId("athlete-block-next-block-strength"));

    expect(screen.getByTestId("athlete-block-state-block-metcon")).toHaveTextContent("EM EXECUÇÃO · BLOCO 2 DE 2");
  });

  it("registra a carga usada por movimento no bloco de força", async () => {
    await renderScreen();

    fireEvent.changeText(screen.getByTestId("log-load-item-front-squat"), "80");
    fireEvent(screen.getByTestId("log-load-item-front-squat"), "blur");

    await waitFor(() =>
      expect(mockWorkoutRepository.saveSetResult).toHaveBeenCalledWith({
        sessionId: "session-1",
        blockItemId: "item-front-squat",
        setNumber: 1,
        reps: null,
        loadKg: 80,
        completed: true
      })
    );
    await waitFor(() => expect(screen.getByText("Carga salva")).toBeTruthy());
  });

  it("mostra uma recuperação local quando não consegue salvar a carga", async () => {
    mockWorkoutRepository.saveSetResult.mockRejectedValueOnce(new Error("rede indisponível"));
    await renderScreen();

    fireEvent.changeText(screen.getByTestId("log-load-item-front-squat"), "80");
    fireEvent(screen.getByTestId("log-load-item-front-squat"), "blur");

    await waitFor(() => expect(screen.getByText("Não foi possível salvar a carga.")).toBeTruthy());
    expect(screen.getByLabelText("Tentar salvar carga de Front Squat novamente")).toBeTruthy();
  });

  it("não oferece registro de carga em bloco sem esse controle", async () => {
    await renderScreen();

    expect(screen.queryByTestId("athlete-log-block-metcon")).toBeNull();
  });

  it("envia o tempo no bloco pontuado e recarrega o ranking", async () => {
    mockWorkoutRepository.listBlockLeaderboard.mockResolvedValue([
      {
        id: "score-1",
        session_id: "session-1",
        block_id: "block-metcon",
        athlete_id: "athlete-1",
        score_type: "time",
        time_seconds: 760,
        rounds: null,
        reps: null,
        load_kg: null,
        submitted_at: "2026-08-12T11:00:00.000Z",
        rank: 1,
        display_name: "Luan"
      }
    ]);
    await renderScreen();

    fireEvent.press(screen.getByTestId("athlete-block-header-block-metcon"));
    fireEvent.press(screen.getByTestId("athlete-block-action-results-block-metcon"));

    expect(screen.getByText(/Registrar resultado/)).toBeTruthy();
    expect(screen.getByText("Ranking da equipe")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("score-block-metcon-minutes"), "12");
    fireEvent.changeText(screen.getByTestId("score-block-metcon-seconds"), "40");
    fireEvent.press(screen.getByTestId("score-block-metcon-submit"));

    await waitFor(() =>
      expect(mockWorkoutRepository.submitBlockScore).toHaveBeenCalledWith({
        sessionId: "session-1",
        blockId: "block-metcon",
        scoreType: "time",
        timeSeconds: 760
      })
    );
    await waitFor(() => expect(screen.getByTestId("leaderboard-block-metcon")).toBeTruthy());
    expect(screen.getByText("12:40")).toBeTruthy();
  });

  it("recusa o envio sem tempo e explica o que falta", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("athlete-block-header-block-metcon"));
    fireEvent.press(screen.getByTestId("athlete-block-action-results-block-metcon"));

    fireEvent.press(screen.getByTestId("score-block-metcon-submit"));

    expect(screen.getByTestId("score-block-metcon-error")).toHaveTextContent(
      "Informe o tempo que você levou."
    );
    expect(mockWorkoutRepository.submitBlockScore).not.toHaveBeenCalled();
  });

  it("não deixa finalizar sem nenhum bloco concluído", async () => {
    await renderScreen();

    expect(screen.getByTestId("finish-session").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Conclua ao menos um bloco para finalizar a sessão.")).toBeTruthy();
  });

  it("finaliza como parcial quando só parte dos blocos foi concluída", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("athlete-block-done-block-strength"));
    await waitFor(() => expect(screen.getByTestId("session-progress")).toHaveTextContent("1 de 2 blocos"));

    fireEvent.press(screen.getByTestId("finish-session"));

    await waitFor(() =>
      expect(mockTodayRepository.completeSession).toHaveBeenCalledWith("session-1", "partially_completed")
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/app/hoje"));
  });

  it("explica quando não há sessão publicada", async () => {
    mockWorkoutRepository.getSessionWorkout.mockResolvedValue({ session: null, progress: null, results: [] });
    render(<AthleteSessionScreen sessionId={null} />);

    await waitFor(() => expect(screen.getByTestId("session-empty")).toBeTruthy());
  });

  it("anuncia a falha de carregamento sem quebrar a tela", async () => {
    mockWorkoutRepository.getSessionWorkout.mockRejectedValue(new Error("rede indisponível"));
    render(<AthleteSessionScreen sessionId="session-1" />);

    await waitFor(() => expect(screen.getByTestId("session-error")).toBeTruthy());
  });
});
