import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { RequireRole } from "@/auth/require-role";
import { emptyUserRoles, type UserRoles } from "@/auth/roles";

const mockRouter = { replace: jest.fn() };
const mockUseUserRoles = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter
}));

jest.mock("@/auth/roles-provider", () => ({
  useUserRoles: () => mockUseUserRoles()
}));

const coachRoles: UserRoles = {
  userId: "coach-01",
  roles: ["coach"],
  coachTeamIds: ["team-01"],
  athleteTeamIds: []
};

const athleteRoles: UserRoles = {
  userId: "athlete-01",
  roles: ["athlete"],
  coachTeamIds: [],
  athleteTeamIds: ["team-01"]
};

const ownerRoles: UserRoles = {
  userId: "owner-01",
  roles: ["owner"],
  coachTeamIds: [],
  athleteTeamIds: []
};

function renderGate() {
  return render(
    <RequireRole role="coach">
      <Text>Área do coach</Text>
    </RequireRole>
  );
}

function renderAthleteGate() {
  return render(
    <RequireRole role="athlete">
      <Text>Área do atleta</Text>
    </RequireRole>
  );
}

describe("RequireRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza a área restrita para quem tem o papel exigido", async () => {
    mockUseUserRoles.mockReturnValue({
      userRoles: coachRoles,
      isLoading: false,
      error: null,
      refresh: jest.fn()
    });

    const screen = await renderGate();

    expect(screen.getByText("Área do coach")).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("renderiza a área restrita para proprietário da plataforma", async () => {
    mockUseUserRoles.mockReturnValue({
      userRoles: ownerRoles,
      isLoading: false,
      error: null,
      refresh: jest.fn()
    });

    const screen = await renderGate();

    expect(screen.getByText("Área do coach")).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("redireciona o atleta que abre a rota do coach", async () => {
    mockUseUserRoles.mockReturnValue({
      userRoles: athleteRoles,
      isLoading: false,
      error: null,
      refresh: jest.fn()
    });

    const screen = await renderGate();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/app/hoje"));
    expect(screen.queryByText("Área do coach")).toBeNull();
  });

  it("redireciona owner sem athlete da rota atleta para a área do coach", async () => {
    mockUseUserRoles.mockReturnValue({
      userRoles: ownerRoles,
      isLoading: false,
      error: null,
      refresh: jest.fn()
    });

    const screen = await renderAthleteGate();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/app/coach/acompanhamento"));
    expect(screen.queryByText("Área do atleta")).toBeNull();
  });

  it("aguarda a leitura dos papéis antes de decidir o acesso", async () => {
    mockUseUserRoles.mockReturnValue({
      userRoles: emptyUserRoles,
      isLoading: true,
      error: null,
      refresh: jest.fn()
    });

    const screen = await renderGate();

    expect(screen.queryByText("Área do coach")).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("bloqueia o acesso e permite nova tentativa quando a leitura falha", async () => {
    const refresh = jest.fn();
    mockUseUserRoles.mockReturnValue({
      userRoles: emptyUserRoles,
      isLoading: false,
      error: "Falha de rede ao consultar permissões.",
      refresh
    });

    const screen = await renderGate();

    expect(screen.getByTestId("role-gate-error")).toBeTruthy();
    expect(screen.getByText("Falha de rede ao consultar permissões.")).toBeTruthy();
    expect(screen.queryByText("Área do coach")).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("role-gate-retry"));
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId("role-gate-leave"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/app/hoje");
  });
});
