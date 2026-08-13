import type { StoreProductRecord } from "@fitblock/backend";
import { filterStoreProducts, slugifyStoreTitle } from "@/data/store";

const products: StoreProductRecord[] = [
  {
    id: "product-1",
    seller_coach_id: "coach-1",
    seller_display_name: "Luan Vilar",
    type: "training_program",
    title: "Base de Força",
    slug: "base-de-forca",
    short_description: "Um ciclo para construir força.",
    cover_image_url: null,
    price_cents: 19900,
    category: "strength",
    level: "beginner",
    duration_weeks: 8,
    status: "published",
    created_at: "2026-08-13T12:00:00.000Z"
  },
  {
    id: "product-2",
    seller_coach_id: "coach-2",
    seller_display_name: "Ana Corrida",
    type: "training_program",
    title: "Primeiros 5K",
    slug: "primeiros-5k",
    short_description: "Comece a correr com consistência.",
    cover_image_url: null,
    price_cents: 14900,
    category: "running",
    level: "all",
    duration_weeks: 6,
    status: "published",
    created_at: "2026-08-12T12:00:00.000Z"
  }
];

describe("store data helpers", () => {
  it("gera slugs estáveis sem acentos ou pontuação", () => {
    expect(slugifyStoreTitle("  Base de Força — 8 semanas! ")).toBe("base-de-forca-8-semanas");
  });

  it("filtra a vitrine por categoria, título e coach", () => {
    expect(filterStoreProducts(products, "strength", "força")).toHaveLength(1);
    expect(filterStoreProducts(products, null, "ana")).toEqual([products[1]]);
    expect(filterStoreProducts(products, "running", "força")).toEqual([]);
  });
});
