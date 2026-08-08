import type {
  CreateSessionTemplateRequest,
  SessionTemplateContent,
  UpdateSessionTemplateRequest
} from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import {
  addBlockSetToList,
  addBlockToList,
  addItemToList,
  addSetToList,
  buildBlocksPayload,
  createBlockForm,
  removeBlockFromList,
  removeBlockSetFromList,
  removeItemFromList,
  removeSetFromList,
  requiredText,
  summarizeBlocks,
  toBlockFormsFromSnapshot,
  updateBlockInList,
  updateBlockRankingInList,
  updateBlockSetInList,
  updateBlockVolumeInList,
  updateItemInList,
  updateSetInList,
  type BlockForm,
  type BlockPatch,
  type BlockRankingForm,
  type CoachSessionSummary,
  type EnduranceModality,
  type EnduranceVolumeForm,
  type ItemPatch,
  type SessionStatus,
  type SetPatch
} from "@/data/coach-calendar";

/**
 * Formulário de um treino da biblioteca: mesmos blocos/exercícios/séries do editor de calendário,
 * sem equipe, data ou recado — um treino de biblioteca não é, por si só, uma prescrição.
 */
export type LibraryTemplateForm = {
  title: string;
  status: SessionStatus;
  blocks: BlockForm[];
};

export function createInitialLibraryForm(): LibraryTemplateForm {
  return { title: "", status: "draft", blocks: [createBlockForm()] };
}

export function updateLibraryField<Field extends "title" | "status">(
  form: LibraryTemplateForm,
  field: Field,
  value: LibraryTemplateForm[Field]
): LibraryTemplateForm {
  return { ...form, [field]: value };
}

export function addLibraryBlock(form: LibraryTemplateForm): LibraryTemplateForm {
  return { ...form, blocks: addBlockToList(form.blocks) };
}

export function removeLibraryBlock(form: LibraryTemplateForm, blockId: string): LibraryTemplateForm {
  return { ...form, blocks: removeBlockFromList(form.blocks, blockId) };
}

export function updateLibraryBlock(
  form: LibraryTemplateForm,
  blockId: string,
  patch: BlockPatch
): LibraryTemplateForm {
  return { ...form, blocks: updateBlockInList(form.blocks, blockId, patch) };
}

export function updateLibraryBlockRanking(
  form: LibraryTemplateForm,
  blockId: string,
  patch: Partial<BlockRankingForm>
): LibraryTemplateForm {
  return { ...form, blocks: updateBlockRankingInList(form.blocks, blockId, patch) };
}

export function updateLibraryBlockVolume(
  form: LibraryTemplateForm,
  blockId: string,
  modality: EnduranceModality,
  patch: Partial<Omit<EnduranceVolumeForm, "modality">>
): LibraryTemplateForm {
  return { ...form, blocks: updateBlockVolumeInList(form.blocks, blockId, modality, patch) };
}

export function addLibraryBlockSet(form: LibraryTemplateForm, blockId: string): LibraryTemplateForm {
  return { ...form, blocks: addBlockSetToList(form.blocks, blockId) };
}

export function removeLibraryBlockSet(
  form: LibraryTemplateForm,
  blockId: string,
  setId: string
): LibraryTemplateForm {
  return { ...form, blocks: removeBlockSetFromList(form.blocks, blockId, setId) };
}

export function updateLibraryBlockSet(
  form: LibraryTemplateForm,
  blockId: string,
  setId: string,
  patch: SetPatch
): LibraryTemplateForm {
  return { ...form, blocks: updateBlockSetInList(form.blocks, blockId, setId, patch) };
}

export function addLibraryItem(form: LibraryTemplateForm, blockId: string): LibraryTemplateForm {
  return { ...form, blocks: addItemToList(form.blocks, blockId) };
}

export function removeLibraryItem(form: LibraryTemplateForm, blockId: string, itemId: string): LibraryTemplateForm {
  return { ...form, blocks: removeItemFromList(form.blocks, blockId, itemId) };
}

export function updateLibraryItem(
  form: LibraryTemplateForm,
  blockId: string,
  itemId: string,
  patch: ItemPatch
): LibraryTemplateForm {
  return { ...form, blocks: updateItemInList(form.blocks, blockId, itemId, patch) };
}

export function addLibrarySet(form: LibraryTemplateForm, blockId: string, itemId: string): LibraryTemplateForm {
  return { ...form, blocks: addSetToList(form.blocks, blockId, itemId) };
}

export function removeLibrarySet(
  form: LibraryTemplateForm,
  blockId: string,
  itemId: string,
  setId: string
): LibraryTemplateForm {
  return { ...form, blocks: removeSetFromList(form.blocks, blockId, itemId, setId) };
}

export function updateLibrarySet(
  form: LibraryTemplateForm,
  blockId: string,
  itemId: string,
  setId: string,
  patch: SetPatch
): LibraryTemplateForm {
  return { ...form, blocks: updateSetInList(form.blocks, blockId, itemId, setId, patch) };
}

export function summarizeLibraryForm(form: LibraryTemplateForm): CoachSessionSummary {
  return summarizeBlocks(form.blocks);
}

export function buildCreateTemplatePayload(form: LibraryTemplateForm): CreateSessionTemplateRequest {
  return {
    title: requiredText(form.title, "Título do treino"),
    status: form.status,
    blocks: buildBlocksPayload(form.blocks)
  };
}

export function buildUpdateTemplatePayload(
  templateId: string,
  form: LibraryTemplateForm
): UpdateSessionTemplateRequest {
  return {
    templateId,
    title: requiredText(form.title, "Título do treino"),
    status: form.status,
    blocks: buildBlocksPayload(form.blocks)
  };
}

/** Título sugerido ao duplicar um treino já existente da biblioteca. */
export function buildDuplicateTitle(title: string): string {
  return `${title} (cópia)`;
}

/** Hidrata o editor a partir do conteúdo de um template (get_session_template_content). */
export function toLibraryForm(content: SessionTemplateContent): LibraryTemplateForm {
  return {
    title: content.title,
    status: content.status,
    blocks: toBlockFormsFromSnapshot(content)
  };
}

export function describeLibraryBackendError(error: unknown): string {
  return describeBackendError(error);
}
