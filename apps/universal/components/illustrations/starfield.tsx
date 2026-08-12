import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@fitblock/design-tokens";

/**
 * Textura de fundo do canvas roxo-meia-noite: pinpricks brancos em opacidade baixa,
 * densidade fixa por semente para não recalcular a cada render.
 */
function makeStars(count: number, seed: number) {
  let value = seed;
  function next() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  }

  return Array.from({ length: count }, (_, index) => ({
    key: `star-${index}`,
    cx: next() * 100,
    cy: next() * 100,
    r: 0.35 + next() * 0.55,
    opacity: 0.12 + next() * 0.28
  }));
}

type StarfieldProps = {
  density?: "sparse" | "normal";
  style?: StyleProp<ViewStyle>;
};

export function Starfield({ density = "normal", style }: StarfieldProps) {
  const stars = useMemo(() => makeStars(density === "sparse" ? 40 : 90, 7), [density]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
        {stars.map((star) => (
          <Circle
            cx={star.cx}
            cy={star.cy}
            fill={colors.ink}
            fillOpacity={star.opacity}
            key={star.key}
            r={star.r}
          />
        ))}
      </Svg>
    </View>
  );
}
