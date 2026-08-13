/**
 * Cadastro de movimento no banco, feito de dentro da escrita do treino.
 *
 * O coach descobre que um movimento falta no exato momento em que digita `@` e não encontra —
 * então é ali que ele cadastra. Este módulo guarda as regras que o formulário e o banco
 * precisam concordar: o nome vira slug pela mesma normalização das menções, a categoria decide
 * o formato de prescrição do movimento, e o link, quando existe, é https (a constraint
 * `exercises_video_url_check` recusa qualquer outra coisa).
 */
import type { CreateExerciseRequest, ExerciseCategory, ExerciseRecord } from "@fitblock/backend";
import { findMovementByName } from "@/data/coach-hibrido/mentions";
import { slugify } from "@/data/coach-hibrido/text";

export type MovementDraft = {
  name: string;
  category: ExerciseCategory;
  /** Como o coach digitou; vazio significa "sem vídeo", nunca uma URL inválida. */
  videoUrl: string;
};

/** Rótulos das categorias do banco, na ordem em que o formulário as oferece. */
export const movementCategoryOptions: Array<{ value: ExerciseCategory; label: string }> = [
  { value: "forca-acessorios", label: "Força & Acessórios" },
  { value: "forca-lpo", label: "LPO" },
  { value: "ginastica", label: "Ginástica" }
];

/**
 * Força é o comportamento padrão de todo exercício sem categoria no banco (reps + carga);
 * partir dela é o palpite que erra menos e que o coach corrige com um toque.
 */
export const defaultMovementCategory: ExerciseCategory = "forca-acessorios";

/** `char_length(btrim(name)) >= 2` e `char_length(btrim(slug)) >= 2` vêm da própria tabela. */
const MIN_LENGTH = 2;

const HTTPS_LINK = /^https:\/\/\S+$/;

/**
 * O rascunho do formulário virando payload — ou um erro que o coach consegue resolver.
 * Duplicidade é checada aqui e não só no banco porque o slug repetido volta como violação de
 * constraint, e "duplicate key value violates unique constraint" não ensina nada a ninguém.
 */
export function buildCreateExerciseRequest(
  draft: MovementDraft,
  catalog: ExerciseRecord[]
): CreateExerciseRequest {
  const name = draft.name.trim().replace(/\s+/g, " ");

  if (name.length < MIN_LENGTH) {
    throw new Error("O nome do movimento precisa de pelo menos 2 caracteres.");
  }

  const slug = slugify(name);

  if (slug.length < MIN_LENGTH) {
    throw new Error("O nome precisa ter letras ou números.");
  }

  const existing =
    findMovementByName(catalog, name) ??
    catalog.find((exercise) => exercise.slug === slug) ??
    null;

  if (existing) {
    throw new Error(`“${existing.name}” já está no banco — escreva @${existing.name} para usar.`);
  }

  const videoUrl = draft.videoUrl.trim();

  if (videoUrl && !HTTPS_LINK.test(videoUrl)) {
    throw new Error("O link do vídeo precisa começar com https://.");
  }

  return { slug, name, category: draft.category, videoUrl: videoUrl || null };
}

/**
 * O catálogo em memória com o movimento recém-criado, na ordem alfabética que `listExercises`
 * entrega — a busca por `@` lê desta lista antes de qualquer ida ao banco.
 */
export function withMovement(
  catalog: ExerciseRecord[],
  created: ExerciseRecord
): ExerciseRecord[] {
  return [...catalog, created].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

/** O erro do Postgres em português de gente. */
export function describeMovementBankError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (/duplicate key|already exists|23505/i.test(message)) {
    return "Esse movimento já está no banco — recarregue a tela para encontrá-lo pelo @.";
  }

  if (/exercises_video_url_check/i.test(message)) {
    return "O link do vídeo precisa começar com https://.";
  }

  if (/row-level security|permission|not authorized|unauthorized|rls/i.test(message)) {
    return "Você não tem permissão para cadastrar movimentos.";
  }

  return message || "Não foi possível cadastrar o movimento.";
}
