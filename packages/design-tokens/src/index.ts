/**
 * FITBLOCK DARK PERFORMANCE — shared visual foundation.
 *
 * THESIS: Performance in the Dark. Near-black layers create the environment;
 * real training media and a condensed display face carry emotion; FitBlock purple
 * is a deliberate action and state signal, never a decorative flood.
 *
 * OWN-WORLD: graphite depth (#050507 → #252530), white/gray reading hierarchy,
 * Barlow Condensed for editorial moments and Inter for operation. Cards are
 * substantial photographic/editorial surfaces with restrained borders and rounded
 * corners; controls are confident pills with visible focus.
 *
 * STORY: A visitor discovers a premium training platform; an athlete executes the
 * next useful action; a coach coordinates work without losing operational clarity.
 *
 * FIRST VIEWPORT: A dark, media-led field keeps the highest-priority action and
 * readable title in immediate view. On compact screens content stacks before it
 * shrinks; purple appears at the primary action, selection, focus and key progress.
 *
 * FORM: FitBlock Dark Performance, derived from FITBLOCK-DARK-PERFORMANCE-SPEC.md.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
 * review, the verdict, and DESIGN.md.
 */

/** Exact palette from the official Dark Performance specification. */
export const fb = {
  bgDeep: "#050507",
  bg: "#08080B",
  surface01: "#101014",
  surface02: "#16161D",
  surface03: "#1D1D26",
  surface04: "#252530",

  purple400: "#8A5CFF",
  purple500: "#7132F5",
  purple600: "#5741D8",
  purple700: "#5B1ECF",

  textPrimary: "#F8F8FA",
  textSecondary: "#A5A5B3",
  textMuted: "#747482",
  white: "#FFFFFF",

  border: "#292934",
  borderHover: "#3A3A48",
  borderPurple: "rgba(113,50,245,0.45)",

  success: "#44D17A",
  warning: "#F5A524",
  error: "#F15B6C",
  info: "#5B9DF5"
} as const;

/**
 * Shared semantic names used by the React Native application.
 *
 * `textMutedAccessible` deliberately differs from the spec's decorative-muted
 * token: #747482 is retained above as the documented value but is below AA for
 * normal text on elevated graphite. Body metadata uses the accessible equivalent.
 */
export const colors = {
  // Canonical Dark Performance tokens
  bgDeep: fb.bgDeep,
  bg: fb.bg,
  surface01: fb.surface01,
  surface02: fb.surface02,
  surface03: fb.surface03,
  surface04: fb.surface04,
  purple400: fb.purple400,
  purple500: fb.purple500,
  purple600: fb.purple600,
  purple700: fb.purple700,
  textPrimary: fb.textPrimary,
  textSecondary: fb.textSecondary,
  textMuted: fb.textMuted,
  textMutedAccessible: "#8E8E9D",
  white: fb.white,
  border: fb.border,
  borderHover: fb.borderHover,
  borderPurple: fb.borderPurple,
  success: fb.success,
  warning: fb.warning,
  danger: fb.error,
  error: fb.error,
  info: fb.info,

  // Application semantic palette
  canvas: fb.bg,
  canvasDeep: fb.bgDeep,
  canvasLight: fb.surface01,
  canvasPressLight: fb.surface03,
  canvasPressStronger: fb.surface04,
  ink: fb.textPrimary,
  inkMuted: fb.textSecondary,
  inkFaint: "rgba(248,248,250,0.18)",
  inkOnLight: fb.white,
  inkOnLightPress: fb.white,
  focusRing: "rgba(162,124,255,0.82)",
  glassSubtle: "rgba(16,16,20,0.78)",
  glassStrong: "rgba(5,5,7,0.88)",
  glassBorder: "rgba(248,248,250,0.16)",
  glassFallback: fb.surface02,
  glassStrongFallback: fb.bgDeep,

  // Menção de movimento (@Front Squat) no texto do treino. O roxo de ação (#7132F5)
  // rende só 3.0:1 sobre surface02 — abaixo de AA para os 14px do corpo do bloco —
  // então o link usa o roxo claro, a 5.9:1, e a menção sem vídeo usa o cinza acessível.
  mentionLink: "#A27CFF",
  mentionDraft: "#8E8E9D",

  // Compatibility aliases. They preserve functional code while its composition
  // migrates away from the previous Sentry vocabulary; all resolve only to the
  // official Dark Performance palette.
  black: fb.bgDeep,
  softCloud: fb.surface01,
  surfaceMuted: fb.surface02,
  graphite: fb.surface03,
  charcoal: fb.textSecondary,
  ash: "#C9C9D3",
  textMutedLegacy: fb.textMuted,
  stone: "#8E8E9D",
  lime: fb.purple500,
  pink: fb.purple400,
  violet: fb.purple400,
  violetDeep: fb.purple700,
  violetMid: fb.purple600,
  fitblockPurple: fb.purple500,
  fitblockPurpleDark: fb.purple700,
  fitblockPurpleDeep: fb.purple600,
  fitblockPurpleLight: "#A27CFF",
  hairline: fb.border,
  hairlineSoft: fb.surface03,
  hairlineOnLight: fb.borderHover,
  hairlineCloud: fb.borderHover,
  authBackdrop: fb.bgDeep,
  authSurface: fb.surface01,
  authInput: fb.surface02,
  authInputBorder: fb.borderHover,
  authTextSecondary: fb.textSecondary,
  authTextMuted: "#8E8E9D",
  authControlHighlight: fb.purple700,
  authSuccess: fb.success,
  authDanger: fb.error,
  authPhotoOverlay: fb.bgDeep,
  sale: fb.error
} as const;

/** A aparência escolhida pelo usuário; `system` respeita o esquema do dispositivo. */
export type ThemePreference = "system" | "light" | "dark";
export type ThemeMode = Exclude<ThemePreference, "system">;

/**
 * Paleta clara do FitBlock. Ela mantém os mesmos papéis semânticos da Dark
 * Performance — não é uma inversão literal de preto e branco.
 */
export const lightColors = {
  bgDeep: "#ECECF1",
  bg: "#F7F7F9",
  surface01: "#FFFFFF",
  surface02: "#FFFFFF",
  surface03: "#F0F0F5",
  surface04: "#E7E7EE",

  purple400: "#8350F7",
  purple500: "#7132F5",
  purple600: "#5C22D6",
  purple700: "#4817AC",

  textPrimary: "#17161C",
  textSecondary: "#565461",
  textMuted: "#706E7A",
  textMutedAccessible: "#5B5965",
  white: "#FFFFFF",

  border: "#D8D7E0",
  borderHover: "#BDBBC9",
  borderPurple: "rgba(113,50,245,0.42)",

  success: "#15803D",
  warning: "#B45309",
  danger: "#C6283D",
  error: "#C6283D",
  info: "#2563EB",

  canvas: "#F7F7F9",
  canvasDeep: "#ECECF1",
  canvasLight: "#FFFFFF",
  canvasPressLight: "#F0F0F5",
  canvasPressStronger: "#E7E7EE",
  ink: "#17161C",
  inkMuted: "#565461",
  inkFaint: "rgba(23,22,28,0.16)",
  inkOnLight: "#FFFFFF",
  inkOnLightPress: "#FFFFFF",
  focusRing: "rgba(92,34,214,0.72)",
  glassSubtle: "rgba(255,255,255,0.76)",
  glassStrong: "rgba(255,255,255,0.9)",
  glassBorder: "rgba(23,22,28,0.12)",
  glassFallback: "#FFFFFF",
  glassStrongFallback: "#F0F0F5",

  mentionLink: "#5B1ECF",
  mentionDraft: "#5B5965",

  black: "#17161C",
  softCloud: "#FFFFFF",
  surfaceMuted: "#F0F0F5",
  graphite: "#E7E7EE",
  charcoal: "#565461",
  ash: "#35333D",
  textMutedLegacy: "#706E7A",
  stone: "#5B5965",
  lime: "#7132F5",
  pink: "#8350F7",
  violet: "#8350F7",
  violetDeep: "#4817AC",
  violetMid: "#5C22D6",
  fitblockPurple: "#7132F5",
  fitblockPurpleDark: "#4817AC",
  fitblockPurpleDeep: "#5C22D6",
  fitblockPurpleLight: "#8350F7",
  hairline: "#D8D7E0",
  hairlineSoft: "#E7E7EE",
  hairlineOnLight: "#BDBBC9",
  hairlineCloud: "#BDBBC9",
  authBackdrop: "#ECECF1",
  authSurface: "#FFFFFF",
  authInput: "#F0F0F5",
  authInputBorder: "#BDBBC9",
  authTextSecondary: "#565461",
  authTextMuted: "#5B5965",
  authControlHighlight: "#4817AC",
  authSuccess: "#15803D",
  authDanger: "#C6283D",
  authPhotoOverlay: "rgba(23,22,28,0.78)",
  sale: "#C6283D"
} as const;

/** Keys shared by all theme variants; values stay strings so each mode can differ. */
export type ThemeColors = { [Key in keyof typeof colors]: string };

/** Todas as superfícies autenticadas devem usar esta seleção por papel, nunca hex avulso. */
export const themes: Record<ThemeMode, ThemeColors> = {
  dark: colors,
  light: lightColors
};

/** 4px base rhythm; sections expand on the platform breakpoint, not per screen. */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 40,
  8: 48,
  9: 64,
  10: 96,
  11: 112,
  12: 140
} as const;

export const radius = {
  none: 0,
  xs: 8,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  card: 20,
  feature: 24,
  hero: 28,
  searchPill: 24,
  authPanelDesktop: 24,
  authPanelMobile: 20,
  pill: 999
} as const;

/** Elevation is subtle graphite depth; purple glow is reserved for a true primary action. */
export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5
  },
  invertedLift: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 4
  },
  ctaGlow: {
    shadowColor: fb.purple500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6
  }
} as const;

export const typeScale = {
  displayCampaign: 96,
  displayHero: 64,
  displaySection: 48,
  headingXl: 32,
  headingLg: 28,
  headingMd: 24,
  headingSm: 20,
  bodyLg: 18,
  bodyMd: 16,
  bodySm: 14,
  caption: 12,
  utilityXs: 11
} as const;

export const fontFamilies = {
  display: "BarlowCondensed-800",
  displayBold: "BarlowCondensed-900",
  interface: "Inter-400",
  interfaceMedium: "Inter-500",
  interfaceSemiBold: "Inter-600",
  interfaceBold: "Inter-700",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
} as const;

export const layout = {
  container: 1360,
  gutter: { mobile: 16, tablet: 24, laptop: 32, desktop: 40 },
  section: { mobile: 60, tablet: 80, desktop: 120 },
  breakpoint: { mobileSmall: 425, tablet: 576, tabletLarge: 768, desktop: 1024, largeDesktop: 1440 }
} as const;

export const motion = {
  fast: 180,
  standard: 220,
  slow: 450,
  modal: 300,
  ease: "cubic-bezier(.2,.8,.2,1)",
  tab: {
    enterMs: 220,
    exitMs: 140,
    offset: 8,
    pressMs: 120,
    easing: [0.16, 1, 0.3, 1] as const
  }
} as const;
