/**
 * Tokens do FitBlock, alinhados ao sistema Nike (DESIGN-nike.md).
 *
 * Duas regras carregam o sistema inteiro:
 * 1. Preto, branco e um único cinza de superfície ocupam ~95% do chrome.
 * 2. O roxo FitBlock é o único acento cromático — ocupa o lugar que a cor de
 *    promoção ocupa na Nike: seta, número de seção, estado ativo. Nunca decorativo.
 */
export const colors = {
  // Preto e branco: a Nike trata os dois como parceiros de igual peso.
  ink: "#111111",
  black: "#050506",
  canvas: "#FFFFFF",

  // Superfície: o cinza é o "estúdio" onde toda fotografia de produto é montada.
  softCloud: "#F5F5F5",
  surfaceMuted: "#ECECF1",
  graphite: "#1A1B20",

  // Divisores. hairlineSoft é a única "sombra" do sistema (inset 1px em barras fixas).
  hairline: "#CACACB",
  hairlineSoft: "#E5E5E5",

  // Texto, do mais forte ao mais fraco.
  charcoal: "#39393B",
  ash: "#4B4B4D",
  textSecondary: "#707072",
  textMuted: "#9E9EA0",
  stone: "#9E9EA0",

  // Acento único da marca.
  fitblockPurple: "#7132F5",
  fitblockPurpleDark: "#5741D8",
  fitblockPurpleDeep: "#5B1ECF",
  fitblockPurpleLight: "#C7B8FF",

  // Telas de autenticação: medidas a partir de referência fotográfica; não seguem o
  // sistema Nike de propósito. Mexer aqui quebra o alinhamento das Stories 1.7 e 1.11.
  authBackdrop: "#121212",
  authSurface: "#D9D9D9",
  authInput: "#FFFFFF",
  authInputBorder: "#BFC0C7",
  authTextSecondary: "#56596B",
  authTextMuted: "#686B82",
  authControlHighlight: "#E9E4FF",
  authSuccess: "#126B46",
  authDanger: "#A51C2B",
  authPhotoOverlay: "#121212",

  // Semânticos.
  sale: "#D30005",
  success: "#007D48",
  warning: "#D99000",
  danger: "#D92D3A",
  info: "#1151FF"
} as const;

/** Base de 8px. `section` (48) é o ritmo vertical entre blocos de conteúdo. */
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
  10: 80
} as const;

/**
 * Vocabulário de forma da Nike, na prática, tem só dois valores: `none` para todo
 * container e `pill` para todo CTA. `searchPill` (24) é a exceção, para campo de busca.
 *
 * `xs`/`sm`/`md`/`lg`/`xl` são o vocabulário legado das telas do app, onde `md` e `lg`
 * significam "card". Os valores ficam como estavam de propósito: subi-los para os da
 * Nike arredondaria todo painel do app, que é o oposto da intenção do sistema
 * (container = raio 0). Não use os intermediários em código novo.
 */
export const radius = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  searchPill: 24,
  authPanelDesktop: 43,
  authPanelMobile: 24,
  pill: 999
} as const;

/**
 * Contraste tipográfico extremo: um tier de display para o momento editorial e um
 * tier quieto de 12–16px para todo o resto. O meio-termo é intencionalmente vazio.
 */
export const typeScale = {
  displayCampaign: 96,
  displayHero: 56,
  displaySection: 40,
  headingXl: 32,
  headingLg: 24,
  headingMd: 16,
  bodyLg: 18,
  bodyMd: 16,
  bodySm: 14,
  caption: 12,
  utilityXs: 9
} as const;

export const fontFamilies = {
  /** Bebas Neue, carregada em app/_layout.tsx. Só para o tier de campanha, uppercase. */
  display: "BebasNeue",
  interface: "System"
} as const;

export const motion = {
  fast: 160,
  standard: 240,
  ease: "ease-out"
} as const;
