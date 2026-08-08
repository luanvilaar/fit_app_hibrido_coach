import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
  ExerciseRecord,
  SessionTemplateContent,
  SessionTemplateRecord,
  SessionTemplateSummary,
  TrainingGroupRecord
} from "@fitblock/backend";
import { CoachLibraryScreen } from "@/components/coach-library-screen";

const mockRepository = {
  listSessionTemplates: jest.fn(),
  listExercises: jest.fn(),
  listCoachTeams: jest.fn(),
  createSessionTemplate: jest.fn(),
  getSessionTemplateContent: jest.fn(),
  updateSessionTemplateContent: jest.fn(),
  deleteSessionTemplate: jest.fn(),
  applySessionToTeam: jest.fn()
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
  slug: "back-squat",
  name: "Back Squat",
  video_url: null,
  category: "forca-acessorios",
  created_by: null,
  created_at: "2026-08-06T14:00:00.000Z"
};

const templateSummary: SessionTemplateSummary = {
  id: "template-01",
  title: "Lower Strength",
  status: "draft",
  created_at: "2026-08-06T12:00:00.000Z",
  updated_at: "2026-08-06T12:00:00.000Z"
};

const templateContent: SessionTemplateContent = {
  template_id: "template-01",
  title: "Lower Strength",
  status: "draft",
  blocks: [
    {
      name: "Força principal",
      kind: "strength",
      items: [
        {
          exercise_name: "Back Squat",
          prescription: { rest_seconds: 150, sets: [{ reps: 5 }] }
        }
      ]
    }
  ]
};

const updatedTemplate: SessionTemplateRecord = {
  id: "template-01",
  title: "Lower Strength",
  status: "published",
  created_by: "coach-01",
  created_at: "2026-08-06T12:00:00.000Z"
};

async function renderScreen() {
  const screen = await render(<CoachLibraryScreen />);
  await waitFor(() => expect(screen.getByTestId("template-template-01")).toBeTruthy());
  return screen;
}

describe("CoachLibraryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.listSessionTemplates.mockResolvedValue([templateSummary]);
    mockRepository.listExercises.mockResolvedValue([catalogExercise]);
    mockRepository.listCoachTeams.mockResolvedValue([team]);
    mockRepository.createSessionTemplate.mockResolvedValue(updatedTemplate);
    mockRepository.getSessionTemplateContent.mockResolvedValue(templateContent);
    mockRepository.updateSessionTemplateContent.mockResolvedValue(updatedTemplate);
    mockRepository.deleteSessionTemplate.mockResolvedValue(undefined);
    mockRepository.applySessionToTeam.mockResolvedValue({});
  });

  it("lista os treinos da biblioteca", async () => {
    const screen = await renderScreen();
    expect(screen.getByText("Lower Strength")).toBeTruthy();
  });

  it("cria um novo treino na biblioteca", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("library-title"), "Upper Strength");
    await fireEvent.changeText(screen.getByTestId("library-exercise-name-0-0"), "Bench Press");
    await fireEvent.press(screen.getByTestId("submit-library-template"));

    await waitFor(() => expect(mockRepository.createSessionTemplate).toHaveBeenCalledTimes(1));
    expect(mockRepository.createSessionTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Upper Strength", status: "draft" })
    );
    await waitFor(() => expect(screen.getByTestId("library-title").props.value).toBe(""));
  });

  it("carrega um treino existente para edição e salva a alteração no próprio template", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("edit-template-template-01"));

    await waitFor(() => expect(screen.getByTestId("library-title").props.value).toBe("Lower Strength"));
    expect(screen.getByTestId("library-exercise-name-0-0").props.value).toBe("Back Squat");

    await fireEvent.press(screen.getByTestId("library-status-published"));
    await fireEvent.press(screen.getByTestId("submit-library-template"));

    await waitFor(() => expect(mockRepository.updateSessionTemplateContent).toHaveBeenCalledTimes(1));
    expect(mockRepository.updateSessionTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-01", status: "published" })
    );
    expect(mockRepository.createSessionTemplate).not.toHaveBeenCalled();
  });

  it("duplica um treino com '(cópia)' no título", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("duplicate-template-template-01"));

    await waitFor(() => expect(mockRepository.createSessionTemplate).toHaveBeenCalledTimes(1));
    expect(mockRepository.createSessionTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Lower Strength (cópia)" })
    );
  });

  it("exige confirmação antes de excluir e traduz erro de chave estrangeira", async () => {
    mockRepository.deleteSessionTemplate.mockRejectedValue(
      new Error(
        'update or delete on table "session_templates" violates foreign key constraint "session_instances_template_id_fkey" on table "session_instances"'
      )
    );
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("request-delete-template-template-01"));
    expect(mockRepository.deleteSessionTemplate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("confirm-modal-button"));

    await waitFor(() => expect(mockRepository.deleteSessionTemplate).toHaveBeenCalledWith("template-01"));
    await waitFor(() =>
      expect(screen.getByText("Não é possível excluir: este item está sendo usado em outro lugar.")).toBeTruthy()
    );
  });

  it("aplica um treino a uma equipe e data", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("request-apply-template-template-01"));
    await fireEvent.press(screen.getByTestId("apply-team-team-01"));
    await fireEvent.changeText(screen.getByTestId("apply-date-input"), "2026-08-20");
    await fireEvent.press(screen.getByTestId("confirm-apply-modal"));

    await waitFor(() => expect(mockRepository.applySessionToTeam).toHaveBeenCalledTimes(1));
    expect(mockRepository.applySessionToTeam).toHaveBeenCalledWith({
      templateId: "template-01",
      teamId: "team-01",
      scheduledDate: "2026-08-20"
    });
  });
});
