/**
 * Volume total lido do próprio texto do bloco.
 *
 * O coach escreve como sempre escreveu ("4 x 3-5") e o total aparece embaixo do bloco.
 * Quando o texto foge dos formatos abaixo, ele assume o número na mão — por isso
 * `VolumeEstimate.matchedLines` existe: a interface precisa saber se achou algo.
 */

export type VolumeEstimate = {
  sets: number;
  reps: number;
  /** Quantas linhas o parser conseguiu ler. Zero significa "não tenho o que somar". */
  matchedLines: number;
};

const EMPTY: VolumeEstimate = { sets: 0, reps: 0, matchedLines: 0 };

/** "4 x 3-5", "4x5", "5 × 2 @ 75%" — séries vezes repetições, com faixa opcional. */
const setsByReps = /(?:^|\s)(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?![\d.,])/;

/** "6, 10, 6, 10, 6, 10" — uma repetição por série, explícita. */
const repsPerSetList = /^\s*\d{1,3}(?:\s*,\s*\d{1,3})+\s*$/;

/** "21-15-9" — escada de repetições; cada degrau é uma série. */
const repLadder = /^\s*\d{1,3}(?:\s*[-–]\s*\d{1,3}){2,}\s*$/;

function averageReps(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

function readLine(line: string): { sets: number; reps: number } | null {
  const byReps = setsByReps.exec(line);
  if (byReps) {
    const sets = Number(byReps[1]);
    const low = Number(byReps[2]);
    const high = byReps[3] === undefined ? low : Number(byReps[3]);
    const reps = high >= low ? averageReps(low, high) : low;

    if (sets > 0 && reps > 0) return { sets, reps: sets * reps };
  }

  if (repsPerSetList.test(line)) {
    const values = line.split(",").map((value) => Number(value.trim()));
    return { sets: values.length, reps: values.reduce((total, value) => total + value, 0) };
  }

  if (repLadder.test(line)) {
    const values = line.split(/[-–]/).map((value) => Number(value.trim()));
    return { sets: values.length, reps: values.reduce((total, value) => total + value, 0) };
  }

  return null;
}

export function estimateVolume(body: string): VolumeEstimate {
  if (!body.trim()) return EMPTY;

  return body.split("\n").reduce<VolumeEstimate>((total, line) => {
    const parsed = readLine(line);
    if (!parsed) return total;

    return {
      sets: total.sets + parsed.sets,
      reps: total.reps + parsed.reps,
      matchedLines: total.matchedLines + 1
    };
  }, EMPTY);
}

/** "14 séries · 102 reps" */
export function formatVolume(sets: number, reps: number): string {
  return `${sets} ${sets === 1 ? "série" : "séries"} · ${reps} ${reps === 1 ? "rep" : "reps"}`;
}
