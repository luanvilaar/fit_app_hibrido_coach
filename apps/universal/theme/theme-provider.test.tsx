import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { Text } from "react-native";
import { ThemeSettingsSheet } from "@/components/theme-settings-sheet";
import { ThemeProvider, resolveThemeMode, useAppTheme, THEME_PREFERENCE_KEY } from "@/theme/theme-provider";

function ThemeProbe() {
  const { mode, preference } = useAppTheme();
  return <Text testID="theme-probe">{`${preference}:${mode}`}</Text>;
}

function ThemeSetter({ preference }: { preference: "system" | "light" | "dark" }) {
  const { setPreference } = useAppTheme();
  useEffect(() => {
    void setPreference(preference);
  }, [preference, setPreference]);
  return null;
}

describe("tema do aplicativo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  });

  it("resolve a configuração do dispositivo e mantém a preferência explícita prioritária", () => {
    expect(resolveThemeMode("system", "light")).toBe("light");
    expect(resolveThemeMode("system", "dark")).toBe("dark");
    expect(resolveThemeMode("system", null)).toBe("dark");
    expect(resolveThemeMode("light", "dark")).toBe("light");
    expect(resolveThemeMode("dark", "light")).toBe("dark");
  });

  it("inicia utilizável no fallback escuro e reidrata a escolha local", async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue("light");
    const screen = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme-probe").props.children).toBe("dark:dark");
    await waitFor(() => expect(screen.getByTestId("theme-probe").props.children).toBe("light:light"));
  });

  it("oferece três opções exclusivas, aplica imediatamente e persiste sem backend", async () => {
    const screen = render(
      <ThemeProvider>
        <ThemeSettingsSheet visible onDismiss={jest.fn()} />
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => expect(screen.getByTestId("theme-settings-sheet")).toBeTruthy());
    expect(screen.getByTestId("theme-settings-sheet").props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByLabelText("Tema do aplicativo")).toBeTruthy();
    expect(screen.getByTestId("theme-option-system").props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId("theme-option-light").props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId("theme-option-dark").props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByTestId("theme-option-light"));

    await waitFor(() => expect(screen.getByTestId("theme-probe").props.children).toBe("light:light"));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_PREFERENCE_KEY, "light");
    expect(screen.getByTestId("theme-option-light").props.accessibilityState.selected).toBe(true);
  });

  it("mantém a escolha visual e comunica falha quando a preferência não persiste", async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error("storage unavailable"));
    const screen = render(
      <ThemeProvider>
        <ThemeSettingsSheet visible onDismiss={jest.fn()} />
        <ThemeProbe />
      </ThemeProvider>
    );

    fireEvent.press(screen.getByTestId("theme-option-light"));

    await waitFor(() => expect(screen.getByTestId("theme-probe").props.children).toBe("light:light"));
    await waitFor(() => expect(screen.getByTestId("theme-settings-error").props.children).toBe("Não foi possível salvar sua preferência agora."));
    expect(screen.getByTestId("theme-option-light").props.accessibilityState.disabled).toBe(false);
  });

  it("mantém uma escolha local feita antes da hidratação atrasada", async () => {
    let resolveStoredPreference: (stored: string) => void = () => undefined;
    jest.mocked(AsyncStorage.getItem).mockReturnValue(
      new Promise((resolve) => {
        resolveStoredPreference = resolve;
      })
    );

    const screen = render(
      <ThemeProvider>
        <ThemeSetter preference="light" />
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => expect(screen.getByTestId("theme-probe").props.children).toBe("light:light"));
    resolveStoredPreference("dark");

    await waitFor(() => expect(screen.getByTestId("theme-probe").props.children).toBe("light:light"));
  });
});
