/**
 * Modelo de edição de uma sessão Coach Híbrido.
 *
 * Tudo aqui é função pura sobre o formulário: a tela só guarda o estado e chama estas
 * transformações. A ordem dos blocos é significativa — é a ordem em que o atleta treina.
 */
import type { ExerciseRecord } from "@fitblock/backend";
import {
  blockDefinition,
  defaultVolumeUnit,
  enduranceModalities,
  rankingRequired,
  suggestedScoreType,
  supportsRanking,
  type BlockKind,
  type EnduranceModality,
  type ProtocolType,
  type ScoreType,
  type VolumeUnit
} from "@/data/coach-hibrido/blocks";
import { collectMentions } from "@/data/coach-hibrido/mentions";
import { estimateVolume } from "@/data/coach-hibrido/volume";

export type SessionStatus = "draft" | "published";

export type BlockProtocolForm = {
  type: ProtocolType;
  timeCapMinutes: string;
  durationMinutes: string;
  rounds: string;
  workSeconds: string;
  restSeconds: string;
};

export type BlockRankingForm = {
  enabled: boolean;
  scoreType: ScoreType;
};

/** `auto` soma o texto; `manual` congela o número que o coach digitou. */
export type StrengthVolumeForm = {
  mode: "auto" | "manual";
  sets: string;
  reps: string;
};

export type EnduranceVolumeForm = {
  modality: EnduranceModality;
  enabled: boolean;
  value: string;
  unit: VolumeUnit;
};

export type BlockForm = {
  id: string;
  kind: BlockKind;
  name: string;
  body: string;
  protocol: BlockProtocolForm | null;
  ranking: BlockRankingForm;
  volume: StrengthVolumeForm;
  enduranceVolumes: EnduranceVolumeForm[];
};

export type SessionForm = {
  teamId: string;
  title: string;
  scheduledDate: string;
  status: SessionStatus;
  coachNote: string;
  blocks: BlockForm[];
};

let sequence = 0;
function createId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function createProtocolForm(type: ProtocolType = "for-time"): BlockProtocolForm {
  return { type, timeCapMinutes: "", durationMinutes: "", rounds: "", workSeconds: "", restSeconds: "" };
}

export function createEnduranceVolumes(saved: EnduranceVolumeForm[] = []): EnduranceVolumeForm[] {
  return enduranceModalities.map((modality) => {
    const previous = saved.find((volume) => volume.modality === modality);

    return {
      modality,
      enabled: previous?.enabled ?? false,
      value: previous?.value ?? "",
      unit: previous?.unit ?? defaultVolumeUnit(modality)
    };
  });
}

export function createBlockForm(
  kind: BlockKind,
  overrides: Partial<Omit<BlockForm, "id" | "kind">> = {}
): BlockForm {
  const definition = blockDefinition(kind);
  const protocol = overrides.protocol ?? (definition.protocol ? createProtocolForm() : null);

  return {
    id: createId("block"),
    kind,
    name: overrides.name ?? definition.label,
    body: overrides.body ?? "",
    protocol,
    ranking: overrides.ranking ?? {
      enabled: rankingRequired(kind),
      scoreType: suggestedScoreType(kind, protocol?.type ?? null)
    },
    volume: overrides.volume ?? { mode: "auto", sets: "", reps: "" },
    enduranceVolumes: createEnduranceVolumes(overrides.enduranceVolumes ?? [])
  };
}

/** Amanhã como data padrão: prescrever para hoje é a exceção, não a regra. */
export function createInitialSessionForm(teamId = ""): SessionForm {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  return { teamId, title: "", scheduledDate: date, status: "published", coachNote: "", blocks: [] };
}

/* ------------------------------------------------------------------ reducers */

export function updateSessionField<
  Field extends keyof Pick<SessionForm, "teamId" | "title" | "scheduledDate" | "status" | "coachNote">
>(form: SessionForm, field: Field, value: SessionForm[Field]): SessionForm {
  return { ...form, [field]: value };
}

export function addBlock(form: SessionForm, kind: BlockKind): SessionForm {
  return { ...form, blocks: [...form.blocks, createBlockForm(kind)] };
}

export function removeBlock(form: SessionForm, blockId: string): SessionForm {
  return { ...form, blocks: form.blocks.filter((block) => block.id !== blockId) };
}

/** Move o bloco uma posição; fora dos limites devolve o formulário intacto. */
export function moveBlock(form: SessionForm, blockId: string, direction: -1 | 1): SessionForm {
  const index = form.blocks.findIndex((block) => block.id === blockId);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= form.blocks.length) return form;

  const blocks = [...form.blocks];
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];

  return { ...form, blocks };
}

export function updateBlock(
  form: SessionForm,
  blockId: string,
  patch: Partial<Pick<BlockForm, "name" | "body">>
): SessionForm {
  return {
    ...form,
    blocks: form.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block))
  };
}

/**
 * Trocar a categoria preserva o que o coach escreveu e o nome, se ele o personalizou.
 * O resto vira o padrão da nova categoria, porque protocolo e ranking não se traduzem.
 */
export function changeBlockKind(form: SessionForm, blockId: string, kind: BlockKind): SessionForm {
  return {
    ...form,
    blocks: form.blocks.map((block) => {
      if (block.id !== blockId) return block;

      const renamed = block.name !== blockDefinition(block.kind).label;

      return {
        ...createBlockForm(kind, {
          body: block.body,
          name: renamed ? block.name : undefined,
          volume: block.volume,
          enduranceVolumes: block.enduranceVolumes
        }),
        id: block.id
      };
    })
  };
}

export function updateBlockProtocol(
  form: SessionForm,
  blockId: string,
  patch: Partial<BlockProtocolForm>
): SessionForm {
  return {
    ...form,
    blocks: form.blocks.map((block) => {
      if (block.id !== blockId) return block;

      const protocol = { ...(block.protocol ?? createProtocolForm()), ...patch };
      // Trocar o protocolo reajusta o placar sugerido; trocar um tempo não mexe no ranking.
      const ranking =
        patch.type !== undefined && supportsRanking(block.kind)
          ? { ...block.ranking, scoreType: suggestedScoreType(block.kind, protocol.type) }
          : block.ranking;

      return { ...block, protocol, ranking };
    })
  };
}

export function updateBlockRanking(
  form: SessionForm,
  blockId: string,
  patch: Partial<BlockRankingForm>
): SessionForm {
  return {
    ...form,
    blocks: form.blocks.map((block) =>
      block.id === blockId ? { ...block, ranking: { ...block.ranking, ...patch } } : block
    )
  };
}

export function updateBlockVolume(
  form: SessionForm,
  blockId: string,
  patch: Partial<StrengthVolumeForm>
): SessionForm {
  return {
    ...form,
    blocks: form.blocks.map((block) =>
      block.id === blockId ? { ...block, volume: { ...block.volume, ...patch } } : block
    )
  };
}

/** Volta o volume ao cálculo automático, descartando o número digitado. */
export function resetBlockVolume(form: SessionForm, blockId: string): SessionForm {
  return updateBlockVolume(form, blockId, { mode: "auto", sets: "", reps: "" });
}

export function updateEnduranceVolume(
  form: SessionForm,
  blockId: string,
  modality: EnduranceModality,
  patch: Partial<Omit<EnduranceVolumeForm, "modality">>
): SessionForm {
  return {
    ...form,
    blocks: form.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            enduranceVolumes: block.enduranceVolumes.map((volume) =>
              volume.modality === modality ? { ...volume, ...patch } : volume
            )
          }
        : block
    )
  };
}

/* -------------------------------------------------------------------- leitura */

export type ResolvedVolume = {
  sets: number;
  reps: number;
  source: "auto" | "manual" | "none";
};

/** O número que a interface mostra: o digitado quando existe, senão o lido do texto. */
export function resolveBlockVolume(block: BlockForm): ResolvedVolume {
  if (!blockDefinition(block.kind).strengthVolume) return { sets: 0, reps: 0, source: "none" };

  if (block.volume.mode === "manual") {
    return {
      sets: Number(block.volume.sets) || 0,
      reps: Number(block.volume.reps) || 0,
      source: "manual"
    };
  }

  const estimate = estimateVolume(block.body);

  return estimate.matchedLines > 0
    ? { sets: estimate.sets, reps: estimate.reps, source: "auto" }
    : { sets: 0, reps: 0, source: "none" };
}

export type SessionSummary = {
  blocks: number;
  movements: number;
  ranked: number;
};

export function summarizeSession(form: SessionForm, catalog: ExerciseRecord[]): SessionSummary {
  const movements = new Set<string>();

  form.blocks.forEach((block) => {
    collectMentions(block.body, catalog).forEach((movement) => movements.add(movement.slug));
  });

  return {
    blocks: form.blocks.length,
    movements: movements.size,
    ranked: form.blocks.filter((block) => supportsRanking(block.kind) && block.ranking.enabled).length
  };
}

export function cloneSessionForm(form: SessionForm, overrides: Partial<SessionForm> = {}): SessionForm {
  return {
    ...form,
    ...overrides,
    blocks: (overrides.blocks ?? form.blocks).map((block) => ({
      ...block,
      id: createId("block"),
      protocol: block.protocol ? { ...block.protocol } : null,
      ranking: { ...block.ranking },
      volume: { ...block.volume },
      enduranceVolumes: block.enduranceVolumes.map((volume) => ({ ...volume }))
    }))
  };
}
