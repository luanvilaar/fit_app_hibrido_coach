import { fireEvent, render, userEvent, waitFor } from "@testing-library/react-native";
import type { SessionWorkoutRecord } from "@fitblock/backend";
import { WorkoutSessionScreen } from "@/components/workout-session-screen";

const mockReplace = jest.fn();
const mockWorkoutRepository = {
  getSessionWorkout: jest.fn(),
  saveSetResult: jest.fn()
};
const mockTodayRepository = {
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

const workout: SessionWorkoutRecord = {
  session: {
    id: "instance-01",
    template_id: "template-01",
    team_id: "team-01",
    scheduled_date: "2026-08-06",
    status: "published",
    state: "available",
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
              exercise_video_url: "https://youtu.be/exemplo",
              prescription: {
                kind: "sets-reps",
                rest_seconds: 150,
                sets: [
                  { set_number: 1, reps: 5, load_type: "percentage-1rm", load_value: 75 },
                  { set_number: 2, reps: 5, load_type: "percentage-1rm", load_value: 75 }
                ]
              }
            }
          ]
        }
      ]
    },
    created_by: "coach-01",
    created_at: "2026-08-05T12:00:00.000Z",
    updated_at: "2026-08-05T12:00:00.000Z"
  },
  progress: null,
  results: []
};

describe("WorkoutSessionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkoutRepository.getSessionWorkout.mockResolvedValue(workout);
    mockWorkoutRepository.saveSetResult.mockResolvedValue({
      id: "result-01",
      session_id: "instance-01",
      athlete_id: "athlete-01",
      block_item_id: "item-01",
      set_number: 1,
      reps: null,
      load_kg: null,
      completed: true
    });
    mockTodayRepository.completeSession.mockResolvedValue({});
  });

  it("carrega o exercício prescrito da sessão com alvo e vídeo", async () => {
    const screen = await render(<WorkoutSessionScreen sessionId="instance-01" />);

    await waitFor(() => expect(screen.getByText("Back Squat")).toBeTruthy());

    expect(mockWorkoutRepository.getSessionWorkout).toHaveBeenCalledWith("instance-01");
    expect(screen.getByText("ALVO")).toBeTruthy();
    expect(screen.getByText("2 × 5 reps · 75% 1RM")).toBeTruthy();
    expect(screen.getByLabelText("Abrir vídeo de Back Squat")).toBeTruthy();
    expect(screen.getByLabelText("Repetições da série 2")).toBeTruthy();
  });

  it("registra o resultado da série no backend ao concluir", async () => {
    const screen = await render(<WorkoutSessionScreen sessionId="instance-01" />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByLabelText("Repetições da série 1")).toBeTruthy());
    await user.type(screen.getByLabelText("Repetições da série 1"), "6 reps");
    await user.type(screen.getByLabelText("Carga em quilogramas da série 1"), "32,5kg");
    await fireEvent.press(screen.getByRole("button", { name: "Concluir série 1" }));

    expect(screen.getByDisplayValue("6")).toBeTruthy();
    expect(screen.getByDisplayValue("32.5")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desfazer conclusão da série 1" })).toBeTruthy();
    expect(screen.getByText("1 de 2 séries concluídas")).toBeTruthy();

    await waitFor(() =>
      expect(mockWorkoutRepository.saveSetResult).toHaveBeenCalledWith({
        sessionId: "instance-01",
        blockItemId: "item-01",
        setNumber: 1,
        reps: 6,
        loadKg: 32.5,
        completed: true
      })
    );
  });

  it("conclui a sessão como parcial quando nem todas as séries foram marcadas", async () => {
    const screen = await render(<WorkoutSessionScreen sessionId="instance-01" />);

    await waitFor(() => expect(screen.getByTestId("finish-workout")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Concluir série 1" }));
    await fireEvent.press(screen.getByTestId("finish-workout"));

    await waitFor(() =>
      expect(mockTodayRepository.completeSession).toHaveBeenCalledWith("instance-01", "partially_completed")
    );
    expect(mockReplace).toHaveBeenCalledWith("/app/hoje");
  });

  it("mostra o bloco de condicionamento como leitura, junto dos exercícios executáveis", async () => {
    mockWorkoutRepository.getSessionWorkout.mockResolvedValue({
      ...workout,
      session: {
        ...workout.session!,
        snapshot: {
          ...(workout.session!.snapshot as Record<string, unknown>),
          blocks: [
            ...(workout.session!.snapshot as { blocks: unknown[] }).blocks,
            {
              id: "block-wod",
              name: "WOD",
              kind: "conditioning",
              details: { description: "AMRAP 12min — 10 thrusters, 8 burpees" },
              items: []
            }
          ]
        }
      }
    });

    const screen = await render(<WorkoutSessionScreen sessionId="instance-01" />);

    await waitFor(() => expect(screen.getByTestId("workout-free-text-blocks")).toBeTruthy());
    expect(screen.getByText("WOD")).toBeTruthy();
    expect(screen.getByText("AMRAP 12min — 10 thrusters, 8 burpees")).toBeTruthy();
    // O exercício de força prescrito continua executável normalmente ao lado do bloco de texto livre.
    expect(screen.getByText("Back Squat")).toBeTruthy();
  });

  it("mostra o bloco de texto livre mesmo quando a sessão não tem nenhum exercício executável", async () => {
    mockWorkoutRepository.getSessionWorkout.mockResolvedValue({
      session: {
        ...workout.session!,
        snapshot: {
          title: "Só WOD",
          blocks: [
            { id: "block-wod", name: "WOD", kind: "conditioning", details: { description: "Fran" }, items: [] }
          ]
        }
      },
      progress: null,
      results: []
    });

    const screen = await render(<WorkoutSessionScreen sessionId="instance-01" />);

    await waitFor(() => expect(screen.getByText("Fran")).toBeTruthy());
    expect(screen.queryByText("Nenhuma sessão publicada para executar agora.")).toBeNull();
  });

  it("informa quando não há sessão publicada para executar", async () => {
    mockWorkoutRepository.getSessionWorkout.mockResolvedValue({
      session: null,
      progress: null,
      results: []
    });

    const screen = await render(<WorkoutSessionScreen />);

    await waitFor(() =>
      expect(screen.getByText("Nenhuma sessão publicada para executar agora.")).toBeTruthy()
    );
  });

  it("mostra exercício qualitativo (Ginástica) sem ALVO nem reps/carga, só um botão único de concluir", async () => {
    mockWorkoutRepository.getSessionWorkout.mockResolvedValue({
      session: {
        ...workout.session!,
        snapshot: {
          title: "Skill day",
          blocks: [
            {
              id: "block-skill",
              name: "Skill",
              kind: "gymnastics-skill",
              items: [
                {
                  id: "item-skill",
                  exercise_name: "CTB Pull Ups",
                  prescription: { kind: "qualitative", notes: "3 tentativas, foco na transição" }
                }
              ]
            }
          ]
        }
      },
      progress: null,
      results: []
    });

    const screen = await render(<WorkoutSessionScreen sessionId="instance-01" />);

    await waitFor(() => expect(screen.getByText("CTB Pull Ups")).toBeTruthy());
    expect(screen.queryByText("ALVO")).toBeNull();
    expect(screen.queryByLabelText("Repetições da série 1")).toBeNull();
    expect(screen.getByText("3 tentativas, foco na transição")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Marcar movimento como concluído" }));

    expect(screen.getByText("Movimento concluído")).toBeTruthy();
    await waitFor(() =>
      expect(mockWorkoutRepository.saveSetResult).toHaveBeenCalledWith({
        sessionId: "instance-01",
        blockItemId: "item-skill",
        setNumber: 1,
        reps: null,
        loadKg: null,
        completed: true
      })
    );
  });

  it("volta para a rota Hoje", async () => {
    const screen = await render(<WorkoutSessionScreen sessionId="instance-01" />);

    await fireEvent.press(screen.getByLabelText("Voltar para Hoje"));

    expect(mockReplace).toHaveBeenCalledWith("/app/hoje");
  });
});
