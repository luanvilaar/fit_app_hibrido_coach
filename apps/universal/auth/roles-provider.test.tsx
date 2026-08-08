import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { RolesProvider, useUserRoles } from "@/auth/roles-provider";

const mockUseAuth = jest.fn();
const mockGetCurrentUserRoles = jest.fn();

jest.mock("@/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth()
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
  getSupabaseConfigurationError: () => null
}));

jest.mock("@fitblock/backend", () => ({
  createRolesRepository: () => ({
    getCurrentUserRoles: () => mockGetCurrentUserRoles()
  })
}));

function RolesProbe() {
  const { userRoles, isLoading, error, hasRole, refresh } = useUserRoles();

  return (
    <>
      <Text testID="state">{isLoading ? "loading" : "ready"}</Text>
      <Text testID="roles">{userRoles.roles.join(",") || "none"}</Text>
      <Text testID="is-coach">{hasRole("coach") ? "coach" : "not-coach"}</Text>
      <Text testID="error">{error ?? "no-error"}</Text>
      <Pressable accessibilityRole="button" testID="refresh" onPress={refresh}>
        <Text>Recarregar</Text>
      </Pressable>
    </>
  );
}

function renderProvider() {
  return render(
    <RolesProvider>
      <RolesProbe />
    </RolesProvider>
  );
}

describe("RolesProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("carrega os papéis do usuário autenticado", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user: { id: "coach-01" } });
    mockGetCurrentUserRoles.mockResolvedValue({
      user_id: "coach-01",
      is_coach: true,
      is_athlete: false,
      roles: ["coach"],
      coach_team_ids: ["team-01"],
      athlete_team_ids: []
    });

    const screen = await renderProvider();

    await waitFor(() => expect(screen.getByTestId("state").props.children).toBe("ready"));
    expect(screen.getByTestId("roles").props.children).toBe("coach");
    expect(screen.getByTestId("is-coach").props.children).toBe("coach");
    expect(screen.getByTestId("error").props.children).toBe("no-error");
  });

  it("não consulta papéis sem sessão ativa", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user: null });

    const screen = await renderProvider();

    await waitFor(() => expect(screen.getByTestId("state").props.children).toBe("ready"));
    expect(screen.getByTestId("roles").props.children).toBe("none");
    expect(mockGetCurrentUserRoles).not.toHaveBeenCalled();
  });

  it("expõe o erro e zera os papéis quando a consulta falha", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user: { id: "coach-01" } });
    mockGetCurrentUserRoles.mockRejectedValue(new Error("Falha ao ler permissões."));

    const screen = await renderProvider();

    await waitFor(() => expect(screen.getByTestId("error").props.children).toBe("Falha ao ler permissões."));
    expect(screen.getByTestId("roles").props.children).toBe("none");
    expect(screen.getByTestId("is-coach").props.children).toBe("not-coach");
  });

  it("recarrega os papéis sob demanda", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user: { id: "coach-01" } });
    mockGetCurrentUserRoles
      .mockResolvedValueOnce({ user_id: "coach-01", roles: ["athlete"], athlete_team_ids: ["team-01"] })
      .mockResolvedValueOnce({ user_id: "coach-01", roles: ["athlete", "coach"], coach_team_ids: ["team-02"] });

    const screen = await renderProvider();

    await waitFor(() => expect(screen.getByTestId("is-coach").props.children).toBe("not-coach"));

    fireEvent.press(screen.getByTestId("refresh"));

    await waitFor(() => expect(screen.getByTestId("is-coach").props.children).toBe("coach"));
    expect(mockGetCurrentUserRoles).toHaveBeenCalledTimes(2);
  });
});
