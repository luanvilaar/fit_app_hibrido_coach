import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@fitblock/design-tokens";

type SquiggleDividerProps = {
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Divisor assinatura: uma linha desenhada à mão em vez de um hairline reto. */
export function SquiggleDivider({ color = colors.lime, style }: SquiggleDividerProps) {
  return (
    <View style={[{ height: 14, width: "100%" }, style]}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 320 14" width="100%">
        <Path
          d="M0 8 C 12 0, 28 0, 40 8 C 52 16, 68 16, 80 8 C 92 0, 108 0, 120 8 C 132 16, 148 16, 160 8 C 172 0, 188 0, 200 8 C 212 16, 228 16, 240 8 C 252 0, 268 0, 280 8 C 292 16, 308 16, 320 8"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}
