import type { SupabaseClient } from "@supabase/supabase-js";
import { createStoreRepository } from "@fitblock/backend";

function createClient(data: unknown = null) {
  const rpc = jest.fn().mockImplementation(() => {
    const response = Promise.resolve({ data, error: null });
    return Object.assign(response, {
      single: jest.fn().mockResolvedValue({ data, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data, error: null })
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
      objective: "Construir força",
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

  it("aceita detalhes públicos sem expor o id do template", async () => {
    const { client } = createClient({
      id: "product-1",
      seller_coach_id: "coach-1",
      seller_display_name: "Coach",
      type: "training_program",
      title: "Base de Força",
      slug: "base-de-forca",
      description: "Ciclo completo",
      short_description: "Para começar",
      cover_image_url: null,
      price_cents: 19900,
      category: "strength",
      level: "beginner",
      duration_weeks: 8,
      status: "published",
      sessions: [{ id: "session-1", week_number: 1, day_number: 1, title: "Treino A" }]
    });

    await expect(createStoreRepository(client).getProduct("base-de-forca")).resolves.toMatchObject({
      sessions: [{ id: "session-1", title: "Treino A" }]
    });
  });

  it("preserva os metadados comerciais completos para a moderação", async () => {
    const { client } = createClient([{
      id: "product-1",
      seller_coach_id: "coach-1",
      seller_display_name: "Coach",
      title: "Base de Força",
      slug: "base-de-forca",
      description: "Programa completo de força.",
      short_description: "Força em quatro semanas.",
      price_cents: 19900,
      category: "strength",
      objective: "Construir força",
      level: "beginner",
      duration_weeks: 4,
      status: "review",
      updated_at: "2026-08-17T12:00:00.000Z"
    }]);

    await expect(createStoreRepository(client).listProductsForReview()).resolves.toMatchObject([
      expect.objectContaining({ description: "Programa completo de força.", objective: "Construir força", duration_weeks: 4 })
    ]);
  });

  it("envia a agenda multi-semana sem campos internos da UI", async () => {
    const { client, rpc } = createClient({ id: "product-2" });

    await createStoreRepository(client).createTrainingProgram({
      title: "Base Híbrida",
      slug: "base-hibrida",
      description: "Ciclo completo",
      shortDescription: "Para evoluir",
      coverImageUrl: null,
      priceCents: 14900,
      category: "hybrid",
      objective: "Evoluir no treino híbrido",
      level: "all",
      durationWeeks: 8,
      schedule: [
        { week_number: 1, day_number: 1, day_type: "training", session_template_id: "template-1", session_title: "Treino A" },
        { week_number: 1, day_number: 2, day_type: "rest", session_template_id: null, session_title: "Descanso" }
      ]
    });

    expect(rpc).toHaveBeenCalledWith("create_store_training_program", expect.objectContaining({
      p_schedule: [
        { week_number: 1, day_number: 1, day_type: "training", session_template_id: "template-1" },
        { week_number: 1, day_number: 2, day_type: "rest", session_template_id: null }
      ]
    }));
  });

  it("cria uma entrega para equipe sem aceitar preço, coach ou conteúdo do cliente", async () => {
    const { client, rpc } = createClient({ id: "delivery-1" });

    await createStoreRepository(client).createProgramDelivery({
      productId: "product-1",
      teamId: "team-1",
      startDate: "2026-08-20"
    });

    expect(rpc).toHaveBeenCalledWith("create_training_program_delivery", {
      p_product_id: "product-1",
      p_team_id: "team-1",
      p_athlete_id: null,
      p_start_date: "2026-08-20"
    });
  });
});
