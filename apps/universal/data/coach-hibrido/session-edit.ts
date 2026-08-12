/** Ponte entre o snapshot congelado e o formulário de edição. */
import type { CalendarSessionRecord } from "@fitblock/backend";
import { createBlockForm, createInitialSessionForm, type BlockForm, type SessionForm } from "@/data/coach-hibrido/session-form";
import {
  getSessionTitle,
  readSessionBlocks,
  readTemplateBlocks,
  type HybridBlock
} from "@/data/coach-hibrido/session-snapshot";
import { blockDefinition } from "@/data/coach-hibrido/blocks";

function toBlockForm(block: HybridBlock): BlockForm {
  const definition = blockDefinition(block.kind);

  return {
    ...createBlockForm(block.kind, {
      name: block.name,
      body: block.body,
      protocol: block.protocol
        ? {
            type: block.protocol.type,
            timeCapMinutes: block.protocol.timeCapMinutes?.toString() ?? "",
            durationMinutes: block.protocol.durationMinutes?.toString() ?? "",
            rounds: block.protocol.rounds?.toString() ?? "",
            workSeconds: block.protocol.workSeconds?.toString() ?? "",
            restSeconds: block.protocol.restSeconds?.toString() ?? ""
          }
        : definition.protocol
          ? undefined
          : null,
      ranking: block.ranking
        ? { enabled: true, scoreType: block.ranking.scoreType }
        : undefined,
      // Só o volume digitado volta como manual; o automático se recalcula do texto.
      volume:
        block.volume?.source === "manual"
          ? { mode: "manual", sets: String(block.volume.sets), reps: String(block.volume.reps) }
          : { mode: "auto", sets: "", reps: "" },
      enduranceVolumes: block.enduranceVolumes.map((volume) => ({
        modality: volume.modality,
        enabled: true,
        value: String(volume.value),
        unit: volume.unit
      }))
    })
  };
}

export function toSessionForm(session: CalendarSessionRecord): SessionForm {
  return {
    teamId: session.team_id,
    title: getSessionTitle(session),
    scheduledDate: session.scheduled_date,
    status: session.status,
    coachNote: session.coach_note ?? "",
    blocks: readSessionBlocks(session).map(toBlockForm)
  };
}

/** Treino da biblioteca aberto no compositor: sem equipe e sem data até o coach aplicar. */
export function toTemplateForm(
  title: string,
  status: "draft" | "published",
  blocks: Record<string, unknown>[],
  teamId = ""
): SessionForm {
  return {
    ...createInitialSessionForm(teamId),
    title,
    status,
    blocks: readTemplateBlocks(blocks).map(toBlockForm)
  };
}
