import { fireEvent, render } from "@testing-library/react-native";
import { Dimensions, StyleSheet, Text } from "react-native";
import { AthleteShell, getVisibleNavigationItems } from "@/components/athlete-shell";
import { emptyUserRoles, type UserRoles } from "@/auth/roles";

const mockUseUserRoles = jest.fn();
const MOBILE_DIMENSIONS = { width: 375, height: 812, scale: 3, fontScale: 1 };
const TABLET_DIMENSIONS = { width: 768, height: 1024, scale: 2, fontScale: 1 };
const DESKTOP_DIMENSIONS = { width: 1440, height: 900, scale: 1, fontScale: 1 };

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
    jest.spyOn(Dimensions, "get").mockReturnValue(MOBILE_DIMENSIONS);
  });

  it("mantém os destinos comuns e esconde os restritos sem o papel", () => {
    expect(getVisibleNavigationItems(athleteRoles).map((item) => item.id)).toEqual([
      "hoje",
      "calendario",
      "progresso",
      "loja",
      "meus-treinos",
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

  it("não renderiza o atalho Agenda para o atleta", async () => {
    mockUseUserRoles.mockReturnValue({ userRoles: athleteRoles });

    const screen = await render(
      <AthleteShell active="hoje">
        <Text>Conteúdo</Text>
      </AthleteShell>
    );

    expect(screen.getByTestId("nav-hoje")).toBeTruthy();
    expect(screen.getByTestId("app-top-bar")).toBeTruthy();
    expect(screen.getByTestId("bottom-navigation")).toBeTruthy();
    expect(screen.getByTestId("mobile-route-panel")).toBeTruthy();
    expect(screen.getByTestId("open-theme-settings")).toBeTruthy();
    expect(screen.queryByTestId("nav-coach")).toBeNull();
    expect(screen.getByLabelText("Coach Híbrido by FitBlock")).toBeTruthy();

    // 375 px é a prioridade: comandos ainda têm os 44 px mínimos e a navegação
    // preserva alvos maiores que o requisito, sem reduzir a hierarquia.
    expect(StyleSheet.flatten(screen.getByTestId("open-theme-settings").props.style).height).toBe(44);
    expect(StyleSheet.flatten(screen.getByTestId("nav-hoje").props.style).minHeight).toBe(52);
  });

  it("troca para sidebar em 768 px sem deixar a navegação mobile sobre o conteúdo", async () => {
    jest.spyOn(Dimensions, "get").mockReturnValue(TABLET_DIMENSIONS);
    mockUseUserRoles.mockReturnValue({ userRoles: athleteRoles });

    const screen = await render(
      <AthleteShell active="hoje">
        <Text>Conteúdo</Text>
      </AthleteShell>
    );

    expect(screen.getByTestId("sidebar-nav-scroll")).toBeTruthy();
    expect(screen.queryByTestId("bottom-navigation")).toBeNull();
  });

  it("renderiza o atalho Agenda para o coach", async () => {
    mockUseUserRoles.mockReturnValue({ userRoles: coachRoles });

    const screen = await render(
      <AthleteShell active="hoje">
        <Text>Conteúdo</Text>
      </AthleteShell>
    );

    expect(screen.getByTestId("nav-more")).toBeTruthy();
    expect(screen.queryByTestId("nav-coach")).toBeNull();

    fireEvent.press(screen.getByTestId("nav-more"));

    expect(screen.getByTestId("nav-coach")).toBeTruthy();
    expect(screen.getByTestId("nav-coach-equipes")).toBeTruthy();
    expect(screen.getByTestId("nav-coach-treinos")).toBeTruthy();
  });

  it("mostra os 11 itens de navegação do coach no sidebar desktop sem sobrepor o rodapé", async () => {
    jest.spyOn(Dimensions, "get").mockReturnValue(DESKTOP_DIMENSIONS);
    mockUseUserRoles.mockReturnValue({ userRoles: coachRoles });

    const screen = await render(
      <AthleteShell active="hoje">
        <Text>Conteúdo</Text>
      </AthleteShell>
    );

    // Sidebar desktop não usa o overflow "mais opções" do mobile: a lista inteira
    // fica disponível de uma vez, dentro da área rolável.
    expect(screen.queryByTestId("nav-more")).toBeNull();

    const coachNavIds = [
      "nav-hoje",
      "nav-calendario",
      "nav-progresso",
      "nav-loja",
      "nav-meus-treinos",
      "nav-perfil",
      "nav-coach",
      "nav-coach-equipes",
      "nav-coach-treinos",
      "nav-coach-financeiro",
      "nav-coach-produtos"
    ];

    for (const testId of coachNavIds) {
      expect(screen.getByTestId(testId)).toBeTruthy();
    }

    // Regressão do bug relatado: com os 11 itens do coach presentes, o rodapé
    // ("Precisa de ajuda?" + "Sair") precisa continuar montado e distinto deles,
    // não sobreposto no meio da lista.
    expect(screen.getByText("Precisa de ajuda?")).toBeTruthy();
    expect(screen.getAllByTestId("sign-out").length).toBeGreaterThan(0);

    // A lista precisa estar dentro da área rolável (não uma View solta que estoura
    // a altura do sidebar), e o rodapé não pode voltar a usar position:"absolute"
    // (causa raiz original da sobreposição) — presença na árvore não pega isso,
    // então checamos o estilo resolvido de verdade.
    expect(screen.getByTestId("sidebar-nav-scroll")).toBeTruthy();
    const bottomStyle = StyleSheet.flatten(screen.getByTestId("sidebar-bottom").props.style);
    expect(bottomStyle.position).not.toBe("absolute");
  });

  it("mantém a marca Fitblock fora das telas de treino", async () => {
    mockUseUserRoles.mockReturnValue({ userRoles: athleteRoles });

    const screen = await render(
      <AthleteShell active="loja">
        <Text>Loja</Text>
      </AthleteShell>
    );

    expect(screen.getByLabelText("FitBlock")).toBeTruthy();
    expect(screen.queryByLabelText("Coach Híbrido by FitBlock")).toBeNull();
  });
});
