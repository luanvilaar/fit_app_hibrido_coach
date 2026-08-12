import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { colors } from "@fitblock/design-tokens";

/**
 * Marcas geométricas utilitárias mantidas para compatibilidade de interface.
 * As superfícies Dark Performance preferem ícones Ionicons de traço consistente;
 * estes símbolos usam apenas formas abstratas de baixo contraste.
 */
export type MascotProps = { size?: number; style?: object };

const OUTLINE = colors.textPrimary;
const STROKE_WIDTH = 3;

export function DumbbellMascot({ size = 96, style }: MascotProps) {
  return (
    <Svg height={size} style={style} viewBox="0 0 120 120" width={size}>
      <Path
        d="M30 60 Q20 44 30 30 Q34 26 38 30 Q30 44 40 56 L80 56 Q90 44 82 30 Q86 26 90 30 Q100 44 90 60 Q100 76 90 90 Q86 94 82 90 Q90 76 80 64 L40 64 Q30 76 38 90 Q34 94 30 90 Q20 76 30 60 Z"
        fill={colors.surface03}
        stroke={OUTLINE}
        strokeLinejoin="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Circle cx={26} cy={60} fill={colors.surface04} r={18} stroke={OUTLINE} strokeWidth={STROKE_WIDTH} />
      <Circle cx={94} cy={60} fill={colors.surface04} r={18} stroke={OUTLINE} strokeWidth={STROKE_WIDTH} />
      <Path d="M48 60 H72" stroke={colors.purple400} strokeLinecap="round" strokeWidth={4} />
    </Svg>
  );
}

export function TimerMascot({ size = 96, style }: MascotProps) {
  return (
    <Svg height={size} style={style} viewBox="0 0 120 120" width={size}>
      <Path
        d="M50 14 H70"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path d="M60 14 V26" stroke={OUTLINE} strokeLinecap="round" strokeWidth={STROKE_WIDTH} />
      <Circle
        cx={60}
        cy={68}
        fill={colors.surface03}
        r={42}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
      />
      <Path
        d="M60 68 L60 42"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M60 68 L80 78"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Circle cx={60} cy={68} fill={colors.purple400} r={4} />
    </Svg>
  );
}

export function ChecklistMascot({ size = 96, style }: MascotProps) {
  return (
    <Svg height={size} style={style} viewBox="0 0 120 120" width={size}>
      <Path
        d="M32 20 H88 Q94 20 94 26 V104 Q94 110 88 110 H32 Q26 110 26 104 V26 Q26 20 32 20 Z"
        fill={colors.surface03}
        stroke={OUTLINE}
        strokeLinejoin="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Ellipse cx={60} cy={20} fill={colors.purple700} rx={16} ry={7} stroke={OUTLINE} strokeWidth={3} />
      <Path
        d="M38 52 L48 60 L64 42"
        fill="none"
        stroke={colors.purple400}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={6}
      />
      <Path d="M38 76 H82" stroke={OUTLINE} strokeLinecap="round" strokeWidth={4} />
      <Path d="M38 90 H70" stroke={OUTLINE} strokeLinecap="round" strokeWidth={4} />
    </Svg>
  );
}

export function TrophyMascot({ size = 96, style }: MascotProps) {
  return (
    <Svg height={size} style={style} viewBox="0 0 120 120" width={size}>
      <Path
        d="M40 22 H80 V52 Q80 74 60 74 Q40 74 40 52 Z"
        fill={colors.surface03}
        stroke={OUTLINE}
        strokeLinejoin="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path
        d="M40 28 Q22 28 22 42 Q22 56 40 54"
        fill="none"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path
        d="M80 28 Q98 28 98 42 Q98 56 80 54"
        fill="none"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path d="M60 74 V90" stroke={OUTLINE} strokeLinecap="round" strokeWidth={STROKE_WIDTH} />
      <Path
        d="M44 90 H76 L80 106 H40 Z"
        fill={colors.purple700}
        stroke={OUTLINE}
        strokeLinejoin="round"
        strokeWidth={STROKE_WIDTH}
      />
    </Svg>
  );
}

export const mascots = [DumbbellMascot, TimerMascot, ChecklistMascot, TrophyMascot] as const;
