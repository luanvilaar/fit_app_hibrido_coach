import { BlurView } from "expo-blur";
import { type PropsWithChildren, useEffect, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "@/theme/theme-provider";

type GlassSurfaceProps = PropsWithChildren<{
  accessibilityViewIsModal?: boolean;
  intensity?: number;
  nativeID?: string;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  testID?: string;
}>;

export function resolveGlassMaterial(
  colors: ReturnType<typeof useAppTheme>["colors"],
  strong: boolean,
  fallback: boolean
) {
  return {
    backgroundColor: fallback
      ? (strong ? colors.glassStrongFallback : colors.glassFallback)
      : (strong ? colors.glassStrong : colors.glassSubtle),
    borderColor: colors.glassBorder,
    intensity: fallback ? 0 : 28
  };
}

/**
 * Android não expõe blur de forma estável neste projeto e iOS pode pedir a
 * redução de transparência. Em ambos os casos, a camada funcional continua
 * presente, apenas resolvida para uma superfície opaca do mesmo papel.
 */
function useReducedTransparency() {
  const [reducedTransparency, setReducedTransparency] = useState(Platform.OS === "android");

  useEffect(() => {
    if (Platform.OS === "android") return;

    if (Platform.OS === "web") {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      const mediaQuery = window.matchMedia("(prefers-reduced-transparency: reduce)");
      const sync = () => setReducedTransparency(mediaQuery.matches);
      sync();
      mediaQuery.addEventListener?.("change", sync);
      return () => mediaQuery.removeEventListener?.("change", sync);
    }

    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReducedTransparency);
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReducedTransparency);
    return () => subscription.remove();
  }, []);

  return reducedTransparency;
}

/**
 * Material funcional: reservado a navegação, sheets, filtros e controles que
 * flutuam sobre conteúdo. Dados e cartões operacionais permanecem opacos.
 */
export function GlassSurface({
  accessibilityViewIsModal,
  children,
  intensity = 28,
  nativeID,
  style,
  strong = false,
  testID
}: GlassSurfaceProps) {
  const { colors, mode } = useAppTheme();
  const reducedTransparency = useReducedTransparency();
  const fallback = reducedTransparency;
  const material = resolveGlassMaterial(colors, strong, fallback);

  return (
    <BlurView
      accessibilityViewIsModal={accessibilityViewIsModal}
      intensity={fallback ? material.intensity : intensity}
      nativeID={nativeID}
      tint={mode}
      style={[
        styles.base,
        material,
        style
      ]}
      testID={testID}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: "hidden"
  }
});
