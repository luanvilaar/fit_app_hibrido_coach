import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AuthScreen } from "@/components/auth-screen";

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockAuth = {
  isConfigured: true,
  session: null as { user: { email: string } } | null,
  signIn: jest.fn(),
  signUp: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  signOut: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter
}));

jest.mock("@/auth/auth-provider", () => ({
  useAuth: () => mockAuth
}));

jest.mock("@/auth/rate-limiter", () => ({
  loginRateLimiter: {
    isBlocked: jest.fn(() => ({ blocked: false, minutesLeft: 0 })),
    recordFailedAttempt: jest.fn(() => ({ shouldBlock: false, minutesLeft: 0 })),
    clearAttempts: jest.fn()
  }
}));

describe("AuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.isConfigured = true;
    mockAuth.session = null;
    mockAuth.signIn.mockResolvedValue(undefined);
    mockAuth.signUp.mockResolvedValue({ needsEmailConfirmation: false });
    mockAuth.resetPassword.mockResolvedValue(undefined);
    mockAuth.updatePassword.mockResolvedValue(undefined);
  });

  it("submits credentials and enters the athlete area", async () => {
    const screen = await render(<AuthScreen mode="sign-in" />);

    await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
    await fireEvent.changeText(screen.getByTestId("auth-password"), "ValidPass123!");
    await fireEvent.press(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(mockAuth.signIn).toHaveBeenCalledWith("athlete@fitblock.test", "ValidPass123!");
      expect(mockRouter.replace).toHaveBeenCalledWith("/app/hoje");
    });
  });

  it("renders the updated campaign image and authentication panel", async () => {
    const screen = await render(<AuthScreen mode="sign-in" />);

    expect(screen.getByTestId("auth-visual", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("auth-campaign-image", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("auth-card")).toBeTruthy();
  });

  it("uses password-manager metadata and provides a readable password toggle", async () => {
    const screen = await render(<AuthScreen mode="sign-in" />);

    expect(screen.getByTestId("auth-password").props.autoComplete).toBe("current-password");
    await fireEvent.press(screen.getByTestId("auth-password-toggle"));

    expect(screen.getByTestId("auth-password").props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText("Ocultar senha")).toBeTruthy();
  });

  it("validates email format before calling Supabase", async () => {
    const screen = await render(<AuthScreen mode="sign-in" />);

    await fireEvent.changeText(screen.getByTestId("auth-email"), "not-an-email");
    await fireEvent.press(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(mockAuth.signIn).not.toHaveBeenCalled();
    });
  });

  it("shows the email confirmation state after account creation", async () => {
    mockAuth.signUp.mockResolvedValue({ needsEmailConfirmation: true });
    const screen = await render(<AuthScreen mode="sign-up" />);

    await fireEvent.changeText(screen.getByTestId("auth-email"), "new@fitblock.test");
    await fireEvent.changeText(screen.getByTestId("auth-password"), "ValidPass123!");
    await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "ValidPass123!");
    await fireEvent.press(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(mockAuth.signUp).toHaveBeenCalledWith("new@fitblock.test", "ValidPass123!");
    });
    expect(mockRouter.replace).not.toHaveBeenCalledWith("/app/hoje");
  });

  it("renders a production configuration message when public Supabase keys are missing", async () => {
    mockAuth.isConfigured = false;
    const screen = await render(<AuthScreen mode="sign-in" />);

    expect(screen.getByText("Configuração pendente")).toBeTruthy();
    expect(screen.queryByTestId("auth-submit")).toBeNull();
  });


  describe("password strength validation", () => {
    it("rejects weak passwords on signup", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "weak");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "weak");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(mockAuth.signUp).not.toHaveBeenCalled();
      });
    });

    it("accepts valid strong passwords", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "ValidPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "ValidPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(mockAuth.signUp).toHaveBeenCalledWith("athlete@fitblock.test", "ValidPass123!");
      });
    });

    it("does not re-validate password strength on sign-in, even for a password that would fail the current policy", async () => {
      const screen = await render(<AuthScreen mode="sign-in" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "legacypass");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(mockAuth.signIn).toHaveBeenCalledWith("athlete@fitblock.test", "legacypass");
      });
      expect(screen.queryByText(/Senha insuficiente/)).toBeNull();
    });
  });

  describe("email validation improvements", () => {
    it("detects common email typos", async () => {
      const screen = await render(<AuthScreen mode="sign-in" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@gmial.com");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        const errorText = screen.queryByText(/Parece um typo/);
        expect(errorText).toBeTruthy();
        expect(mockAuth.signIn).not.toHaveBeenCalled();
      });
    });

    it("accepts valid email addresses", async () => {
      const screen = await render(<AuthScreen mode="sign-in" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "ValidPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(mockAuth.signIn).toHaveBeenCalled();
      });
    });
  });

  describe("sign-up flow (criar conta de atleta)", () => {
    it("creates account with valid email, password and confirmation match", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "newathlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(mockAuth.signUp).toHaveBeenCalledWith("newathlete@fitblock.test", "StrongPass123!");
        expect(mockRouter.replace).toHaveBeenCalledWith("/app/hoje");
      });
    });

    it("rejects signup when password confirmation does not match", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "newathlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "DifferentPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.getByText("As senhas não conferem.")).toBeTruthy();
        expect(mockAuth.signUp).not.toHaveBeenCalled();
      });
    });

    it("rejects signup when email is empty", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.getByText("Digite seu e-mail.")).toBeTruthy();
        expect(mockAuth.signUp).not.toHaveBeenCalled();
      });
    });

    it("normalizes email to lowercase and trims whitespace", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "  NewAthlete@FITBLOCK.TEST  ");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(mockAuth.signUp).toHaveBeenCalledWith("newathlete@fitblock.test", "StrongPass123!");
      });
    });

    it("shows password strength indicator during typing on signup", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-password"), "WeakPass");

      // Password strength indicator should exist when password is entered
      await waitFor(() => {
        expect(screen.queryByText(/Força:/)).toBeTruthy();
      });
    });
  });

  describe("error handling and messaging", () => {
    it("displays error when signUp throws an error", async () => {
      mockAuth.signUp.mockRejectedValueOnce(new Error("Já existe uma conta com este e-mail."));
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "existing@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.getByText("Já existe uma conta com este e-mail.")).toBeTruthy();
      });
    });

    it("clears previous error when submitting again", async () => {
      mockAuth.signUp.mockRejectedValueOnce(new Error("Erro na primeira tentativa"));
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.getByText("Erro na primeira tentativa")).toBeTruthy();
      });

      mockAuth.signUp.mockResolvedValueOnce({ needsEmailConfirmation: false });
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.queryByText("Erro na primeira tentativa")).toBeNull();
      });
    });

    it("shows email confirmation message when needsEmailConfirmation is true", async () => {
      mockAuth.signUp.mockResolvedValueOnce({ needsEmailConfirmation: true });
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "newathlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.getByText(/Conta criada. Confira seu e-mail/)).toBeTruthy();
        expect(mockRouter.replace).not.toHaveBeenCalled();
      });
    });

    it("displays specific weak password error message", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "short");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "short");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.getByText(/Senha insuficiente:/)).toBeTruthy();
        expect(mockAuth.signUp).not.toHaveBeenCalled();
      });
    });
  });

  describe("loading and disabled states", () => {
    it("disables submit button during submission", async () => {
      mockAuth.signUp.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");

      const submitButton = screen.getByTestId("auth-submit");
      await fireEvent.press(submitButton);

      await waitFor(() => {
        const updatedButton = screen.getByTestId("auth-submit");
        expect(updatedButton.props.accessibilityState?.disabled).toBe(true);
      });
    });

    it("re-enables submit button after successful submission", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");

      const submitButton = screen.getByTestId("auth-submit");
      await fireEvent.press(submitButton);

      await waitFor(() => {
        const updatedButton = screen.getByTestId("auth-submit");
        expect(updatedButton.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it("re-enables submit button after error", async () => {
      mockAuth.signUp.mockRejectedValueOnce(new Error("Network error"));
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.changeText(screen.getByTestId("auth-password"), "StrongPass123!");
      await fireEvent.changeText(screen.getByTestId("auth-confirm-password"), "StrongPass123!");

      const submitButton = screen.getByTestId("auth-submit");
      await fireEvent.press(submitButton);

      await waitFor(() => {
        const updatedButton = screen.getByTestId("auth-submit");
        expect(updatedButton.props.accessibilityState?.disabled).toBe(false);
      });
    });
  });

  describe("navigation between auth modes", () => {
    it("navigates to login from signup via alternate action link", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      const alternateLink = screen.getByText("Entrar");
      await fireEvent.press(alternateLink);

      expect(mockRouter.replace).toHaveBeenCalledWith("/entrar");
    });

    it("navigates to signup from login via alternate action link", async () => {
      const screen = await render(<AuthScreen mode="sign-in" />);

      const alternateLink = screen.getByText("Criar conta");
      await fireEvent.press(alternateLink);

      expect(mockRouter.replace).toHaveBeenCalledWith("/criar-conta");
    });

    it("navigates to password reset from login", async () => {
      const screen = await render(<AuthScreen mode="sign-in" />);

      const forgotLink = screen.getByText("Esqueci minha senha");
      await fireEvent.press(forgotLink);

      expect(mockRouter.replace).toHaveBeenCalledWith("/recuperar-senha");
    });

    it("navigates to home from auth screen via home link", async () => {
      const screen = await render(<AuthScreen mode="sign-in" />);

      const homeLink = screen.getByText("Voltar para a Home");
      await fireEvent.press(homeLink);

      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });
  });

  describe("reset password flow", () => {
    it("sends password reset email for non-authenticated user", async () => {
      const screen = await render(<AuthScreen mode="reset" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "athlete@fitblock.test");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(mockAuth.resetPassword).toHaveBeenCalledWith("athlete@fitblock.test");
        expect(screen.getByText(/Link enviado. Confira sua caixa de entrada/)).toBeTruthy();
      });
    });

    it("does not show email field for authenticated password reset", async () => {
      mockAuth.session = { user: { email: "athlete@fitblock.test" } };
      const screen = await render(<AuthScreen mode="reset" />);

      expect(screen.queryByTestId("auth-email")).toBeNull();
      expect(screen.getByTestId("auth-password")).toBeTruthy();
      expect(screen.getByTestId("auth-confirm-password")).toBeTruthy();
    });
  });

  describe("accessibility features", () => {
    it("provides accessible labels for all form inputs on signup", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      expect(screen.getByLabelText("E-mail")).toBeTruthy();
      expect(screen.getByLabelText("Senha")).toBeTruthy();
      expect(screen.getByLabelText("Confirmar senha")).toBeTruthy();
    });

    it("has accessible submit button with correct role and label", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      const submitButton = screen.getByTestId("auth-submit");
      expect(submitButton).toBeTruthy();
      expect(submitButton.props.accessibilityLabel).toBe("Criar conta");
    });

    it("provides password toggle button with clear accessibility hints", async () => {
      const screen = await render(<AuthScreen mode="sign-in" />);

      const toggleButton = screen.getByTestId("auth-password-toggle");
      expect(toggleButton.props.accessibilityRole).toBe("button");
      expect(toggleButton.props.accessibilityLabel).toBeDefined();
      expect(toggleButton.props.accessibilityHint).toBeDefined();
    });

    it("marks error messages as alerts for screen readers", async () => {
      const screen = await render(<AuthScreen mode="sign-up" />);

      await fireEvent.changeText(screen.getByTestId("auth-email"), "invalid-email");
      await fireEvent.press(screen.getByTestId("auth-submit"));

      await waitFor(() => {
        expect(screen.queryByText(/E-mail deve conter/)).toBeTruthy();
      });

      const errorMessage = screen.getByText(/E-mail deve conter/);
      expect(errorMessage.props.accessibilityRole).toBe("alert");
      expect(errorMessage.props.accessibilityLiveRegion).toBe("assertive");
    });
  });
});
