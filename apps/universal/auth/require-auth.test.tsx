import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { RequireAuth } from "@/auth/require-auth";

const mockRouter = { replace: jest.fn() };
const mockUseAuth = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter
}));

jest.mock("@/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth()
}));

describe("RequireAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects anonymous users to the login route", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, session: null });
    const screen = await render(
      <RequireAuth>
        <Text>Área protegida</Text>
      </RequireAuth>
    );

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/entrar"));
    expect(screen.queryByText("Área protegida")).toBeNull();
  });

  it("renders protected content for an authenticated session", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, session: { user: { id: "user-01" } } });
    const screen = await render(
      <RequireAuth>
        <Text>Área protegida</Text>
      </RequireAuth>
    );

    expect(screen.getByText("Área protegida")).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
