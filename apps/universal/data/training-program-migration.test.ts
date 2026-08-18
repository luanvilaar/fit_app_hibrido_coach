import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/20260819100000_training_program_versions_delivery.sql"),
  "utf8"
);

describe("contrato da migration de programas estruturados", () => {
  it("mantém v1 do checkout quando v2 é publicada antes do webhook e em retry/recompra", () => {
    const settlement = migration.slice(migration.lastIndexOf("create or replace function public.settle_store_order("));

    expect(migration).toContain("add column if not exists program_version_id uuid references public.store_program_versions");
    expect(settlement).toContain("where id = order_row.program_version_id");
    expect(settlement).toContain("and product_id = item_row.product_id;");
    expect(settlement).not.toContain("order by version_number desc");
    expect(settlement).toContain("Pedido sem versão de programa congelada.");
    expect(settlement).toContain("case when public.training_program_access.delivery_id is null then excluded.version_id");
  });

  it("normaliza snapshots e entregas históricas para duração vezes sete sem apagar snapshots existentes", () => {
    expect(migration).toContain("Completa versões históricas sem substituir snapshots de treino existentes.");
    expect(migration).toContain("cross join generate_series(1, 7) as generated_day(day_number)");
    expect(migration).toContain("'day_type', 'unprogrammed'");
    expect(migration).toContain("coalesce(legacy.item->'snapshot', 'null'::jsonb)");
    expect(migration).toContain("Entregas já instanciadas recebem a mesma grade W×7");
  });

  it("preserva a duração histórica do snapshot v1 quando o catálogo já aponta para v2", () => {
    const historicalStart = migration.indexOf("O formato antigo de snapshot é elevado uma única vez");
    const historicalUpgrade = migration.slice(
      historicalStart,
      migration.indexOf("drop function if exists public.get_coach_store_product_schedule", historicalStart)
    );
    const deliveryStart = migration.indexOf("Entregas já instanciadas recebem a mesma grade W×7");
    const deliveryNormalization = migration.slice(
      deliveryStart,
      migration.indexOf("create or replace function public.grant_store_program_delivery", deliveryStart)
    );

    expect(historicalUpgrade).toContain("select max(nullif(item.value->>'week_number', '')::integer)");
    expect(historicalUpgrade).toContain("version_row.snapshot->'product'->>'duration_weeks'");
    expect(historicalUpgrade).not.toContain("'duration_weeks', product_row.duration_weeks");
    expect(deliveryNormalization).toContain("select max(nullif(snapshot_item.value->>'week_number', '')::integer)");
    expect(deliveryNormalization).not.toContain("product_row.duration_weeks");
  });

  it("expõe apenas dias de entrega autorizados na agenda do atleta", () => {
    expect(migration).toContain("create or replace function public.list_athlete_calendar_entries");
    expect(migration).toContain("delivery_session_row.day_type <> 'training'");
    expect(migration).toContain("delivery_row.athlete_id = auth.uid()");
    expect(migration).toContain("member_row.role = 'athlete'");
  });
});
