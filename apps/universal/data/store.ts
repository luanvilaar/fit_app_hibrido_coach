import type {
  StoreProductCategory,
  StoreProductLevel,
  StoreProductRecord,
  StoreProductStatus
} from "@fitblock/backend";

export const storeCategoryOptions: Array<{ value: StoreProductCategory | null; label: string }> = [
  { value: null, label: "Todos" },
  { value: "strength", label: "Força" },
  { value: "hybrid", label: "Híbrido" },
  { value: "running", label: "Corrida" },
  { value: "gymnastics", label: "Ginástica" },
  { value: "weightlifting", label: "LPO" },
  { value: "conditioning", label: "Condicionamento" }
];

const categoryLabels: Record<StoreProductCategory, string> = {
  strength: "Força",
  hybrid: "Híbrido",
  running: "Corrida",
  gymnastics: "Ginástica",
  weightlifting: "LPO",
  conditioning: "Condicionamento",
  other: "Outro"
};

const levelLabels: Record<StoreProductLevel, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
  all: "Todos os níveis"
};

const statusLabels: Record<StoreProductStatus, string> = {
  draft: "Rascunho",
  review: "Em análise",
  published: "Publicado",
  archived: "Arquivado"
};

export function describeProductCategory(category: StoreProductCategory): string {
  return categoryLabels[category];
}

export function describeProductLevel(level: StoreProductLevel): string {
  return levelLabels[level];
}

export function describeProductStatus(status: StoreProductStatus): string {
  return statusLabels[status];
}

export function productTypeLabel(): string {
  return "Programa de treino";
}

export function slugifyStoreTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function filterStoreProducts(
  products: StoreProductRecord[],
  category: StoreProductCategory | null,
  search: string
): StoreProductRecord[] {
  const normalized = search.trim().toLocaleLowerCase();

  return products.filter((product) => {
    const matchesCategory = category === null || product.category === category;
    const matchesSearch =
      normalized.length === 0
      || product.title.toLocaleLowerCase().includes(normalized)
      || product.seller_display_name.toLocaleLowerCase().includes(normalized);

    return matchesCategory && matchesSearch;
  });
}
