import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CoachSupervisionScreen, CoachSupervisionSessionScreen } from "@/components/coach/coach-supervision-screen";

const mockPush = jest.fn();
const mockListRoster = jest.fn();
const mockGetAthleteSession = jest.fn();
const mockParams = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockParams()
}));

jest.mock("@/lib/supabase", () => ({ supabase: {}, getSupabaseConfigurationError: () => null }));
jest.mock("@fitblock/backend", () => ({
  createCoachSupervisionRepository: () => ({ listRoster: mockListRoster, getAthleteSession: mockGetAthleteSession }),
  __esModule: true
}));

describe("seletor de acompanhamento", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({});
    mockListRoster.mockResolvedValue([
      { athlete_id: "athlete-1", display_name: "João Álvares", team_id: "team-1", team_name: "Força" },
      { athlete_id: "athlete-2", display_name: "Maria", team_id: "team-1", team_name: "Força" }
    ]);
  });

  it("lista, busca sem acento, alterna equipes e navega sem operações de escrita", async () => {
    const screen = render(<CoachSupervisionScreen />);
    await waitFor(() => expect(screen.getByText("João Álvares")).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText("Buscar atletas e equipes"), "joao");
    expect(screen.getByText("João Álvares")).toBeTruthy();
    expect(screen.queryByText("Maria")).toBeNull();

    fireEvent.press(screen.getByLabelText("Ver Equipes"));
    fireEvent.changeText(screen.getByLabelText("Buscar atletas e equipes"), "");
    expect(screen.getByText("Força")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Abrir equipe Força"));
    expect(mockPush).toHaveBeenCalledWith("/app/coach/acompanhamento/equipes/team-1");
    expect(mockListRoster).toHaveBeenCalledTimes(1);
  });

  it("expõe estado de erro compreensível", async () => {
    mockListRoster.mockRejectedValueOnce(new Error("Acesso negado"));
    const screen = render(<CoachSupervisionScreen />);
    await waitFor(() => expect(screen.getByText("Acesso negado")).toBeTruthy());
    expect(screen.getByLabelText("Tentar carregar acompanhamento novamente")).toBeTruthy();
  });

  it("consulta resultados sem renderizar controles de execução do atleta", async () => {
    mockParams.mockReturnValue({ athleteId: "athlete-1", sessionId: "session-1" });
    mockGetAthleteSession.mockResolvedValue({
      session: {
        id: "session-1", template_id: "template-1", team_id: "team-1", scheduled_date: "2026-08-20", status: "published", state: "available", snapshot: { title: "Força", blocks: [] }, coach_note: "Controle a técnica", created_by: "coach-1", created_at: "2026-08-01", updated_at: "2026-08-01"
      },
      progress: { state: "started", completed_block_ids: [] },
      results: [{ id: "result-1", session_id: "session-1", athlete_id: "athlete-1", block_item_id: "item-1", set_number: 1, reps: 8, load_kg: 40, completed: true }]
    });
    const screen = render(<CoachSupervisionSessionScreen />);
    await waitFor(() => expect(screen.getByText("Resultados registrados")).toBeTruthy());
    expect(screen.getByText("Série 1: 8 reps · 40 kg · concluída")).toBeTruthy();
    expect(screen.queryByText(/Iniciar|Concluir|Salvar|Marcar bloco/i)).toBeNull();
  });
});
