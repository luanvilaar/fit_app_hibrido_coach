/** Normalização compartilhada por menções, catálogo e slugs de exercício. */

/** Minúsculas sem acento — a base de toda comparação de nome de movimento. */
export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return foldName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} é obrigatório.`);
  return normalized;
}

export function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} precisa ser um número inteiro maior que zero.`);
  }
  return parsed;
}

export function positiveNumber(value: string, label: string): number {
  const parsed = Number(value.replace(",", "."));
  if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} precisa ser um número maior que zero.`);
  }
  return parsed;
}

export function optionalPositiveNumber(value: string, label: string): number | undefined {
  if (!value.trim()) return undefined;
  return positiveNumber(value, label);
}
