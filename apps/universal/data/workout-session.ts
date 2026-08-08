import type { AthleteSetResultRecord, CalendarSessionRecord } from "@fitblock/backend";
import { readSessionBlocks, type SnapshotItem, type SnapshotSet } from "@/data/calendar";

export type WorkoutSet = {
  setNumber: number;
  reps: string;
  kilograms: string;
  completed: boolean;
  /** Prescrição da série, exibida como alvo: "3-5 · 75% 1RM". */
  target: string;
};

export type WorkoutExercise = {
  itemId: string;
  blockId: string;
  blockName: string;
  name: string;
  videoUrl: string | null;
  targetSummary: string;
  restLabel: string;
  notes: string;
  /** Movimento de Ginástica: sem reps/carga, só um "concluído" único (série sintética 1). */
  isQualitative: boolean;
  sets: WorkoutSet[];
};

export function formatSetTarget(set: SnapshotSet): string {
  const reps =
    typeof set.reps === "number"
      ? `${set.reps} reps`
      : typeof set.repsMin === "number" && typeof set.repsMax === "number"
        ? `${set.repsMin}-${set.repsMax} reps`
        : set.durationSeconds
          ? `${set.durationSeconds}s`
          : "—";

  const load =
    typeof set.loadValue === "number"
      ? set.loadType === "percentage-1rm"
        ? `${set.loadValue}% 1RM`
        : `${set.loadValue} kg`
      : "";

  return [reps, load].filter(Boolean).join(" · ");
}

/** Alvo do exercício inteiro: "3 × 3-5 reps · 75% 1RM". */
export function formatExerciseTarget(item: SnapshotItem): string {
  if (item.sets.length === 0) {
    if (item.kind === "amrap" || item.kind === "emom") {
      return item.minutes ? `${item.kind.toUpperCase()} · ${item.minutes} min` : item.kind.toUpperCase();
    }
    if (item.durationSeconds) return `${Math.round(item.durationSeconds / 60)} min`;
    return "Sem prescrição";
  }

  const targets = [...new Set(item.sets.map(formatSetTarget))];
  return `${item.sets.length} × ${targets.join(" / ")}`;
}

export function buildWorkoutExercises(
  session: CalendarSessionRecord,
  results: AthleteSetResultRecord[]
): WorkoutExercise[] {
  const resultsByKey = new Map(
    results.map((result) => [`${result.block_item_id}:${result.set_number}`, result])
  );

  return readSessionBlocks(session).flatMap((block) =>
    block.items.map((item) => ({
      itemId: item.id,
      blockId: block.id,
      blockName: block.name,
      name: item.name,
      videoUrl: item.videoUrl,
      targetSummary: formatExerciseTarget(item),
      restLabel: item.restSeconds ? `Descanso ${item.restSeconds}s` : "",
      notes: item.notes,
      isQualitative: item.kind === "qualitative",
      // Prescrições sem série (AMRAP, EMOM, por tempo, qualitativa) ainda precisam de uma linha de registro.
      sets: (item.sets.length > 0 ? item.sets : [defaultSet()]).map((set) => {
        const stored = resultsByKey.get(`${item.id}:${set.setNumber}`);

        return {
          setNumber: set.setNumber,
          reps: stored?.reps === null || stored?.reps === undefined ? "" : String(stored.reps),
          kilograms: stored?.load_kg === null || stored?.load_kg === undefined ? "" : String(stored.load_kg),
          completed: stored?.completed ?? false,
          target: formatSetTarget(set)
        };
      })
    }))
  );
}

function defaultSet(): SnapshotSet {
  return {
    setNumber: 1,
    reps: null,
    repsMin: null,
    repsMax: null,
    loadType: null,
    loadValue: null,
    durationSeconds: null
  };
}

export function sanitizeNumericInput(value: string): string {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole = "", ...decimals] = normalized.split(".");

  return decimals.length > 0 ? `${whole}.${decimals.join("")}` : whole;
}

export function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getCompletedSetCount(sets: WorkoutSet[]): number {
  return sets.filter((set) => set.completed).length;
}

export function countSessionSets(exercises: WorkoutExercise[]): { completed: number; total: number } {
  return exercises.reduce(
    (totals, exercise) => ({
      completed: totals.completed + getCompletedSetCount(exercise.sets),
      total: totals.total + exercise.sets.length
    }),
    { completed: 0, total: 0 }
  );
}

/** Concluída quando todas as séries foram marcadas; parcial quando ao menos uma foi. */
export function resolveSessionOutcome(
  exercises: WorkoutExercise[]
): "completed" | "partially_completed" | null {
  const { completed, total } = countSessionSets(exercises);

  if (total === 0 || completed === 0) return null;
  return completed === total ? "completed" : "partially_completed";
}
