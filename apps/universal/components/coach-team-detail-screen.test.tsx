import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { TeamMemberRecord, TrainingGroupRecord } from "@fitblock/backend";
import { CoachTeamDetailScreen } from "@/components/coach-team-detail-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();

const mockRepository = {
  getTrainingGroup: jest.fn(),
  updateTrainingGroup: jest.fn(),
  listTeamMembers: jest.fn(),
  addTeamMemberByEmail: jest.fn(),
  removeTeamMember: jest.fn(),
  deleteTrainingGroup: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace })
}));

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

const coachMember: TeamMemberRecord = {
  id: "member-coach",
  user_id: "coach-01",
  email: "coach@exemplo.com",
  role: "coach",
  created_at: "2026-08-05T12:00:00.000Z"
};

const athleteMember: TeamMemberRecord = {
  id: "member-athlete",
  user_id: "athlete-01",
  email: "atleta@exemplo.com",
  role: "athlete",
  created_at: "2026-08-05T12:00:00.000Z"
};

async function renderScreen() {
  const screen = await render(<CoachTeamDetailScreen teamId="team-01" />);
  await waitFor(() => expect(screen.getByTestId("member-member-athlete")).toBeTruthy());
  return screen;
}

describe("CoachTeamDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.getTrainingGroup.mockResolvedValue(team);
    mockRepository.listTeamMembers.mockResolvedValue([coachMember, athleteMember]);
    mockRepository.updateTrainingGroup.mockResolvedValue(team);
    mockRepository.addTeamMemberByEmail.mockResolvedValue(athleteMember);
    mockRepository.removeTeamMember.mockResolvedValue(undefined);
    mockRepository.deleteTrainingGroup.mockResolvedValue(undefined);
  });

  it("carrega a equipe e os membros", async () => {
    const screen = await renderScreen();

    expect(screen.getByTestId("team-name").props.value).toBe("Strength Base");
    expect(screen.getByText("coach@exemplo.com")).toBeTruthy();
    expect(screen.getByText("atleta@exemplo.com")).toBeTruthy();
  });

  it("salva alterações da equipe", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("team-name"), "Strength Base 2");
    await fireEvent.press(screen.getByTestId("submit-team"));

    await waitFor(() => expect(mockRepository.updateTrainingGroup).toHaveBeenCalledTimes(1));
    expect(mockRepository.updateTrainingGroup).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: "team-01", name: "Strength Base 2" })
    );
  });

  it("adiciona um membro por e-mail e recarrega a lista", async () => {
    const screen = await renderScreen();

    await fireEvent.changeText(screen.getByTestId("member-invite-email"), "atleta@exemplo.com");
    await fireEvent.press(screen.getByTestId("submit-member-invite"));

    await waitFor(() => expect(mockRepository.addTeamMemberByEmail).toHaveBeenCalledTimes(1));
    expect(mockRepository.addTeamMemberByEmail).toHaveBeenCalledWith({
      teamId: "team-01",
      email: "atleta@exemplo.com",
      role: "athlete"
    });
    expect(mockRepository.listTeamMembers).toHaveBeenCalledTimes(2);
  });

  it("exige confirmação antes de remover um membro", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("request-remove-member-member-athlete"));
    expect(mockRepository.removeTeamMember).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("confirm-remove-member-member-athlete"));
    await waitFor(() => expect(mockRepository.removeTeamMember).toHaveBeenCalledWith("member-athlete"));
  });

  it("mostra mensagem amigável ao tentar remover o último coach", async () => {
    mockRepository.removeTeamMember.mockRejectedValue(new Error("A equipe precisa ter ao menos um coach."));
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("request-remove-member-member-coach"));
    await fireEvent.press(screen.getByTestId("confirm-remove-member-member-coach"));

    await waitFor(() => expect(screen.getByText("A equipe precisa ter ao menos um coach.")).toBeTruthy());
  });

  it("exige confirmação antes de excluir a equipe e navega de volta após excluir", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId("request-delete-team"));
    expect(mockRepository.deleteTrainingGroup).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("confirm-delete-team"));

    await waitFor(() => expect(mockRepository.deleteTrainingGroup).toHaveBeenCalledWith("team-01"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/app/coach/equipes"));
  });
});
