/**
 * Menções de movimento dentro do texto do bloco.
 *
 * O coach digita `@` e escolhe um movimento do catálogo; o nome fica no texto como
 * `@Front Squat`. O vínculo com o catálogo é recalculado a partir do próprio texto,
 * então renomear a menção só desfaz o link — nunca deixa um vídeo órfão apontando
 * para um movimento que não está mais escrito ali.
 */
import type { ExerciseCategory, ExerciseRecord } from "@fitblock/backend";
import { foldName, slugify } from "@/data/coach-hibrido/text";

export type BlockMovement = {
  slug: string;
  name: string;
  videoUrl: string | null;
  category: ExerciseCategory | null;
  /** Id do item no snapshot congelado; `null` enquanto a menção só existe no editor. */
  itemId: string | null;
};

export type MentionQuery = {
  /** Índice do `@` que abriu a menção. */
  start: number;
  /** Posição do cursor; o trecho substituído é [start, end). */
  end: number;
  term: string;
};

/** Nome de movimento raramente passa de quatro palavras ("Dumbbell Side Plank Rotations"). */
const MAX_TERM_WORDS = 4;
const MAX_TERM_LENGTH = 48;

/**
 * Menção em digitação imediatamente antes do cursor, ou `null`.
 * Um `@` colado em palavra (e-mail, por exemplo) não abre menção.
 */
export function findMentionQuery(text: string, cursor: number): MentionQuery | null {
  const position = Math.max(0, Math.min(cursor, text.length));

  for (let index = position - 1; index >= 0; index -= 1) {
    const char = text[index];

    if (char === "\n") return null;
    if (char !== "@") continue;

    const previous = index > 0 ? text[index - 1] : "";
    if (previous && /[\w@]/.test(previous)) return null;

    const term = text.slice(index + 1, position);
    if (term.length > MAX_TERM_LENGTH) return null;
    if (term.trim().split(/\s+/).filter(Boolean).length > MAX_TERM_WORDS) return null;

    return { start: index, end: position, term };
  }

  return null;
}

/** Substitui o trecho em digitação pelo nome completo e devolve a posição do cursor. */
export function applyMention(
  text: string,
  query: MentionQuery,
  name: string
): { text: string; cursor: number } {
  const mention = `@${name} `;
  const next = `${text.slice(0, query.start)}${mention}${text.slice(query.end)}`;

  return { text: next, cursor: query.start + mention.length };
}

/**
 * Movimentos oferecidos para o termo digitado. Quem começa com o termo vem primeiro;
 * um termo que já é exatamente um movimento não sugere nada, porque a menção está pronta.
 */
export function suggestMovements(
  catalog: ExerciseRecord[],
  term: string,
  limit = 6
): ExerciseRecord[] {
  const needle = foldName(term);
  if (!needle) return catalog.slice(0, limit);
  if (catalog.some((exercise) => foldName(exercise.name) === needle)) return [];

  const matches = catalog.filter((exercise) => foldName(exercise.name).includes(needle));

  return matches
    .sort((left, right) => {
      const leftStarts = foldName(left.name).startsWith(needle);
      const rightStarts = foldName(right.name).startsWith(needle);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.name.localeCompare(right.name, "pt-BR");
    })
    .slice(0, limit);
}

export function toBlockMovement(exercise: ExerciseRecord): BlockMovement {
  return {
    slug: exercise.slug || slugify(exercise.name),
    name: exercise.name,
    videoUrl: exercise.video_url,
    category: exercise.category,
    itemId: null
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Varredura única sobre o texto, com o nome mais longo vencendo. Sem isso "@Front Squat"
 * casaria dentro de "@Front Squat Machine" e o bloco ganharia um movimento que não existe ali.
 */
function scanMentions<Item extends { name: string }>(
  body: string,
  items: Item[]
): Array<{ item: Item; start: number; length: number; text: string }> {
  const usable = items.filter((item) => item.name.trim());
  if (usable.length === 0 || !body.includes("@")) return [];

  const ordered = [...usable].sort((left, right) => right.name.length - left.name.length);
  const pattern = new RegExp(
    `@(?:${ordered.map((item) => escapeRegExp(item.name)).join("|")})(?![\\p{L}\\p{N}])`,
    "giu"
  );

  return [...body.matchAll(pattern)].flatMap((match) => {
    const text = match[0].slice(1);
    const item = ordered.find((candidate) => foldName(candidate.name) === foldName(text));

    return item ? [{ item, start: match.index ?? 0, length: match[0].length, text }] : [];
  });
}

/** Reduz o catálogo aos nomes que sequer aparecem no texto, antes de montar a alternância. */
function mentionCandidates<Item extends { name: string }>(body: string, items: Item[]): Item[] {
  const haystack = body.toLowerCase();
  return items.filter((item) => haystack.includes(`@${item.name.toLowerCase()}`));
}

/**
 * Movimentos do catálogo realmente escritos como `@Nome` no texto, na ordem em que aparecem.
 * É esta lista que vira `items[]` no banco e alimenta os links de vídeo do atleta.
 */
export function collectMentions(body: string, catalog: ExerciseRecord[]): BlockMovement[] {
  const found = new Map<string, BlockMovement>();

  scanMentions(body, mentionCandidates(body, catalog)).forEach(({ item }) => {
    const movement = toBlockMovement(item);
    if (!found.has(movement.slug)) found.set(movement.slug, movement);
  });

  return [...found.values()];
}

export type BodySegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; movement: BlockMovement };

/** Uma linha do texto quebrada em trechos comuns e menções, pronta para renderizar. */
export function splitBodyLine(line: string, movements: BlockMovement[]): BodySegment[] {
  const matches = scanMentions(line, mentionCandidates(line, movements));

  if (matches.length === 0) return line ? [{ type: "text", value: line }] : [];

  const segments: BodySegment[] = [];
  let cursor = 0;

  matches.forEach(({ item, start, length, text }) => {
    if (start < cursor) return;
    if (start > cursor) segments.push({ type: "text", value: line.slice(cursor, start) });

    segments.push({ type: "mention", value: text, movement: item });
    cursor = start + length;
  });

  if (cursor < line.length) segments.push({ type: "text", value: line.slice(cursor) });

  return segments;
}

/** O texto do bloco em linhas já segmentadas, pronto para renderizar. */
export function splitBody(body: string, movements: BlockMovement[]): BodySegment[][] {
  return body.split("\n").map((line) => splitBodyLine(line, movements));
}
