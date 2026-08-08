import type {
  CalendarSessionRecord,
  CreateSessionTemplateRequest,
  ExerciseCategory,
  ExerciseRecord,
  PrescribeSessionRequest
} from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import { asString, getSessionBlocks, isRecord, toCalendarDate } from "@/data/calendar";

/** Categorias oferecidas no seletor, uma por modalidade de treino. */
export const blockKinds = ["strength", "conditioning", "lpo", "endurance", "gymnastics-skill"] as const;

export type BlockKind = (typeof blockKinds)[number];

export const blockKindLabels: Record<BlockKind, string> = {
  strength: "Força",
  conditioning: "Condicionamento",
  lpo: "LPO",
  endurance: "Endurance",
  "gymnastics-skill": "Skill ginástico"
};

export const blockKindHints: Record<BlockKind, string> = {
  strength: "Exercícios do banco, com séries e carga",
  conditioning: "Texto livre do WOD, com ranking interno opcional",
  lpo: "Texto livre com séries, repetições e carga",
  endurance: "Texto livre com volume por modalidade",
  "gymnastics-skill": "Exercícios do banco, com séries"
};

/** Categoria do movimento no catálogo: decide o formato de prescrição do exercício. */
export const exerciseCategories = ["forca-acessorios", "forca-lpo", "ginastica"] as const;

export type { ExerciseCategory };

export const exerciseCategoryLabels: Record<ExerciseCategory, string> = {
  "forca-acessorios": "Força / Acessórios",
  "forca-lpo": "Força / LPO",
  ginastica: "Ginástica"
};

/** Só Ginástica não usa séries com reps/carga — o exercício vira uma caixa de texto único. */
export function exerciseCategoryIsQualitative(category: ExerciseCategory | null): boolean {
  return category === "ginastica";
}

/**
 * Categorias criadas antes das modalidades. Não aparecem no seletor, mas continuam chegando na
 * leitura: os snapshots congelados em `session_instances.snapshot` mantêm esses valores para sempre.
 * Todas caem em "strength", o único mapeamento sem perda — esses blocos sempre tiveram
 * exercícios e séries.
 */
const legacyBlockKinds = ["warm-up", "cooldown", "custom"] as const;

const legacyBlockKindFallback: BlockKind = "strength";

function normalizeBlockKindForFilter(kind: string): BlockKind {
  return (blockKinds as readonly string[]).includes(kind) ? (kind as BlockKind) : legacyBlockKindFallback;
}

/** Categorias distintas presentes numa sessão, para o filtro por categoria do calendário do coach. */
export function getSessionBlockKinds(session: CalendarSessionRecord): BlockKind[] {
  const kinds = getSessionBlocks(session).map((block) => normalizeBlockKindForFilter(block.kind));
  return [...new Set(kinds)];
}

/** Como o bloco é preenchido: lista de exercícios do banco ou texto livre da categoria. */
export type BlockLayout = "exercises" | "free-text";

const freeTextKinds = ["conditioning", "lpo", "endurance"] as const;

export function blockLayout(kind: BlockKind): BlockLayout {
  return (freeTextKinds as readonly string[]).includes(kind) ? "free-text" : "exercises";
}

/** Só Condicionamento oferece ranking interno; a etapa de envio de score do atleta vem depois. */
export function supportsRanking(kind: BlockKind): boolean {
  return kind === "conditioning";
}

export const blockScoreTypes = ["time", "rounds-reps", "reps", "load"] as const;

export type BlockScoreType = (typeof blockScoreTypes)[number];

export const blockScoreTypeLabels: Record<BlockScoreType, string> = {
  time: "Tempo",
  "rounds-reps": "Rounds + reps",
  reps: "Repetições",
  load: "Carga"
};

export const enduranceModalities = ["run", "row", "bike"] as const;

export type EnduranceModality = (typeof enduranceModalities)[number];

export const enduranceModalityLabels: Record<EnduranceModality, string> = {
  run: "Corrida",
  row: "Remo",
  bike: "Bike"
};

export const volumeUnits = ["m", "km", "min"] as const;

export type VolumeUnit = (typeof volumeUnits)[number];

/** `fixed` é carga absoluta em kg; `percentage-1rm` é percentual do 1RM do atleta. */
export const loadTypes = ["percentage-1rm", "fixed"] as const;

export type LoadType = (typeof loadTypes)[number];

export const loadTypeLabels: Record<LoadType, string> = {
  "percentage-1rm": "% 1RM",
  fixed: "kg"
};

export type SessionStatus = "draft" | "published";

export type PrescriptionSetForm = {
  id: string;
  reps: string;
  load: string;
  loadType: LoadType;
};

export type ExerciseItemForm = {
  id: string;
  exerciseName: string;
  /** Categoria do movimento escolhido no catálogo; null até o coach selecionar ou definir uma. */
  category: ExerciseCategory | null;
  restSeconds: string;
  sets: PrescriptionSetForm[];
  /** Texto livre da prescrição qualitativa (Ginástica); ignorado nas demais categorias. */
  notes: string;
};

export type BlockRankingForm = {
  enabled: boolean;
  scoreType: BlockScoreType;
};

export type EnduranceVolumeForm = {
  modality: EnduranceModality;
  enabled: boolean;
  volume: string;
  unit: VolumeUnit;
};

export type BlockForm = {
  id: string;
  name: string;
  kind: BlockKind;
  /** Categorias baseadas em exercício (Força, Skill ginástico). */
  items: ExerciseItemForm[];
  /** Conteúdo das categorias de texto livre (Condicionamento, LPO, Endurance). */
  description: string;
  /** Ranking interno do bloco; hoje só Condicionamento usa. */
  ranking: BlockRankingForm;
  /** Séries prescritas no bloco de LPO (não pertencem a um exercício do banco). */
  sets: PrescriptionSetForm[];
  /** Volume por modalidade no bloco de Endurance. */
  volumes: EnduranceVolumeForm[];
};

export type CoachSessionForm = {
  teamId: string;
  title: string;
  scheduledDate: string;
  status: SessionStatus;
  /** Recado exibido na aba Hoje do atleta; opcional. */
  coachNote: string;
  blocks: BlockForm[];
};

export type CoachSessionSummary = {
  blocks: number;
  exercises: number;
  sets: number;
};

let sequence = 0;

function createId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function requiredText(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} é obrigatório.`);
  }

  return normalized;
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} precisa ser um número inteiro maior que zero.`);
  }

  return parsed;
}

function optionalNumber(value: string, label: string): number | undefined {
  if (!value.trim()) return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} precisa ser um número válido.`);
  }

  return parsed;
}

function positiveNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} precisa ser um número maior que zero.`);
  }

  return parsed;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseReps(value: string, label: string): { reps?: number; reps_min?: number; reps_max?: number } {
  const normalized = requiredText(value, label);
  const range = normalized.match(/^(\d+)\s*-\s*(\d+)$/);

  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);

    if (min <= 0 || max < min) {
      throw new Error(`${label}: a faixa de repetições é inválida.`);
    }

    return { reps_min: min, reps_max: max };
  }

  return { reps: positiveInteger(normalized, label) };
}

export function createSetForm(overrides: Partial<Omit<PrescriptionSetForm, "id">> = {}): PrescriptionSetForm {
  return {
    id: createId("set"),
    reps: overrides.reps ?? "5",
    load: overrides.load ?? "",
    loadType: overrides.loadType ?? "percentage-1rm"
  };
}

export function createItemForm(overrides: Partial<Omit<ExerciseItemForm, "id">> = {}): ExerciseItemForm {
  return {
    id: createId("item"),
    exerciseName: overrides.exerciseName ?? "",
    category: overrides.category ?? null,
    restSeconds: overrides.restSeconds ?? "120",
    sets: overrides.sets ?? [createSetForm()],
    notes: overrides.notes ?? ""
  };
}

export function createEnduranceVolumes(
  overrides: EnduranceVolumeForm[] = []
): EnduranceVolumeForm[] {
  return enduranceModalities.map((modality) => {
    const saved = overrides.find((volume) => volume.modality === modality);

    return {
      modality,
      enabled: saved?.enabled ?? false,
      volume: saved?.volume ?? "",
      unit: saved?.unit ?? (modality === "bike" ? "min" : "m")
    };
  });
}

export function createBlockForm(overrides: Partial<Omit<BlockForm, "id">> = {}): BlockForm {
  const kind = overrides.kind ?? "strength";

  return {
    id: createId("block"),
    name: overrides.name ?? "Bloco principal",
    kind,
    items: overrides.items ?? [createItemForm()],
    description: overrides.description ?? "",
    ranking: overrides.ranking ?? { enabled: false, scoreType: "time" },
    sets: overrides.sets ?? [createSetForm()],
    volumes: createEnduranceVolumes(overrides.volumes ?? [])
  };
}

export function createInitialCoachSessionForm(teamId = ""): CoachSessionForm {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    teamId,
    title: "",
    // toCalendarDate usa getters locais: evita o deslocamento de fuso do toISOString.
    scheduledDate: toCalendarDate(tomorrow),
    status: "published",
    coachNote: "",
    blocks: [
      createBlockForm({
        name: "Força principal",
        kind: "strength",
        items: [
          createItemForm({
            exerciseName: "Back Squat",
            restSeconds: "150",
            sets: [
              createSetForm({ reps: "3-5", load: "75" }),
              createSetForm({ reps: "3-5", load: "75" }),
              createSetForm({ reps: "3-5", load: "75" })
            ]
          })
        ]
      })
    ]
  };
}

function mapItems(block: BlockForm, mapper: (item: ExerciseItemForm) => ExerciseItemForm): BlockForm {
  return { ...block, items: block.items.map(mapper) };
}

export function updateSessionField<
  Field extends "teamId" | "title" | "scheduledDate" | "status" | "coachNote"
>(
  form: CoachSessionForm,
  field: Field,
  value: CoachSessionForm[Field]
): CoachSessionForm {
  return { ...form, [field]: value };
}

/**
 * Helpers `*ToList`/`InList` operam direto sobre `BlockForm[]`, sem depender de `CoachSessionForm`.
 * Reaproveitados pelo editor de biblioteca (`coach-library.ts`), que não tem equipe/data/recado.
 */
export function addBlockToList(blocks: BlockForm[]): BlockForm[] {
  return [...blocks, createBlockForm({ name: `Bloco ${blocks.length + 1}` })];
}

/** Mantém sempre ao menos um bloco: uma sessão sem bloco é rejeitada pelo backend. */
export function removeBlockFromList(blocks: BlockForm[], blockId: string): BlockForm[] {
  if (blocks.length <= 1) return blocks;
  return blocks.filter((block) => block.id !== blockId);
}

export type BlockPatch = Partial<Pick<BlockForm, "name" | "kind" | "description">>;

export function updateBlockInList(blocks: BlockForm[], blockId: string, patch: BlockPatch): BlockForm[] {
  return blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block));
}

export function updateBlockRankingInList(
  blocks: BlockForm[],
  blockId: string,
  patch: Partial<BlockRankingForm>
): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId ? { ...block, ranking: { ...block.ranking, ...patch } } : block
  );
}

export function updateBlockVolumeInList(
  blocks: BlockForm[],
  blockId: string,
  modality: EnduranceModality,
  patch: Partial<Omit<EnduranceVolumeForm, "modality">>
): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId
      ? {
          ...block,
          volumes: block.volumes.map((volume) =>
            volume.modality === modality ? { ...volume, ...patch } : volume
          )
        }
      : block
  );
}

/** Séries do bloco de LPO: prescritas no bloco, não em um exercício do banco. */
export function addBlockSetToList(blocks: BlockForm[], blockId: string): BlockForm[] {
  return blocks.map((block) => {
    if (block.id !== blockId) return block;

    const last = block.sets[block.sets.length - 1];
    return {
      ...block,
      sets: [...block.sets, createSetForm({ reps: last?.reps, load: last?.load, loadType: last?.loadType })]
    };
  });
}

/** Mantém sempre ao menos uma série no bloco de LPO. */
export function removeBlockSetFromList(blocks: BlockForm[], blockId: string, setId: string): BlockForm[] {
  return blocks.map((block) => {
    if (block.id !== blockId || block.sets.length <= 1) return block;
    return { ...block, sets: block.sets.filter((set) => set.id !== setId) };
  });
}

export type SetPatch = Partial<Pick<PrescriptionSetForm, "reps" | "load" | "loadType">>;

export function updateBlockSetInList(
  blocks: BlockForm[],
  blockId: string,
  setId: string,
  patch: SetPatch
): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId
      ? { ...block, sets: block.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) }
      : block
  );
}

export function addItemToList(blocks: BlockForm[], blockId: string): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId ? { ...block, items: [...block.items, createItemForm()] } : block
  );
}

/** Mantém sempre ao menos um exercício por bloco. */
export function removeItemFromList(blocks: BlockForm[], blockId: string, itemId: string): BlockForm[] {
  return blocks.map((block) => {
    if (block.id !== blockId || block.items.length <= 1) return block;
    return { ...block, items: block.items.filter((item) => item.id !== itemId) };
  });
}

export type ItemPatch = Partial<Pick<ExerciseItemForm, "exerciseName" | "category" | "restSeconds" | "notes">>;

export function updateItemInList(
  blocks: BlockForm[],
  blockId: string,
  itemId: string,
  patch: ItemPatch
): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId ? mapItems(block, (item) => (item.id === itemId ? { ...item, ...patch } : item)) : block
  );
}

export function addSetToList(blocks: BlockForm[], blockId: string, itemId: string): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId
      ? mapItems(block, (item) => {
          if (item.id !== itemId) return item;
          const last = item.sets[item.sets.length - 1];
          return {
            ...item,
            sets: [
              ...item.sets,
              createSetForm({ reps: last?.reps, load: last?.load, loadType: last?.loadType })
            ]
          };
        })
      : block
  );
}

/** Mantém sempre ao menos uma série por exercício. */
export function removeSetFromList(
  blocks: BlockForm[],
  blockId: string,
  itemId: string,
  setId: string
): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId
      ? mapItems(block, (item) => {
          if (item.id !== itemId || item.sets.length <= 1) return item;
          return { ...item, sets: item.sets.filter((set) => set.id !== setId) };
        })
      : block
  );
}

export function updateSetInList(
  blocks: BlockForm[],
  blockId: string,
  itemId: string,
  setId: string,
  patch: SetPatch
): BlockForm[] {
  return blocks.map((block) =>
    block.id === blockId
      ? mapItems(block, (item) =>
          item.id === itemId
            ? { ...item, sets: item.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) }
            : item
        )
      : block
  );
}

export function addBlock(form: CoachSessionForm): CoachSessionForm {
  return { ...form, blocks: addBlockToList(form.blocks) };
}

export function removeBlock(form: CoachSessionForm, blockId: string): CoachSessionForm {
  return { ...form, blocks: removeBlockFromList(form.blocks, blockId) };
}

export function updateBlock(form: CoachSessionForm, blockId: string, patch: BlockPatch): CoachSessionForm {
  return { ...form, blocks: updateBlockInList(form.blocks, blockId, patch) };
}

export function updateBlockRanking(
  form: CoachSessionForm,
  blockId: string,
  patch: Partial<BlockRankingForm>
): CoachSessionForm {
  return { ...form, blocks: updateBlockRankingInList(form.blocks, blockId, patch) };
}

export function updateBlockVolume(
  form: CoachSessionForm,
  blockId: string,
  modality: EnduranceModality,
  patch: Partial<Omit<EnduranceVolumeForm, "modality">>
): CoachSessionForm {
  return { ...form, blocks: updateBlockVolumeInList(form.blocks, blockId, modality, patch) };
}

export function addBlockSet(form: CoachSessionForm, blockId: string): CoachSessionForm {
  return { ...form, blocks: addBlockSetToList(form.blocks, blockId) };
}

export function removeBlockSet(form: CoachSessionForm, blockId: string, setId: string): CoachSessionForm {
  return { ...form, blocks: removeBlockSetFromList(form.blocks, blockId, setId) };
}

export function updateBlockSet(
  form: CoachSessionForm,
  blockId: string,
  setId: string,
  patch: SetPatch
): CoachSessionForm {
  return { ...form, blocks: updateBlockSetInList(form.blocks, blockId, setId, patch) };
}

export function addItem(form: CoachSessionForm, blockId: string): CoachSessionForm {
  return { ...form, blocks: addItemToList(form.blocks, blockId) };
}

export function removeItem(form: CoachSessionForm, blockId: string, itemId: string): CoachSessionForm {
  return { ...form, blocks: removeItemFromList(form.blocks, blockId, itemId) };
}

export function updateItem(
  form: CoachSessionForm,
  blockId: string,
  itemId: string,
  patch: ItemPatch
): CoachSessionForm {
  return { ...form, blocks: updateItemInList(form.blocks, blockId, itemId, patch) };
}

export function addSet(form: CoachSessionForm, blockId: string, itemId: string): CoachSessionForm {
  return { ...form, blocks: addSetToList(form.blocks, blockId, itemId) };
}

export function removeSet(
  form: CoachSessionForm,
  blockId: string,
  itemId: string,
  setId: string
): CoachSessionForm {
  return { ...form, blocks: removeSetFromList(form.blocks, blockId, itemId, setId) };
}

export function updateSet(
  form: CoachSessionForm,
  blockId: string,
  itemId: string,
  setId: string,
  patch: SetPatch
): CoachSessionForm {
  return { ...form, blocks: updateSetInList(form.blocks, blockId, itemId, setId, patch) };
}

/** Âncora do mês (dia 1, hora local) para uma data `AAAA-MM-DD`. */
export function monthAnchorFromDate(value: string): Date {
  const [year, month] = value.split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month)) return new Date();

  return new Date(year, month - 1, 1);
}

/** Traduz falhas do backend em mensagens que fazem sentido para o coach. */
export function describeCoachBackendError(error: unknown): string {
  return describeBackendError(error);
}

/**
 * Sugestões de exercícios já cadastrados que casam com o que o coach está digitando.
 * Comparação por slug: acento, maiúscula e espaçamento não impedem o reaproveitamento do registro existente.
 */
/**
 * Movimento do catálogo cujo nome bate exatamente (por slug) com o que o coach digitou.
 * Null quando o nome ainda não corresponde a nenhum movimento cadastrado — é nesse momento
 * que o editor precisa perguntar a categoria do movimento novo.
 */
export function findExerciseByName(exercises: ExerciseRecord[], name: string): ExerciseRecord | null {
  const normalizedName = slugify(name);
  if (!normalizedName) return null;

  return exercises.find((exercise) => slugify(exercise.name) === normalizedName) ?? null;
}

export function filterExerciseSuggestions(
  exercises: ExerciseRecord[],
  query: string,
  limit = 6
): ExerciseRecord[] {
  const normalizedQuery = slugify(query);
  if (!normalizedQuery) return [];

  return exercises
    .filter((exercise) => {
      const normalizedName = slugify(exercise.name);
      return normalizedName !== normalizedQuery && normalizedName.includes(normalizedQuery);
    })
    .slice(0, limit);
}

export function summarizeBlocks(blocks: BlockForm[]): CoachSessionSummary {
  const exercises = blocks.reduce(
    (total, block) => (blockLayout(block.kind) === "exercises" ? total + block.items.length : total),
    0
  );
  const sets = blocks.reduce((total, block) => {
    if (block.kind === "lpo") return total + block.sets.length;
    if (blockLayout(block.kind) === "free-text") return total;
    return total + block.items.reduce((blockTotal, item) => blockTotal + item.sets.length, 0);
  }, 0);

  return { blocks: blocks.length, exercises, sets };
}

export function summarizeCoachSessionForm(form: CoachSessionForm): CoachSessionSummary {
  return summarizeBlocks(form.blocks);
}

function buildSetPayload(set: PrescriptionSetForm, label: string): Record<string, unknown> {
  const reps = parseReps(set.reps, `${label}: repetições`);
  const load = optionalNumber(set.load, `${label}: carga`);

  return {
    ...reps,
    ...(load === undefined ? {} : { load_type: set.loadType, load_value: load })
  };
}

function buildBlockDetails(block: BlockForm, blockLabel: string): Record<string, unknown> {
  if (blockLayout(block.kind) === "exercises") return {};

  const details: Record<string, unknown> = {
    description: requiredText(block.description, `${blockLabel}: descrição do bloco`)
  };

  if (block.kind === "conditioning" && block.ranking.enabled) {
    details.ranking = { enabled: true, score_type: block.ranking.scoreType };
  }

  if (block.kind === "lpo") {
    if (block.sets.length === 0) {
      throw new Error(`${blockLabel} precisa ter pelo menos uma série.`);
    }

    details.sets = block.sets.map((set, setIndex) => ({
      set_number: setIndex + 1,
      ...buildSetPayload(set, `${blockLabel} · série ${setIndex + 1}`)
    }));
  }

  if (block.kind === "endurance") {
    const enabled = block.volumes.filter((volume) => volume.enabled);

    if (enabled.length === 0) {
      throw new Error(`${blockLabel}: escolha pelo menos uma modalidade de endurance.`);
    }

    details.volumes = enabled.map((volume) => ({
      modality: volume.modality,
      value: positiveNumber(
        volume.volume,
        `${blockLabel}: volume de ${enduranceModalityLabels[volume.modality].toLowerCase()}`
      ),
      unit: volume.unit
    }));
  }

  return details;
}

/** Reaproveitado pelo editor de biblioteca: mesmas regras de validação de bloco/exercício/série. */
export function buildBlocksPayload(blocks: BlockForm[]): CreateSessionTemplateRequest["blocks"] {
  if (blocks.length === 0) {
    throw new Error("A sessão precisa ter pelo menos um bloco.");
  }

  return blocks.map((block, blockIndex) => {
    const blockLabel = `Bloco ${blockIndex + 1}`;
    const name = requiredText(block.name, `${blockLabel}: nome do bloco`);
    const details = buildBlockDetails(block, blockLabel);

    // Categorias de texto livre não têm exercícios: o conteúdo do bloco vive em details.
    if (blockLayout(block.kind) === "free-text") {
      return { name, kind: block.kind, details, items: [] };
    }

    if (block.items.length === 0) {
      throw new Error(`${blockLabel} precisa ter pelo menos um exercício.`);
    }

    return {
      name,
      kind: block.kind,
      details,
      items: block.items.map((item, itemIndex) => {
        const itemLabel = `${blockLabel} · exercício ${itemIndex + 1}`;
        const exerciseName = requiredText(item.exerciseName, `${itemLabel}: exercício`);
        const exerciseSlug = slugify(exerciseName);

        // Ginástica não tem séries: a prescrição é só o texto livre do coach.
        if (exerciseCategoryIsQualitative(item.category)) {
          return {
            exerciseSlug,
            exerciseName,
            exerciseCategory: item.category ?? undefined,
            prescription: {
              kind: "qualitative",
              notes: requiredText(item.notes, `${itemLabel}: descrição`)
            }
          };
        }

        const restSeconds = optionalNumber(item.restSeconds, `${itemLabel}: descanso`);

        if (item.sets.length === 0) {
          throw new Error(`${itemLabel} precisa ter pelo menos uma série.`);
        }

        const sets = item.sets.map((set, setIndex) =>
          buildSetPayload(set, `${itemLabel} · série ${setIndex + 1}`)
        );

        return {
          exerciseSlug,
          exerciseName,
          exerciseCategory: item.category ?? undefined,
          prescription: {
            kind: "sets-reps",
            ...(restSeconds === undefined ? {} : { rest_seconds: restSeconds }),
            sets
          }
        };
      })
    };
  });
}

export function buildCoachSessionPayload(form: CoachSessionForm): PrescribeSessionRequest {
  const teamId = requiredText(form.teamId, "Equipe");
  const title = requiredText(form.title, "Título da sessão");
  const scheduledDate = requiredText(form.scheduledDate, "Data");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    throw new Error("Use a data no formato AAAA-MM-DD.");
  }

  const parsedDate = new Date(`${scheduledDate}T12:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== scheduledDate) {
    throw new Error("Informe uma data válida.");
  }

  const blocks = buildBlocksPayload(form.blocks);

  return { teamId, title, scheduledDate, status: form.status, coachNote: form.coachNote.trim(), blocks };
}

/**
 * Resolve a categoria de um bloco vindo do banco.
 * Blocos legados e blocos de texto livre gravados antes desta versão (sem descrição, mas com
 * exercícios) caem em Força, que preserva a lista de exercícios e séries.
 */
function toBlockKind(value: unknown, hasDescription: boolean, hasItems: boolean): BlockKind {
  const kind = asString(value, legacyBlockKindFallback);

  if ((legacyBlockKinds as readonly string[]).includes(kind)) return legacyBlockKindFallback;
  if (!(blockKinds as readonly string[]).includes(kind)) return legacyBlockKindFallback;

  const resolved = kind as BlockKind;

  if (blockLayout(resolved) === "free-text" && !hasDescription && hasItems) {
    return legacyBlockKindFallback;
  }

  return resolved;
}

function toRepsText(set: Record<string, unknown>): string {
  if (typeof set.reps === "number") return String(set.reps);
  if (typeof set.reps_min === "number" && typeof set.reps_max === "number") {
    return `${set.reps_min}-${set.reps_max}`;
  }
  return "";
}

function toLoadText(set: Record<string, unknown>): string {
  return typeof set.load_value === "number" ? String(set.load_value) : "";
}

function toLoadType(set: Record<string, unknown>): LoadType {
  return set.load_type === "fixed" ? "fixed" : "percentage-1rm";
}

function toSetForm(set: Record<string, unknown>): PrescriptionSetForm {
  return createSetForm({ reps: toRepsText(set), load: toLoadText(set), loadType: toLoadType(set) });
}

function toScoreType(value: unknown): BlockScoreType {
  const scoreType = asString(value, "time");
  return (blockScoreTypes as readonly string[]).includes(scoreType) ? (scoreType as BlockScoreType) : "time";
}

function toVolumeUnit(value: unknown, modality: EnduranceModality): VolumeUnit {
  const unit = asString(value, "");
  if ((volumeUnits as readonly string[]).includes(unit)) return unit as VolumeUnit;
  return modality === "bike" ? "min" : "m";
}

function toRankingForm(details: Record<string, unknown>): BlockRankingForm {
  const ranking = isRecord(details.ranking) ? details.ranking : {};

  return {
    enabled: ranking.enabled === true,
    scoreType: toScoreType(ranking.score_type)
  };
}

function toVolumeForms(details: Record<string, unknown>): EnduranceVolumeForm[] {
  const volumes = Array.isArray(details.volumes) ? details.volumes.filter(isRecord) : [];

  return createEnduranceVolumes(
    volumes.flatMap((volume) => {
      const modality = asString(volume.modality, "");

      if (!(enduranceModalities as readonly string[]).includes(modality)) return [];

      const typedModality = modality as EnduranceModality;

      return [
        {
          modality: typedModality,
          enabled: true,
          volume: typeof volume.value === "number" ? String(volume.value) : "",
          unit: toVolumeUnit(volume.unit, typedModality)
        }
      ];
    })
  );
}

/**
 * Hidrata blocos de formulário a partir de um snapshot/conteúdo de template (jsonb do banco).
 * Reaproveitado pelo editor de calendário e pelo editor de biblioteca — cada nível é validado
 * antes de virar formulário, já que o valor vem de fora do TypeScript.
 */
export function toBlockFormsFromSnapshot(snapshot: Record<string, unknown>): BlockForm[] {
  const snapshotBlocks = Array.isArray(snapshot.blocks) ? snapshot.blocks.filter(isRecord) : [];

  const blocks = snapshotBlocks.map((block) => {
    const snapshotItems = Array.isArray(block.items) ? block.items.filter(isRecord) : [];
    const details = isRecord(block.details) ? block.details : {};
    const description = asString(details.description, "");
    const kind = toBlockKind(block.kind, description !== "", snapshotItems.length > 0);
    const detailSets = Array.isArray(details.sets) ? details.sets.filter(isRecord) : [];

    return createBlockForm({
      name: asString(block.name, "Bloco de treino"),
      kind,
      description,
      ranking: toRankingForm(details),
      sets: detailSets.length === 0 ? [createSetForm()] : detailSets.map(toSetForm),
      volumes: toVolumeForms(details),
      items: snapshotItems.length === 0
        ? [createItemForm()]
        : snapshotItems.map((item) => {
            const prescription = isRecord(item.prescription) ? item.prescription : {};
            const isQualitative = prescription.kind === "qualitative";
            const snapshotSets = Array.isArray(prescription.sets) ? prescription.sets.filter(isRecord) : [];

            return createItemForm({
              exerciseName: asString(item.exercise_name, ""),
              // Categoria original de sets-reps não sobrevive no snapshot; null renderiza igual
              // (reps + carga), a única diferença de comportamento é Ginástica x resto.
              category: isQualitative ? "ginastica" : null,
              restSeconds:
                typeof prescription.rest_seconds === "number" ? String(prescription.rest_seconds) : "",
              sets: isQualitative
                ? []
                : snapshotSets.length === 0
                  ? [createSetForm()]
                  : snapshotSets.map(toSetForm),
              notes: isQualitative ? asString(prescription.notes, "") : ""
            });
          })
    });
  });

  return blocks.length === 0 ? [createBlockForm()] : blocks;
}

/**
 * Hidrata o editor a partir do snapshot de uma sessão já publicada.
 * O snapshot vem do banco como jsonb, então cada nível é validado antes de virar formulário.
 */
export function toCoachSessionForm(session: CalendarSessionRecord): CoachSessionForm {
  const snapshot = isRecord(session.snapshot) ? session.snapshot : {};

  return {
    teamId: session.team_id,
    title: asString(snapshot.title, ""),
    scheduledDate: session.scheduled_date,
    status: session.status,
    coachNote: session.coach_note ?? "",
    blocks: toBlockFormsFromSnapshot(snapshot)
  };
}
