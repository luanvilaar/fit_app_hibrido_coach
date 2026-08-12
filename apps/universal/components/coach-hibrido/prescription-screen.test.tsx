import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { CalendarSessionRecord, ExerciseRecord, TrainingGroupRecord } from "@fitblock/backend";
import { PrescriptionScreen } from "@/components/coach-hibrido/prescription-screen";

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
  id: "team-1",
  name: "Strength Base",
  description: "",
  level: "intermediário",
  objective: "Força",
  created_by: "coach-1",
  created_at: "2026-08-01T00:00:00.000Z"
};

const catalog: ExerciseRecord[] = [
  {
    id: "ex-1",
    slug: "front-squat",
    name: "Front Squat",
    video_url: "https://youtu.be/abc",
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-01T00:00:00.000Z"
  }
];

/** Segunda-feira da semana corrente, para a sessão cair sempre na grade visível. */
function mondayOfThisWeek(): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

const scheduledDate = mondayOfThisWeek();

const existingSession = {
  id: "session-1",
  team_id: "team-1",
  scheduled_date: scheduledDate,
  status: "published",
  state: "available",
  coach_note: "",
  snapshot: {
    title: "Segunda pesada",
    blocks: [
      {
        id: "block-1",
        name: "Força & Acessórios",
        kind: "strength",
        details: { schema_version: 3, body: "@Front Squat\n4 x 5" },
        items: [
          {
            id: "item-1",
            exercise_slug: "front-squat",
            exercise_name: "Front Squat",
            prescription: { kind: "reference" }
          }
        ]
      }
    ]
  },
  updated_at: "2026-08-11T00:00:00.000Z"
} as unknown as CalendarSessionRecord;

async function renderScreen() {
  const view = render(<PrescriptionScreen />);
  await waitFor(() => expect(screen.getByTestId("team-team-1")).toBeTruthy());
  return view;
}

describe("PrescriptionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.listCoachTeams.mockResolvedValue([team]);
    mockRepository.listCoachCalendar.mockResolvedValue([existingSession]);
    mockRepository.listExercises.mockResolvedValue(catalog);
    mockRepository.prescribeSession.mockResolvedValue({});
    mockRepository.updateSession.mockResolvedValue({});
    mockRepository.deleteSession.mockResolvedValue(undefined);
  });

  it("carrega equipes, semana e catálogo, selecionando a primeira equipe", async () => {
    await renderScreen();

    expect(mockRepository.listCoachTeams).toHaveBeenCalled();
    expect(mockRepository.listExercises).toHaveBeenCalled();
    expect(screen.getByTestId("team-team-1").props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId("session-session-1")).toBeTruthy();
  });

  it("abre a sessão do quadro no compositor para edição", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("session-session-1"));

    expect(screen.getByTestId("session-title").props.value).toBe("Segunda pesada");
    expect(screen.getByTestId("block-0-body").props.value).toBe("@Front Squat\n4 x 5");
    expect(screen.getByText("Salvar alterações")).toBeTruthy();
  });

  it("publica uma sessão nova com o texto do bloco", async () => {
    await renderScreen();

    fireEvent.changeText(screen.getByTestId("session-title"), "Quarta de metcon");
    fireEvent.changeText(screen.getByTestId("session-date"), "2026-08-12");
    fireEvent.press(screen.getByTestId("add-block-strength"));
    fireEvent.changeText(screen.getByTestId("block-0-body"), "@Front Squat\n4 x 3-5");
    fireEvent.press(screen.getByTestId("session-submit"));

    await waitFor(() => expect(mockRepository.prescribeSession).toHaveBeenCalled());

    const payload = mockRepository.prescribeSession.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Quarta de metcon",
      teamId: "team-1",
      scheduledDate: "2026-08-12",
      status: "published"
    });
    expect(payload.blocks[0].details).toMatchObject({
      schema_version: 3,
      body: "@Front Squat\n4 x 3-5",
      volume: { sets: 4, reps: 16, source: "auto" }
    });
    expect(payload.blocks[0].items).toEqual([
      {
        exerciseSlug: "front-squat",
        exerciseName: "Front Squat",
        exerciseCategory: "forca-acessorios",
        prescription: { kind: "reference" }
      }
    ]);
  });

  it("mostra o erro de validação sem chamar o backend", async () => {
    await renderScreen();

    fireEvent.changeText(screen.getByTestId("session-title"), "Sem bloco");
    fireEvent.press(screen.getByTestId("session-submit"));

    await waitFor(() => expect(screen.getByTestId("prescription-error")).toBeTruthy());
    expect(screen.getByText("A sessão precisa de pelo menos um bloco.")).toBeTruthy();
    expect(mockRepository.prescribeSession).not.toHaveBeenCalled();
  });

  it("recusa bloco sem texto e nomeia o bloco no aviso", async () => {
    await renderScreen();

    fireEvent.changeText(screen.getByTestId("session-title"), "Treino vazio");
    fireEvent.press(screen.getByTestId("add-block-metcon"));
    fireEvent.press(screen.getByTestId("session-submit"));

    await waitFor(() => expect(screen.getByTestId("prescription-error")).toBeTruthy());
    expect(screen.getByText("Bloco 1 · Metcon: escreva o treino deste bloco.")).toBeTruthy();
  });

  it("traduz a falha de permissão do backend", async () => {
    mockRepository.prescribeSession.mockRejectedValue(new Error("new row violates RLS policy"));
    await renderScreen();

    fireEvent.changeText(screen.getByTestId("session-title"), "Treino");
    fireEvent.press(screen.getByTestId("add-block-warm-up"));
    fireEvent.changeText(screen.getByTestId("block-0-body"), "2 rounds leves");
    fireEvent.press(screen.getByTestId("session-submit"));

    await waitFor(() =>
      expect(screen.getByText("Você não tem permissão para esta operação.")).toBeTruthy()
    );
  });

  it("copia uma sessão e cola como rascunho em outro dia", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("copy-session-1"));
    expect(screen.getByTestId("week-clipboard")).toBeTruthy();

    const days = screen.getAllByTestId(/^paste-/);
    fireEvent.press(days[days.length - 1]);

    expect(screen.getByTestId("session-title").props.value).toBe("Segunda pesada (cópia)");
    expect(screen.getByTestId("session-status-draft").props.accessibilityState.selected).toBe(true);
  });

  it("pede confirmação antes de excluir e chama o backend só depois", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("session-session-1"));
    fireEvent.press(screen.getByTestId("session-delete"));

    expect(screen.getByTestId("delete-confirm")).toBeTruthy();
    expect(mockRepository.deleteSession).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("confirm-delete"));
    await waitFor(() => expect(mockRepository.deleteSession).toHaveBeenCalledWith("session-1"));
  });

  it("navega entre semanas recarregando o calendário", async () => {
    await renderScreen();

    const before = mockRepository.listCoachCalendar.mock.calls.length;
    fireEvent.press(screen.getByTestId("week-next"));

    await waitFor(() =>
      expect(mockRepository.listCoachCalendar.mock.calls.length).toBeGreaterThan(before)
    );
  });

  it("explica quando o backend não responde no carregamento", async () => {
    mockRepository.listCoachTeams.mockRejectedValue(new Error("rede indisponível"));
    render(<PrescriptionScreen />);

    await waitFor(() => expect(screen.getByText("rede indisponível")).toBeTruthy());
  });
});
