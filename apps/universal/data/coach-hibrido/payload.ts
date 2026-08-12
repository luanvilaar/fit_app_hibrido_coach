/**
 * Do formulário para o banco.
 *
 * O texto do bloco vai em `details.body`; os movimentos mencionados viram `items[]`,
 * que é o que dá ao atleta o nome e o vídeo de cada movimento. `schema_version: 3`
 * marca a prescrição Coach Híbrido e separa do formato estruturado anterior.
 */
import type {
  CreateSessionTemplateRequest,
  ExerciseRecord,
  PrescribeSessionRequest,
  UpdateSessionRequest,
  UpdateSessionTemplateRequest
} from "@fitblock/backend";
import {
  blockDefinition,
  enduranceModalityLabels,
  protocolLabels,
  rankingRequired,
  supportsRanking
} from "@/data/coach-hibrido/blocks";
import { collectMentions } from "@/data/coach-hibrido/mentions";
import type { BlockForm, SessionForm } from "@/data/coach-hibrido/session-form";
import { resolveBlockVolume } from "@/data/coach-hibrido/session-form";
import { optionalPositiveNumber, positiveInteger, requiredText } from "@/data/coach-hibrido/text";

export const PRESCRIPTION_SCHEMA_VERSION = 3;

type BlocksPayload = CreateSessionTemplateRequest["blocks"];

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function buildProtocolPayload(block: BlockForm, label: string): Record<string, unknown> {
  const protocol = block.protocol;
  if (!protocol) throw new Error(`${label}: escolha uma dinâmica de tempo.`);

  const name = `${label} · ${protocolLabels[protocol.type]}`;

  if (protocol.type === "for-time") {
    const timeCap = optionalPositiveNumber(protocol.timeCapMinutes, `${name}: limite de tempo`);
    return { type: protocol.type, ...(timeCap === undefined ? {} : { time_cap_minutes: timeCap }) };
  }

  if (protocol.type === "amrap") {
    return {
      type: protocol.type,
      duration_minutes: positiveInteger(protocol.durationMinutes, `${name}: duração em minutos`)
    };
  }

  if (protocol.type === "emom") {
    const duration = optionalPositiveNumber(protocol.durationMinutes, `${name}: duração`);
    const rounds = protocol.rounds.trim()
      ? positiveInteger(protocol.rounds, `${name}: rounds`)
      : undefined;

    if (duration === undefined && rounds === undefined) {
      throw new Error(`${name}: informe a duração ou o número de rounds.`);
    }

    return {
      type: protocol.type,
      ...(duration === undefined ? {} : { duration_minutes: duration }),
      ...(rounds === undefined ? {} : { rounds })
    };
  }

  return {
    type: protocol.type,
    rounds: positiveInteger(protocol.rounds, `${name}: rounds`),
    work_seconds: positiveInteger(protocol.workSeconds, `${name}: tempo de trabalho`),
    rest_seconds: positiveInteger(protocol.restSeconds, `${name}: tempo de descanso`)
  };
}

function buildDetails(block: BlockForm, label: string): Record<string, unknown> {
  const definition = blockDefinition(block.kind);
  const details: Record<string, unknown> = {
    schema_version: PRESCRIPTION_SCHEMA_VERSION,
    body: block.body.trim()
  };

  if (definition.protocol) details.protocol = buildProtocolPayload(block, label);

  if (supportsRanking(block.kind) && (block.ranking.enabled || rankingRequired(block.kind))) {
    details.ranking = { enabled: true, score_type: block.ranking.scoreType };
  }

  if (definition.strengthVolume) {
    const volume = resolveBlockVolume(block);

    if (volume.source === "manual") {
      details.volume = {
        sets: positiveInteger(block.volume.sets, `${label}: volume total de séries`),
        reps: positiveInteger(block.volume.reps, `${label}: volume total de repetições`),
        source: "manual"
      };
    } else if (volume.source === "auto") {
      details.volume = { sets: volume.sets, reps: volume.reps, source: "auto" };
    }
  }

  if (definition.enduranceVolume) {
    const enabled = block.enduranceVolumes.filter((volume) => volume.enabled);

    if (enabled.length === 0) {
      throw new Error(`${label}: escolha ao menos uma modalidade de endurance.`);
    }

    details.volumes = enabled.map((volume) => ({
      modality: volume.modality,
      value: positiveInteger(volume.value, `${label} · ${enduranceModalityLabels[volume.modality]}`),
      unit: volume.unit
    }));
  }

  return details;
}

export function buildBlocksPayload(blocks: BlockForm[], catalog: ExerciseRecord[]): BlocksPayload {
  if (blocks.length === 0) throw new Error("A sessão precisa de pelo menos um bloco.");

  return blocks.map((block, index) => {
    const label = `Bloco ${index + 1} · ${blockDefinition(block.kind).label}`;

    if (!block.body.trim()) throw new Error(`${label}: escreva o treino deste bloco.`);

    return {
      name: requiredText(block.name, `${label}: nome`),
      kind: block.kind,
      details: buildDetails(block, label),
      items: collectMentions(block.body, catalog).map((movement) => ({
        exerciseSlug: movement.slug,
        exerciseName: movement.name,
        exerciseCategory: movement.category ?? undefined,
        prescription: { kind: "reference" }
      }))
    };
  });
}

function requireDate(value: string): string {
  const date = requiredText(value, "Data da sessão");
  if (!isoDate.test(date)) throw new Error("Data da sessão precisa estar no formato AAAA-MM-DD.");
  return date;
}

export function buildSessionPayload(
  form: SessionForm,
  catalog: ExerciseRecord[]
): PrescribeSessionRequest {
  return {
    title: requiredText(form.title, "Título da sessão"),
    teamId: requiredText(form.teamId, "Equipe"),
    scheduledDate: requireDate(form.scheduledDate),
    status: form.status,
    coachNote: form.coachNote.trim(),
    blocks: buildBlocksPayload(form.blocks, catalog)
  };
}

export function buildUpdateSessionPayload(
  sessionId: string,
  form: SessionForm,
  catalog: ExerciseRecord[]
): UpdateSessionRequest {
  const { teamId: _teamId, ...payload } = buildSessionPayload(form, catalog);
  return { sessionId, ...payload };
}

export function buildTemplatePayload(
  form: SessionForm,
  catalog: ExerciseRecord[]
): CreateSessionTemplateRequest {
  return {
    title: requiredText(form.title, "Título do treino"),
    status: form.status,
    blocks: buildBlocksPayload(form.blocks, catalog)
  };
}

export function buildUpdateTemplatePayload(
  templateId: string,
  form: SessionForm,
  catalog: ExerciseRecord[]
): UpdateSessionTemplateRequest {
  return { templateId, ...buildTemplatePayload(form, catalog) };
}

/** Mensagem do erro do backend em português, sem vazar detalhe de RLS. */
export function describePrescriptionError(error: unknown): string {
  if (error instanceof Error && /permission|not authorized|unauthorized|rls/i.test(error.message)) {
    return "Você não tem permissão para esta operação.";
  }

  return error instanceof Error ? error.message : "Não foi possível salvar a prescrição.";
}
