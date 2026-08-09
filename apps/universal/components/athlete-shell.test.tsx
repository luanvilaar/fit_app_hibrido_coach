import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { AthleteShell, getVisibleNavigationItems } from "@/components/athlete-shell";
import { emptyUserRoles, type UserRoles } from "@/auth/roles";

const mockUseUserRoles = jest.fn();

jest.mock("expo-router", () => ({
  usePathname: () => "/app/hoje",
  useRouter: () => ({ push: jest.fn() })
}));

jest.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: { email: "atleta@fitblock.com" }, signOut: jest.fn() })
}));

jest.mock("@/auth/roles-provider", () => ({
  useUserRoles: () => mockUseUserRoles()
}));

const coachRoles: UserRoles = {
  userId: "coach-01",
  roles: ["coach", "athlete"],
  coachTeamIds: ["team-01"],
  athleteTeamIds: ["team-01"]
};

const athleteRoles: UserRoles = {
  userId: "athlete-01",
  roles: ["athlete"],
  coachTeamIds: [],
  athleteTeamIds: ["team-01"]
};

describe("navegação por papel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mantém os destinos comuns e esconde os restritos sem o papel", () => {
    expect(getVisibleNavigationItems(athleteRoles).map((item) => item.id)).toEqual([
      "hoje",
      "calendario",
      "progresso",
      "loja",
      "perfil"
    ]);
    expect(getVisibleNavigationItems(emptyUserRoles).some((item) => item.id === "coach")).toBe(false);
  });

  it("libera prescrição, equipes e treinos para o coach", () => {
    const ids = getVisibleNavigationItems(coachRoles).map((item) => item.id);
    expect(ids).toContain("coach");
    expect(ids).toContain("coach-equipes");
    expect(ids).toContain("coach-treinos");
  });

  it("não libera equipes nem treinos para quem não é coach", () => {
    const ids = getVisibleNavigationItems(athleteRoles).map((item) => item.id);
    expect(ids).not.toContain("coach-equipes");
    expect(ids).not.toContain("coach-treinos");
  });

  it("não renderiza o atalho Prescrever para o atleta", async () => {
    mockUseUserRoles.mockReturnValue({ userRoles: athleteRoles });

    const screen = await render(
      <AthleteShell active="hoje">
        <Text>Conteúdo</Text>
      </AthleteShell>
    );

    expect(screen.getByTestId("nav-hoje")).toBeTruthy();
    expect(screen.queryByTestId("nav-coach")).toBeNull();
    expect(screen.getByLabelText("Coach Híbrido by Fitblock Training")).toBeTruthy();
  });

  it("renderiza o atalho Prescrever para o coach", async () => {
    mockUseUserRoles.mockReturnValue({ userRoles: coachRoles });

    const screen = await render(
      <AthleteShell active="hoje">
        <Text>Conteúdo</Text>
      </AthleteShell>
    );

    expect(screen.getByTestId("nav-coach")).toBeTruthy();
    expect(screen.getByTestId("nav-coach-equipes")).toBeTruthy();
    expect(screen.getByTestId("nav-coach-treinos")).toBeTruthy();
  });

  it("mantém a marca Fitblock fora das telas de treino", async () => {
    mockUseUserRoles.mockReturnValue({ userRoles: athleteRoles });

    const screen = await render(
      <AthleteShell active="loja">
        <Text>Loja</Text>
      </AthleteShell>
    );

    expect(screen.getByLabelText("FitBlock Training")).toBeTruthy();
    expect(screen.queryByLabelText("Coach Híbrido by Fitblock Training")).toBeNull();
  });
});
