/**
 * Leitura do snapshot congelado da sessão.
 *
 * Uma sessão aplicada guarda uma cópia imutável da prescrição, então este módulo lê os
 * dois formatos: `schema_version: 3` (Coach Híbrido, texto livre) e as prescrições
 * estruturadas anteriores, que viram texto equivalente para não sumirem da tela do atleta.
 */
import type { CalendarSessionRecord } from "@fitblock/backend";
import {
  blockDefinition,
  enduranceModalityLabels,
  isBlockKind,
  isScoreType,
  protocolLabels,
  protocolTypes,
  volumeUnits,
  type BlockKind,
  type EnduranceModality,
  type ProtocolType,
  type ScoreType,
  type VolumeUnit
} from "@/data/coach-hibrido/blocks";
import type { BlockMovement } from "@/data/coach-hibrido/mentions";
import { slugify } from "@/data/coach-hibrido/text";

export type BlockProtocol = {
  type: ProtocolType;
  timeCapMinutes: number | null;
  durationMinutes: number | null;
  rounds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
};

export type BlockRanking = { enabled: true; scoreType: ScoreType };

export type BlockVolume = { sets: number; reps: number; source: "auto" | "manual" };

export type EnduranceVolume = { modality: EnduranceModality; value: number; unit: VolumeUnit };

export type HybridBlock = {
  id: string;
  kind: BlockKind;
  name: string;
  /** O treino como o coach escreveu, com menções `@Movimento` no meio do texto. */
  body: string;
  movements: BlockMovement[];
  protocol: BlockProtocol | null;
  ranking: BlockRanking | null;
  volume: BlockVolume | null;
  enduranceVolumes: EnduranceVolume[];
};

type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function getSessionTitle(session: CalendarSessionRecord): string {
  const title = isRecord(session.snapshot) ? session.snapshot.title : undefined;
  return asString(title, "Sessão FitBlock");
}

function readProtocol(value: unknown): BlockProtocol | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (!(protocolTypes as readonly string[]).includes(value.type)) return null;

  return {
    type: value.type as ProtocolType,
    timeCapMinutes: asNumber(value.time_cap_minutes),
    durationMinutes: asNumber(value.duration_minutes),
    rounds: asNumber(value.rounds),
    workSeconds: asNumber(value.work_seconds),
    restSeconds: asNumber(value.rest_seconds)
  };
}

function readRanking(value: unknown): BlockRanking | null {
  if (!isRecord(value) || value.enabled !== true) return null;

  const scoreType = typeof value.score_type === "string" && isScoreType(value.score_type)
    ? value.score_type
    : "time";

  return { enabled: true, scoreType };
}

function readVolume(value: unknown): BlockVolume | null {
  if (!isRecord(value)) return null;

  const sets = asNumber(value.sets);
  const reps = asNumber(value.reps);
  if (sets === null || reps === null) return null;

  return { sets, reps, source: value.source === "manual" ? "manual" : "auto" };
}

function readEnduranceVolumes(value: unknown): EnduranceVolume[] {
  const volumes = Array.isArray(value) ? value.filter(isRecord) : [];

  return volumes.flatMap((volume) => {
    const modality = asString(volume.modality, "");
    const parsed = asNumber(volume.value);
    if (!modality || parsed === null) return [];

    const unit = asString(volume.unit, "m");

    return [
      {
        modality: modality as EnduranceModality,
        value: parsed,
        unit: (volumeUnits as readonly string[]).includes(unit) ? (unit as VolumeUnit) : "m"
      }
    ];
  });
}

function readMovements(items: unknown): BlockMovement[] {
  const list = Array.isArray(items) ? items.filter(isRecord) : [];

  return list.map((item, index) => {
    const name = asString(item.exercise_name, "Movimento");

    return {
      slug: asString(item.exercise_slug, slugify(name)),
      name,
      videoUrl: asNullableString(item.exercise_video_url),
      category: null,
      itemId: asString(item.id, `item-${index}`)
    };
  });
}

/* --------------------------------------------------- prescrições estruturadas */

function formatLegacySets(value: unknown): string {
  const sets = Array.isArray(value) ? value.filter(isRecord) : [];
  if (sets.length === 0) return "";

  const reps = sets.map((set) => {
    if (typeof set.reps === "number") return String(set.reps);
    if (typeof set.reps_min === "number" && typeof set.reps_max === "number") {
      return `${set.reps_min}-${set.reps_max}`;
    }
    return "—";
  });

  const loaded = sets.find((set) => typeof set.load_value === "number");
  const load = loaded
    ? loaded.load_type === "percentage-1rm"
      ? `${loaded.load_value}% 1RM`
      : `${loaded.load_value} kg`
    : "";

  return [`${sets.length} x ${[...new Set(reps)].join("/")}`, load].filter(Boolean).join(" · ");
}

/**
 * Converte uma prescrição estruturada antiga no texto equivalente. Sem isto, sessões
 * já prescritas abririam vazias depois da migração para o Coach Híbrido.
 */
function legacyBody(block: JsonRecord, details: JsonRecord): string {
  const lines: string[] = [];
  const description = asString(details.description, "");

  if (description) lines.push(description);

  const blockSets = formatLegacySets(details.sets);
  if (blockSets) lines.push(blockSets);

  const items = Array.isArray(block.items) ? block.items.filter(isRecord) : [];

  items.forEach((item) => {
    const name = asString(item.exercise_name, "Movimento");
    const prescription = isRecord(item.prescription) ? item.prescription : {};
    const sets = formatLegacySets(prescription.sets);
    const rest = asNumber(prescription.rest_seconds);
    const notes = asString(prescription.notes, "");

    if (lines.length > 0) lines.push("");
    lines.push(`@${name}`);
    if (sets) lines.push(sets);
    if (rest !== null) lines.push(`descanse ${rest}seg entre as séries.`);
    if (notes) lines.push(notes);
  });

  return lines.join("\n").trim();
}

/** Fonte única de parse do jsonb da sessão. */
export function readSessionBlocks(session: CalendarSessionRecord): HybridBlock[] {
  const snapshot = isRecord(session.snapshot) ? session.snapshot : {};
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];

  return blocks.filter(isRecord).map((block, index) => {
    const details = isRecord(block.details) ? block.details : {};
    const rawKind = asString(block.kind, "custom");
    const kind: BlockKind = isBlockKind(rawKind) ? rawKind : "strength";
    const body = asString(details.body, "") || legacyBody(block, details);

    return {
      id: asString(block.id, `block-${index}`),
      kind,
      name: asString(block.name, blockDefinition(kind).label),
      body,
      movements: readMovements(block.items),
      protocol: readProtocol(details.protocol),
      ranking: readRanking(details.ranking),
      volume: readVolume(details.volume),
      enduranceVolumes: readEnduranceVolumes(details.volumes)
    };
  });
}

/** Blocos de um treino da biblioteca, que usa o mesmo formato do snapshot. */
export function readTemplateBlocks(blocks: Record<string, unknown>[]): HybridBlock[] {
  return readSessionBlocks({ snapshot: { blocks } } as unknown as CalendarSessionRecord);
}

/* ----------------------------------------------------------------- formatação */

/** "AMRAP · 12 min" · "For time · limite 15 min" · "8 rounds · 40s / 20s" */
export function formatProtocol(protocol: BlockProtocol | null): string {
  if (!protocol) return "";

  const label = protocolLabels[protocol.type];

  if (protocol.type === "for-time") {
    return protocol.timeCapMinutes ? `${label} · limite ${protocol.timeCapMinutes} min` : label;
  }

  if (protocol.type === "amrap") {
    return protocol.durationMinutes ? `${label} · ${protocol.durationMinutes} min` : label;
  }

  if (protocol.type === "emom") {
    const parts = [
      protocol.durationMinutes ? `${protocol.durationMinutes} min` : "",
      protocol.rounds ? `${protocol.rounds} rounds` : ""
    ].filter(Boolean);

    return [label, ...parts].join(" · ");
  }

  const work = protocol.workSeconds ? `${protocol.workSeconds}s` : "";
  const rest = protocol.restSeconds ? `${protocol.restSeconds}s` : "";
  const cycle = work && rest ? `${work} / ${rest}` : work || rest;

  return [label, protocol.rounds ? `${protocol.rounds} rounds` : "", cycle].filter(Boolean).join(" · ");
}

/** "5 km de corrida · 2000 m de remo" */
export function formatEnduranceVolumes(volumes: EnduranceVolume[]): string {
  return volumes
    .map(
      (volume) =>
        `${volume.value} ${volume.unit} de ${enduranceModalityLabels[volume.modality].toLowerCase()}`
    )
    .join(" · ");
}

export function formatBlockVolume(volume: BlockVolume | null): string {
  if (!volume) return "";
  return `${volume.sets} ${volume.sets === 1 ? "série" : "séries"} · ${volume.reps} reps`;
}

/** Resumo de uma linha para o calendário e para a tela Hoje. */
export function describeBlock(block: HybridBlock): string {
  const firstLines = block.body
    .split("\n")
    // Tira só o `@` que abre uma menção; o de "5 x 2 @ 75%" faz parte da prescrição.
    .map((line) => line.replace(/@(?=\p{L})/gu, "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");

  const meta = [
    formatProtocol(block.protocol),
    formatEnduranceVolumes(block.enduranceVolumes),
    formatBlockVolume(block.volume)
  ]
    .filter(Boolean)
    .join(" · ");

  return [firstLines, meta].filter(Boolean).join(" — ") || "Sem prescrição";
}

/** Blocos pontuados da sessão, na ordem em que o atleta os encontra. */
export function rankedBlocks(blocks: HybridBlock[]): HybridBlock[] {
  return blocks.filter((block) => block.ranking !== null);
}
