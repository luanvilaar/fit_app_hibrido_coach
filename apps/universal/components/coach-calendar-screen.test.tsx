import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { CalendarSessionRecord, ExerciseRecord, TrainingGroupRecord } from "@fitblock/backend";
import { CoachCalendarScreen } from "@/components/coach-calendar-screen";

const mockRepository = {
  listCoachTeams: jest.fn(),
  listCoachCalendar: jest.fn(),
  listExercises: jest.fn(),
  prescribeSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn()
};

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createCoachFlowRepository: () => mockRepository
}));

const team: TrainingGroupRecord = {
  id: "team-01",
  name: "Strength Base",
  description: "Equipe de força.",
  level: "intermediário",
  objective: "Aumentar força.",
  created_by: "coach-01",
  created_at: "2026-08-05T12:00:00.000Z"
};

const catalogExercise: ExerciseRecord = {
  id: "exercise-01",
  slug: "power-snatch",
  name: "Power Snatch",
  video_url: "https://youtu.be/exemplo",
  category: "forca-lpo",
  created_by: null,
  created_at: "2026-08-06T14:00:00.000Z"
};

const session: CalendarSessionRecord = {
  id: "instance-01",
  template_id: "template-01",
  team_id: "team-01",
  scheduled_date: "2026-08-12",
  status: "published",
  state: "available",
  coach_note: "",
  created_by: "coach-01",
  created_at: "2026-08-06T12:00:00.000Z",
  updated_at: "2026-08-06T12:00:00.000Z",
  snapshot: {
    title: "Upper Strength",
    blocks: [
      {
        name: "Força principal",
        kind: "strength",
        items: [
          {
            exercise_name: "Power Snatch",
            prescription: { kind: "sets-reps", rest_seconds: 180, sets: [{ reps: 3 }] }
          }
        ]
      }
    ]
  }
};

async function renderScreen() {
  const screen = await render(<CoachCalendarScreen />);
  await waitFor(() => expect(screen.getByTestId("session-list-instance-01")).toBeTruthy());
  return screen;
}

describe("CoachCalendarScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.listCoachTeams.mockResolvedValue([team]);
    mockRepository.listCoachCalendar.mockResolvedValue([session]);
    mockRepository.listExercises.mockResolvedValue([catalogExercise]);
    mockRepository.prescribeSession.mockResolvedValue(session);
    mockRepository.updateSession.mockResolvedValue(session);
    mockRepository.deleteSession.mockResolvedValue(undefined);
  });

  it("publica uma nova sessão e volta o formulário ao estado inicial", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("session-title"), "Lower Strength");
    await fireEvent.changeText(screen.getByTestId("session-date"), "2026-08-14");
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() => expect(mockRepository.prescribeSession).toHaveBeenCalledTimes(1));
    expect(mockRepository.prescribeSession).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: "team-01", title: "Lower Strength", scheduledDate: "2026-08-14", status: "published" })
    );

    await waitFor(() => expect(screen.getByTestId("coach-success-message")).toBeTruthy());
    expect(screen.getByTestId("session-title").props.value).toBe("");
    expect(mockRepository.updateSession).not.toHaveBeenCalled();
  });

  it("salva rascunho quando o coach escolhe essa visibilidade", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("session-title"), "Teste de rascunho");
    await fireEvent.press(screen.getByTestId("status-draft"));
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() => expect(mockRepository.prescribeSession).toHaveBeenCalledTimes(1));
    expect(mockRepository.prescribeSession).toHaveBeenCalledWith(expect.objectContaining({ status: "draft" }));
  });

  it("abre a sessão do calendário em modo edição e salva as alterações", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("session-list-instance-01"));

    expect(screen.getByTestId("session-title").props.value).toBe("Upper Strength");
    expect(screen.getByTestId("session-date").props.value).toBe("2026-08-12");
    expect(screen.getByTestId("exercise-name-0-0").props.value).toBe("Power Snatch");

    await fireEvent.changeText(screen.getByTestId("set-reps-0-0-0"), "5");
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() => expect(mockRepository.updateSession).toHaveBeenCalledTimes(1));
    expect(mockRepository.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "instance-01", title: "Upper Strength", scheduledDate: "2026-08-12" })
    );
    expect(mockRepository.prescribeSession).not.toHaveBeenCalled();

    await waitFor(() => expect(screen.getByTestId("session-title").props.value).toBe(""));
  });

  it("exige confirmação antes de excluir a sessão", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("session-list-instance-01"));
    await fireEvent.press(screen.getByTestId("request-delete"));

    expect(screen.getByTestId("delete-confirmation")).toBeTruthy();
    expect(mockRepository.deleteSession).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("dismiss-delete"));
    expect(screen.queryByTestId("delete-confirmation")).toBeNull();

    await fireEvent.press(screen.getByTestId("request-delete"));
    await fireEvent.press(screen.getByTestId("confirm-delete"));

    await waitFor(() => expect(mockRepository.deleteSession).toHaveBeenCalledWith("instance-01"));
    await waitFor(() => expect(screen.queryByTestId("request-delete")).toBeNull());
  });

  it("monta blocos e exercícios adicionais no editor", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("add-block"));
    await fireEvent.press(screen.getByTestId("add-item-0"));
    await fireEvent.press(screen.getByTestId("add-set-0-0"));

    expect(screen.getByTestId("block-1")).toBeTruthy();
    expect(screen.getByTestId("item-0-1")).toBeTruthy();
    expect(screen.getByTestId("set-0-0-3")).toBeTruthy();
  });

  it("traduz a falha do backend e mantém o formulário preenchido", async () => {
    mockRepository.prescribeSession.mockRejectedValue(
      new Error("permission denied for function create_and_apply_session_to_team")
    );
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("session-title"), "Lower Strength");
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() =>
      expect(screen.getByText("Você não tem permissão para esta operação.")).toBeTruthy()
    );
    expect(screen.getByTestId("session-title").props.value).toBe("Lower Strength");
  });

  it("sugere exercícios já cadastrados ao digitar e preenche o nome exato ao selecionar", async () => {
    const screen = await renderScreen();
    const field = screen.getByTestId("exercise-name-0-0");

    await fireEvent(field, "focus");
    await fireEvent.changeText(field, "Pow");

    await waitFor(() =>
      expect(screen.getByTestId("exercise-name-0-0-suggestion-power-snatch")).toBeTruthy()
    );

    await fireEvent.press(screen.getByTestId("exercise-name-0-0-suggestion-power-snatch"));

    expect(screen.getByTestId("exercise-name-0-0").props.value).toBe("Power Snatch");
  });

  it("não sugere nada quando o texto digitado já bate exatamente com um exercício cadastrado", async () => {
    const screen = await renderScreen();
    const field = screen.getByTestId("exercise-name-0-0");

    await fireEvent(field, "focus");
    await fireEvent.changeText(field, "Power Snatch");

    expect(screen.queryByTestId("exercise-name-0-0-suggestion-power-snatch")).toBeNull();
  });

  it("bloqueia o envio com validação local antes de chamar o backend", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("session-title"), "Lower Strength");
    await fireEvent.changeText(screen.getByTestId("exercise-name-0-0"), "");
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() =>
      expect(screen.getByText("Bloco 1 · exercício 1: exercício é obrigatório.")).toBeTruthy()
    );
    expect(mockRepository.prescribeSession).not.toHaveBeenCalled();
  });

  it("troca a categoria do bloco para Condicionamento e envia descrição com ranking ativado", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("session-title"), "Lower Strength");

    await fireEvent.press(screen.getByTestId("block-kind-0"));
    await fireEvent.press(screen.getByTestId("block-kind-0-conditioning"));

    expect(screen.queryByTestId("exercise-name-0-0")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("block-description-0"), "AMRAP 12min — 10 thrusters, 8 burpees");
    await fireEvent.press(screen.getByTestId("block-ranking-0"));
    await fireEvent.press(screen.getByTestId("block-score-type-0-reps"));
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() => expect(mockRepository.prescribeSession).toHaveBeenCalledTimes(1));
    expect(mockRepository.prescribeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            kind: "conditioning",
            details: {
              description: "AMRAP 12min — 10 thrusters, 8 burpees",
              ranking: { enabled: true, score_type: "reps" }
            },
            items: []
          })
        ]
      })
    );
  });

  it("monta bloco de Endurance só com as modalidades ativadas pelo coach", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("session-title"), "Lower Strength");

    await fireEvent.press(screen.getByTestId("block-kind-0"));
    await fireEvent.press(screen.getByTestId("block-kind-0-endurance"));
    await fireEvent.changeText(screen.getByTestId("block-description-0"), "Ritmo confortável");

    // Sem nenhuma modalidade ativada, o envio é bloqueado localmente.
    await fireEvent.press(screen.getByTestId("submit-session"));
    await waitFor(() =>
      expect(screen.getByText("Bloco 1: escolha pelo menos uma modalidade de endurance.")).toBeTruthy()
    );
    expect(mockRepository.prescribeSession).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("block-volume-0-run"));
    await fireEvent.changeText(screen.getByTestId("block-volume-value-0-run"), "5");
    await fireEvent.press(screen.getByTestId("block-volume-unit-0-run-km"));
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() => expect(mockRepository.prescribeSession).toHaveBeenCalledTimes(1));
    expect(mockRepository.prescribeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            kind: "endurance",
            details: { description: "Ritmo confortável", volumes: [{ modality: "run", value: 5, unit: "km" }] },
            items: []
          })
        ]
      })
    );
  });

  it("monta bloco de LPO com séries prescritas no próprio bloco", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("session-title"), "Lower Strength");

    await fireEvent.press(screen.getByTestId("block-kind-0"));
    await fireEvent.press(screen.getByTestId("block-kind-0-lpo"));
    await fireEvent.changeText(screen.getByTestId("block-description-0"), "Snatch técnico");
    await fireEvent.changeText(screen.getByTestId("block-set-reps-0-0"), "2");
    await fireEvent.changeText(screen.getByTestId("block-set-load-0-0"), "80");

    // Adicionar série repete a última: já nasce com reps "2" e carga "80".
    await fireEvent.press(screen.getByTestId("add-block-set-0"));
    await fireEvent.press(screen.getByTestId("submit-session"));

    await waitFor(() => expect(mockRepository.prescribeSession).toHaveBeenCalledTimes(1));
    expect(mockRepository.prescribeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            kind: "lpo",
            items: [],
            details: {
              description: "Snatch técnico",
              sets: [
                { set_number: 1, reps: 2, load_type: "percentage-1rm", load_value: 80 },
                { set_number: 2, reps: 2, load_type: "percentage-1rm", load_value: 80 }
              ]
            }
          })
        ]
      })
    );
  });
});
