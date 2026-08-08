import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text, Pressable } from "react-native";
import type { Session } from "@supabase/supabase-js";

const mockSession = {
  access_token: "token",
  refresh_token: "refresh",
  expires_in: 3600,
  expires_at: 1,
  token_type: "bearer",
  user: { id: "user-01", aud: "authenticated", role: "authenticated", email: "athlete@fitblock.test" }
} as unknown as Session;

const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn()
  }
};

jest.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
  getSupabaseConfigurationError: () => null
}));

jest.mock("@/auth/auth-redirect", () => ({
  getAuthRedirect: (path: string) => `https://fitblock.test/${path}`
}));

const { AuthProvider, useAuth } = require("@/auth/auth-provider") as typeof import("@/auth/auth-provider");

function AuthHarness({ onUpdateError }: { onUpdateError?: (error: Error) => void }) {
  const auth = useAuth();

  return (
    <>
      <Text testID="auth-status">{auth.isLoading ? "loading" : auth.session ? "authenticated" : "anonymous"}</Text>
      <Pressable testID="sign-in" onPress={() => void auth.signIn("athlete@fitblock.test", "password")} />
      <Pressable testID="sign-up" onPress={() => void auth.signUp("new@fitblock.test", "password")} />
      <Pressable testID="reset" onPress={() => void auth.resetPassword("athlete@fitblock.test")} />
      <Pressable
        testID="update"
        onPress={() => void auth.updatePassword("new-password").catch((error: Error) => onUpdateError?.(error))}
      />
      <Pressable testID="sign-out" onPress={() => void auth.signOut()} />
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    });
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ error: null });
    mockSupabase.auth.signUp.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mockSupabase.auth.updateUser.mockResolvedValue({ error: null });
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockSession.user }, error: null });
  });

  it("restores the session and exposes the production auth actions", async () => {
    const screen = await render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous"));

    await fireEvent.press(screen.getByTestId("sign-in"));
    await fireEvent.press(screen.getByTestId("sign-up"));
    await fireEvent.press(screen.getByTestId("reset"));
    await fireEvent.press(screen.getByTestId("update"));
    await fireEvent.press(screen.getByTestId("sign-out"));

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "athlete@fitblock.test",
        password: "password"
      });
      expect(mockSupabase.auth.signUp).toHaveBeenCalled();
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  it("updates the exposed user when Supabase emits an auth event", async () => {
    const screen = await render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous"));

    const onAuthStateChange = mockSupabase.auth.onAuthStateChange.mock.calls[0][0];
    await act(async () => onAuthStateChange("SIGNED_IN", mockSession));

    expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
  });

  it("validates session before updating password", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockSession.user },
      error: null
    });

    const screen = await render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByTestId("update"));

    await waitFor(() => {
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    });
  });

  it("throws error when session is invalid during password update", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Session not found")
    });

    const onUpdateError = jest.fn();
    const screen = await render(
      <AuthProvider>
        <AuthHarness onUpdateError={onUpdateError} />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByTestId("update"));

    await waitFor(() => {
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(onUpdateError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Sua sessão expirou. Faça login novamente para atualizar sua senha." })
      );
    });
  });
});
