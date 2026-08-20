import { AccessibilityInfo, StyleSheet, Text } from "react-native";
import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react-native";
import { colors, lightColors } from "@fitblock/design-tokens";
import { GlassSurface, resolveGlassMaterial } from "@/components/ui/glass-surface";
import { ThemeProvider, useAppTheme } from "@/theme/theme-provider";

function LightThemeSurface() {
  const { setPreference } = useAppTheme();
  useEffect(() => {
    void setPreference("light");
  }, [setPreference]);

  return <GlassSurface strong testID="light-glass-surface"><Text>Claro</Text></GlassSurface>;
}

describe("GlassSurface", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("compõe material de controle com o token forte e sem estilização local", () => {
    const screen = render(
      <GlassSurface strong testID="glass-surface">
        <Text>Controles</Text>
      </GlassSurface>
    );

    const surface = screen.getByTestId("glass-surface");
    const style = StyleSheet.flatten(surface.props.style);

    expect(surface.props.intensity).toBe(28);
    expect(style.backgroundColor).toBe(colors.glassStrong);
    expect(style.borderColor).toBe(colors.glassBorder);
  });

  it("troca blur por fallback opaco ao respeitar transparência reduzida", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);

    const screen = render(
      <GlassSurface accessibilityViewIsModal strong testID="glass-surface">
        <Text>Aparência</Text>
      </GlassSurface>
    );

    await waitFor(() => {
      const surface = screen.getByTestId("glass-surface");
      expect(surface.props.intensity).toBe(0);
      expect(StyleSheet.flatten(surface.props.style).backgroundColor).toBe(colors.glassStrongFallback);
    });
    expect(screen.getByTestId("glass-surface").props.accessibilityViewIsModal).toBe(true);
  });

  it("usa o material claro e o fallback sólido do mesmo papel sem hex local", async () => {
    const screen = render(
      <ThemeProvider>
        <LightThemeSurface />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(StyleSheet.flatten(screen.getByTestId("light-glass-surface").props.style).backgroundColor)
        .toBe(lightColors.glassStrong);
    });
    expect(resolveGlassMaterial(lightColors, false, true)).toEqual({
      backgroundColor: lightColors.glassFallback,
      borderColor: lightColors.glassBorder,
      intensity: 0
    });
  });
});
