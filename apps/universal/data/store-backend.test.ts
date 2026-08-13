import type { SupabaseClient } from "@supabase/supabase-js";
import { createStoreRepository } from "@fitblock/backend";

function createClient(data: unknown = null) {
  const rpc = jest.fn().mockImplementation(() => {
    const response = Promise.resolve({ data, error: null });
    return Object.assign(response, {
      single: jest.fn().mockResolvedValue({ data, error: null })
    });
  });
  const client = {
    rpc
  } as unknown as SupabaseClient;
  return { client, rpc: client.rpc as jest.Mock };
}

describe("store backend repository", () => {
  it("lista a vitrine com a categoria da UI", async () => {
    const { client, rpc } = createClient([]);

    await createStoreRepository(client).listProducts("running");

    expect(rpc).toHaveBeenCalledWith("list_store_products", { p_category: "running" });
  });

  it("cria produto com preço em centavos e template vinculado", async () => {
    const { client, rpc } = createClient({ id: "product-1" });

    await createStoreRepository(client).createTrainingProduct({
      title: "Base de Força",
      slug: "base-de-forca",
      description: "Ciclo completo",
      shortDescription: "Para começar",
      coverImageUrl: null,
      priceCents: 19900,
      category: "strength",
      level: "beginner",
      durationWeeks: 8,
      sessionTemplateId: "template-1"
    });

    expect(rpc).toHaveBeenCalledWith("create_store_training_product", {
      p_title: "Base de Força",
      p_slug: "base-de-forca",
      p_description: "Ciclo completo",
      p_short_description: "Para começar",
      p_cover_image_url: null,
      p_price_cents: 19900,
      p_category: "strength",
      p_level: "beginner",
      p_duration_weeks: 8,
      p_session_template_id: "template-1"
    });
  });

  it("normaliza sessões do acesso comprado", async () => {
    const { client } = createClient([
      {
        access_id: "access-1",
        product_id: "product-1",
        order_id: "order-1",
        title: "Base de Força",
        seller_coach_id: "coach-1",
        seller_display_name: "Coach",
        duration_weeks: 8,
        granted_at: "2026-08-13T12:00:00.000Z",
        sessions: [{ id: "session-1", week_number: 1, day_number: 1, session_template_id: "template-1", title: "Treino A" }]
      }
    ]);

    await expect(createStoreRepository(client).listMyTrainingPrograms()).resolves.toMatchObject([
      { product_id: "product-1", sessions: [{ title: "Treino A" }] }
    ]);
  });
});
