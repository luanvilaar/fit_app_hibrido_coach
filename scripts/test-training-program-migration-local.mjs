/**
 * Integração destrutiva, exclusivamente local, da migration de programas.
 *
 * Uso (exige Docker/Podman, Supabase local e psql no PATH):
 *   RUN_SUPABASE_LOCAL_INTEGRATION=1 npm run test:training-program-migration:local
 *
 * Nunca aceita URL remota e restaura o schema local com `supabase db reset`
 * mesmo após verificar o rollback. Não usa .env nem credenciais de staging.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const rollbackFile = resolve(root, "supabase/rollback/20260819100000_training_program_versions_delivery.sql");

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    timeout: 15_000,
    ...options
  });
  return {
    code: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`.trim()
  };
}

function requireCommand(program) {
  const result = command("sh", ["-lc", `command -v ${program}`]);
  if (result.code !== 0) {
    throw new Error(`Dependência local ausente: ${program} não está no PATH.`);
  }
}

function parseEnvironment(output) {
  return Object.fromEntries(
    output.split(/\r?\n/).flatMap((line) => {
      const index = line.indexOf("=");
      if (index <= 0) return [];
      return [[line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")]];
    })
  );
}

function assertLocalUrl(value) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("A integração aceita apenas Supabase local (127.0.0.1/localhost); staging/remoto é recusado.");
  }
}

async function insertOne(client, table, payload) {
  const { data, error } = await client.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function count(client, table, filters) {
  let query = client.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count: total, error } = await query;
  if (error) throw error;
  return total ?? 0;
}

function programSnapshot({ weeks, templateId, label }) {
  const sessions = [];
  const types = ["training", "rest", "recovery", "assessment", "unprogrammed", "rest", "unprogrammed"];
  const titles = {
    training: `${label} · Treino`,
    rest: "Descanso",
    recovery: "Recuperação",
    assessment: "Avaliação",
    unprogrammed: "Sem programação"
  };

  for (let week = 1; week <= weeks; week += 1) {
    for (let day = 1; day <= 7; day += 1) {
      const dayType = types[day - 1];
      sessions.push({
        week_number: week,
        day_number: day,
        day_type: dayType,
        template_id: dayType === "training" ? templateId : null,
        title: titles[dayType],
        snapshot: dayType === "training" ? { title: `${label} · Treino`, blocks: [] } : null
      });
    }
  }

  return {
    schema_version: 2,
    product: {
      title: "Programa de Integração",
      slug: "programa-integracao",
      description: "Fixture local de integração.",
      short_description: "Fixture local.",
      price_cents: 19900,
      category: "strength",
      objective: "Validar versões",
      level: "beginner",
      duration_weeks: weeks
    },
    sessions
  };
}

async function createUser(admin, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "LocalIntegrationOnly!123",
    email_confirm: true
  });
  if (error || !data.user) throw error ?? new Error("Não foi possível criar usuário local.");
  return data.user;
}

async function signIn(apiUrl, anonKey, email) {
  const client = createClient(apiUrl, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: "LocalIntegrationOnly!123" });
  if (error) throw error;
  return client;
}

async function settle(admin, { athleteId, coachId, productId, versionId, startDate, paymentId }) {
  const order = await insertOne(admin, "store_orders", {
    buyer_id: athleteId,
    seller_coach_id: coachId,
    total_amount_cents: 19900,
    program_start_date: startDate,
    program_version_id: versionId,
    status: "pending"
  });
  await insertOne(admin, "store_order_items", {
    order_id: order.id,
    product_id: productId,
    quantity: 1,
    unit_price_cents: 19900
  });
  await insertOne(admin, "store_payment_intents", {
    order_id: order.id,
    buyer_id: athleteId,
    seller_coach_id: coachId,
    provider_payment_id: paymentId,
    amount_cents: 19900,
    method: "pix",
    status: "pending"
  });
  const { data, error } = await admin.rpc("settle_store_order", {
    p_provider_payment_id: paymentId,
    p_amount_cents: 19900,
    p_paid_at: "2026-08-17T12:00:00.000Z"
  });
  if (error) throw error;
  assert.equal(data, order.id);
  return order;
}

async function runIntegration({ apiUrl, anonKey, serviceRoleKey, dbUrl }) {
  const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } });
  const coach = await createUser(admin, "coach-program-local@example.test");
  const owner = await createUser(admin, "owner-program-local@example.test");
  const mondayAthlete = await createUser(admin, "monday-program-local@example.test");
  const thursdayAthlete = await createUser(admin, "thursday-program-local@example.test");
  const v2Athlete = await createUser(admin, "v2-program-local@example.test");

  const team = await insertOne(admin, "teams", {
    name: "Time de Integração",
    description: "Fixture local.",
    level: "iniciante",
    objective: "Validar programa",
    created_by: coach.id
  });
  await admin.from("team_members").insert([
    { team_id: team.id, user_id: coach.id, role: "coach" },
    { team_id: team.id, user_id: mondayAthlete.id, role: "athlete" },
    { team_id: team.id, user_id: thursdayAthlete.id, role: "athlete" },
    { team_id: team.id, user_id: v2Athlete.id, role: "athlete" }
  ]).throwOnError();

  const template = await insertOne(admin, "session_templates", {
    title: "Treino de Integração",
    status: "published",
    created_by: coach.id
  });
  const product = await insertOne(admin, "store_products", {
    seller_coach_id: coach.id,
    type: "training_program",
    title: "Programa de Integração",
    slug: "programa-integracao",
    description: "Fixture local de integração.",
    short_description: "Fixture local de programa.",
    price_cents: 19900,
    category: "strength",
    objective: "Validar versões",
    level: "beginner",
    duration_weeks: 8,
    status: "published"
  });
  const v1 = await insertOne(admin, "store_program_versions", {
    product_id: product.id,
    version_number: 1,
    snapshot: programSnapshot({ weeks: 4, templateId: template.id, label: "v1" }),
    created_by: coach.id
  });
  const v2 = await insertOne(admin, "store_program_versions", {
    product_id: product.id,
    version_number: 2,
    snapshot: programSnapshot({ weeks: 8, templateId: template.id, label: "v2" }),
    created_by: coach.id
  });

  // v1 permanece em quatro semanas mesmo quando o catálogo/v2 está em oito.
  const mondayOrder = await settle(admin, {
    athleteId: mondayAthlete.id,
    coachId: coach.id,
    productId: product.id,
    versionId: v1.id,
    startDate: "2026-08-17",
    paymentId: "local-v1-monday"
  });
  const thursdayOrder = await settle(admin, {
    athleteId: thursdayAthlete.id,
    coachId: coach.id,
    productId: product.id,
    versionId: v1.id,
    startDate: "2026-08-20",
    paymentId: "local-v1-thursday"
  });
  await settle(admin, {
    athleteId: v2Athlete.id,
    coachId: coach.id,
    productId: product.id,
    versionId: v2.id,
    startDate: "2026-08-17",
    paymentId: "local-v2-monday"
  });

  const { data: mondayAccess, error: mondayAccessError } = await admin
    .from("training_program_access")
    .select("id, version_id, delivery_id")
    .eq("user_id", mondayAthlete.id)
    .eq("product_id", product.id)
    .single();
  if (mondayAccessError) throw mondayAccessError;
  assert.equal(mondayAccess.version_id, v1.id);
  assert.equal(await count(admin, "training_program_delivery_sessions", { delivery_id: mondayAccess.delivery_id }), 28);

  const { data: thursdayAccess, error: thursdayAccessError } = await admin
    .from("training_program_access")
    .select("delivery_id")
    .eq("user_id", thursdayAthlete.id)
    .eq("product_id", product.id)
    .single();
  if (thursdayAccessError) throw thursdayAccessError;
  assert.equal(await count(admin, "training_program_delivery_sessions", { delivery_id: thursdayAccess.delivery_id }), 28);

  const { data: v2Access, error: v2AccessError } = await admin
    .from("training_program_access")
    .select("version_id, delivery_id")
    .eq("user_id", v2Athlete.id)
    .eq("product_id", product.id)
    .single();
  if (v2AccessError) throw v2AccessError;
  assert.equal(v2Access.version_id, v2.id);
  assert.equal(await count(admin, "training_program_delivery_sessions", { delivery_id: v2Access.delivery_id }), 56);

  const mondayDay3 = await admin.from("training_program_delivery_sessions")
    .select("scheduled_date")
    .eq("delivery_id", mondayAccess.delivery_id).eq("week_number", 1).eq("day_number", 3).single();
  const thursdayDay3 = await admin.from("training_program_delivery_sessions")
    .select("scheduled_date")
    .eq("delivery_id", thursdayAccess.delivery_id).eq("week_number", 1).eq("day_number", 3).single();
  assert.equal(mondayDay3.data?.scheduled_date, "2026-08-19");
  assert.equal(thursdayDay3.data?.scheduled_date, "2026-08-22");

  // Retry é idempotente; recompra não troca a versão/entrega já vinculada.
  const retry = await admin.rpc("settle_store_order", {
    p_provider_payment_id: "local-v1-monday",
    p_amount_cents: 19900,
    p_paid_at: "2026-08-17T12:00:00.000Z"
  });
  if (retry.error) throw retry.error;
  assert.equal(retry.data, mondayOrder.id);
  await settle(admin, {
    athleteId: mondayAthlete.id,
    coachId: coach.id,
    productId: product.id,
    versionId: v2.id,
    startDate: "2026-09-01",
    paymentId: "local-v2-rebuy"
  });
  const mondayAfterRebuy = await admin.from("training_program_access")
    .select("version_id, delivery_id").eq("id", mondayAccess.id).single();
  assert.equal(mondayAfterRebuy.data?.version_id, v1.id);
  assert.equal(mondayAfterRebuy.data?.delivery_id, mondayAccess.delivery_id);

  const mondayClient = await signIn(apiUrl, anonKey, mondayAthlete.email);
  const thursdayClient = await signIn(apiUrl, anonKey, thursdayAthlete.email);
  const mondayPrograms = await mondayClient.rpc("list_my_training_programs");
  const thursdayPrograms = await thursdayClient.rpc("list_my_training_programs");
  if (mondayPrograms.error) throw mondayPrograms.error;
  if (thursdayPrograms.error) throw thursdayPrograms.error;
  assert.equal(mondayPrograms.data?.length, 1);
  assert.equal(thursdayPrograms.data?.length, 1);

  const mondayCalendar = await mondayClient.rpc("list_athlete_calendar_entries", { p_from: "2026-08-17", p_to: "2026-08-23" });
  const thursdayCalendar = await thursdayClient.rpc("list_athlete_calendar_entries", { p_from: "2026-08-20", p_to: "2026-08-26" });
  if (mondayCalendar.error) throw mondayCalendar.error;
  if (thursdayCalendar.error) throw thursdayCalendar.error;
  assert.deepEqual(new Set(mondayCalendar.data?.map((entry) => entry.day_type)), new Set(["training", "rest", "recovery", "assessment", "unprogrammed"]));
  assert.ok(thursdayCalendar.data?.some((entry) => entry.scheduled_date === "2026-08-22"));

  const thursdayTraining = await admin.from("training_program_delivery_sessions")
    .select("session_instance_id").eq("delivery_id", thursdayAccess.delivery_id).eq("week_number", 1).eq("day_number", 1).single();
  const crossTenantSession = await mondayClient.rpc("get_athlete_session", { p_session_id: thursdayTraining.data?.session_instance_id });
  assert.ok(crossTenantSession.error, "BFLA: aluno não pode abrir sessão da entrega de outro aluno");

  const publicDetail = await mondayClient.rpc("get_store_product", { p_slug: product.slug }).maybeSingle();
  if (publicDetail.error) throw publicDetail.error;
  assert.ok(!JSON.stringify(publicDetail.data).includes("template_id"));
  assert.ok(!JSON.stringify(publicDetail.data).includes('"snapshot"'));

  const reviewProduct = await insertOne(admin, "store_products", {
    seller_coach_id: coach.id,
    type: "training_program",
    title: "Produto para Revisão",
    slug: "produto-para-revisao",
    description: "Descrição para validação do owner.",
    short_description: "Resumo para revisão.",
    price_cents: 9900,
    category: "strength",
    objective: "Validar moderação",
    level: "beginner",
    duration_weeks: 4,
    status: "review"
  });
  await insertOne(admin, "platform_owners", { user_id: owner.id, granted_by: coach.id });
  const ownerClient = await signIn(apiUrl, anonKey, owner.email);
  const ownerReview = await ownerClient.rpc("list_store_products_for_review");
  const athleteReview = await mondayClient.rpc("list_store_products_for_review");
  if (ownerReview.error || athleteReview.error) throw ownerReview.error ?? athleteReview.error;
  assert.ok(ownerReview.data?.some((entry) => entry.id === reviewProduct.id && entry.objective === "Validar moderação" && entry.duration_weeks === 4));
  assert.equal(athleteReview.data?.length, 0);

  // O rollback só é executado no banco local explicitamente preparado acima.
  const rollback = command("psql", ["-v", "ON_ERROR_STOP=1", dbUrl, "-f", rollbackFile]);
  if (rollback.code !== 0) throw new Error(`Rollback local falhou: ${rollback.output}`);
  const tableCheck = command("psql", [dbUrl, "-tAc", "select to_regclass('public.store_program_versions') is null"]);
  if (tableCheck.code !== 0 || tableCheck.output.trim() !== "t") {
    throw new Error("Rollback local não removeu store_program_versions como esperado.");
  }
}

async function main() {
  if (process.env.RUN_SUPABASE_LOCAL_INTEGRATION !== "1") {
    console.log("SKIP: defina RUN_SUPABASE_LOCAL_INTEGRATION=1 para autorizar reset/mutation somente do Supabase local.");
    return;
  }
  if (!existsSync(rollbackFile)) throw new Error("Arquivo de rollback não encontrado.");

  const containerRuntime = command("sh", ["-lc", "command -v docker || command -v podman"]);
  if (containerRuntime.code !== 0) {
    console.log("BLOCKED: Docker ou Podman não está instalado/no PATH; o Supabase local não pode ser iniciado.");
    return;
  }

  const status = command("npx", ["supabase", "status", "-o", "env"]);
  if (status.code !== 0) {
    console.log(`BLOCKED: Supabase local indisponível. ${status.output}`);
    return;
  }
  requireCommand("psql");
  const local = parseEnvironment(status.output);
  const apiUrl = local.API_URL;
  const anonKey = local.ANON_KEY;
  const serviceRoleKey = local.SERVICE_ROLE_KEY;
  const dbUrl = local.DB_URL;
  if (!apiUrl || !anonKey || !serviceRoleKey || !dbUrl) {
    throw new Error("supabase status -o env não retornou API_URL, ANON_KEY, SERVICE_ROLE_KEY e DB_URL.");
  }
  assertLocalUrl(apiUrl);
  assertLocalUrl(dbUrl);

  let resetNeeded = false;
  try {
    const reset = command("npx", ["supabase", "db", "reset", "--local", "--no-seed"]);
    if (reset.code !== 0) throw new Error(`Reset local falhou: ${reset.output}`);
    resetNeeded = true;
    await runIntegration({ apiUrl, anonKey, serviceRoleKey, dbUrl });
    console.log("PASS: migration/RPC/RLS/rollback de programas validada no Supabase local.");
  } finally {
    if (resetNeeded) {
      const restore = command("npx", ["supabase", "db", "reset", "--local", "--no-seed"]);
      if (restore.code !== 0) console.error(`WARN: não foi possível restaurar o schema local: ${restore.output}`);
    }
  }
}

await main();
