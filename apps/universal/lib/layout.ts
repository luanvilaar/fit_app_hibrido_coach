/** Breakpoints normalize the six ranges defined by the Dark Performance spec. */
export type SizeClass =
  | "mobile-small"
  | "mobile"
  | "tablet"
  | "tablet-large"
  | "desktop"
  | "large-desktop";

export function getSizeClass(width: number): SizeClass {
  if (width < 425) return "mobile-small";
  if (width < 576) return "mobile";
  if (width < 768) return "tablet";
  if (width < 1024) return "tablet-large";
  if (width < 1440) return "desktop";
  return "large-desktop";
}

export function isCompactSizeClass(sizeClass: SizeClass): boolean {
  return sizeClass === "mobile-small" || sizeClass === "mobile" || sizeClass === "tablet";
}
