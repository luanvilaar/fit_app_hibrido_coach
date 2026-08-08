import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { TrainingGroupRecord, TrainingGroupSummary } from "@fitblock/backend";
import { CoachTeamsScreen } from "@/components/coach-teams-screen";

const mockPush = jest.fn();

const mockRepository = {
  listCoachTeamsWithMemberCounts: jest.fn(),
  createTrainingGroup: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush })
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createCoachFlowRepository: () => mockRepository
}));

const team: TrainingGroupSummary = {
  id: "team-01",
  name: "Strength Base",
  description: "Equipe de força.",
  level: "intermediário",
  objective: "Aumentar força.",
  created_by: "coach-01",
  created_at: "2026-08-05T12:00:00.000Z",
  coach_count: 1,
  athlete_count: 3
};

const createdTeam: TrainingGroupRecord = {
  id: "team-02",
  name: "Power Squad",
  description: "",
  level: "iniciante",
  objective: "Ganhar potência.",
  created_by: "coach-01",
  created_at: "2026-08-06T12:00:00.000Z"
};

async function renderScreen() {
  const screen = await render(<CoachTeamsScreen />);
  await waitFor(() => expect(screen.getByTestId("team-card-team-01")).toBeTruthy());
  return screen;
}

describe("CoachTeamsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.listCoachTeamsWithMemberCounts.mockResolvedValue([team]);
    mockRepository.createTrainingGroup.mockResolvedValue(createdTeam);
  });

  it("lista as equipes do coach com a contagem de membros", async () => {
    const screen = await renderScreen();

    expect(screen.getByText("1 coach · 3 atletas")).toBeTruthy();
  });

  it("navega para o detalhe ao abrir uma equipe", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("team-card-team-01"));

    expect(mockPush).toHaveBeenCalledWith("/app/coach/equipes/team-01");
  });

  it("cria uma equipe e limpa o formulário", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("team-name"), "Power Squad");
    await fireEvent.press(screen.getByTestId("team-level-iniciante"));
    await fireEvent.changeText(screen.getByTestId("team-objective"), "Ganhar potência.");
    await fireEvent.press(screen.getByTestId("submit-team"));

    await waitFor(() => expect(mockRepository.createTrainingGroup).toHaveBeenCalledTimes(1));
    expect(mockRepository.createTrainingGroup).toHaveBeenCalledWith({
      name: "Power Squad",
      description: "",
      level: "iniciante",
      objective: "Ganhar potência."
    });
    await waitFor(() => expect(screen.getByTestId("team-name").props.value).toBe(""));
  });

  it("bloqueia a criação sem nome e mostra o erro de validação", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("submit-team"));

    await waitFor(() => expect(screen.getByText("Nome da equipe é obrigatório.")).toBeTruthy());
    expect(mockRepository.createTrainingGroup).not.toHaveBeenCalled();
  });
});
