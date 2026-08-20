import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import { colors as darkColors, themes, type ThemeColors, type ThemeMode, type ThemePreference } from "@fitblock/design-tokens";

const THEME_PREFERENCE_KEY = "fitblock.theme-preference.v1";

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  preference: ThemePreference;
  isReady: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const defaultTheme: ThemeContextValue = {
  colors: darkColors,
  mode: "dark",
  preference: "dark",
  isReady: true,
  setPreference: async () => undefined
};

const ThemeContext = createContext<ThemeContextValue>(defaultTheme);

/** Resolve uma preferência persistida sem deixar a aparência depender de uma plataforma específica. */
export function resolveThemeMode(preference: ThemePreference, systemScheme: "light" | "dark" | null | undefined): ThemeMode {
  if (preference === "light" || preference === "dark") return preference;
  return systemScheme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>("dark");
  const [isReady, setIsReady] = useState(false);
  const localPreferenceVersion = useRef(0);
  const mode = resolveThemeMode(preference, systemScheme);

  useEffect(() => {
    let mounted = true;
    const hydrationVersion = localPreferenceVersion.current;

    void AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((stored) => {
        if (localPreferenceVersion.current !== hydrationVersion) return;
        if (!mounted || (stored !== "system" && stored !== "light" && stored !== "dark")) return;
        setStoredPreference(stored);
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const themeColor = themes[mode].bg;
    document.documentElement.style.backgroundColor = themeColor;
    document.documentElement.style.colorScheme = mode;
    document.body.style.backgroundColor = themeColor;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }, [mode]);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    localPreferenceVersion.current += 1;
    setStoredPreference(nextPreference);
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextPreference);
    } catch (error) {
      // A aparência continua escolhida nesta sessão; a próxima abertura volta ao fallback seguro (escuro).
      throw error;
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: themes[mode], mode, preference, isReady, setPreference }),
    [isReady, mode, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export { THEME_PREFERENCE_KEY };
