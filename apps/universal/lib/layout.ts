export type SizeClass = "phone" | "tablet-portrait" | "tablet-landscape" | "desktop";

export function getSizeClass(width: number): SizeClass {
  if (width < 600) return "phone";
  if (width < 900) return "tablet-portrait";
  if (width < 1200) return "tablet-landscape";
  return "desktop";
}

export function isCompactSizeClass(sizeClass: SizeClass): boolean {
  return sizeClass === "phone" || sizeClass === "tablet-portrait";
}
