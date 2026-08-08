import type {
  AthleteCheckinRecord,
  AthleteSessionProgressRecord,
  AthleteWeekSummary,
  CalendarSessionRecord,
  CheckinPainRegion
} from "@fitblock/backend";
import {
  formatBlockSets,
  formatVolumes,
  getSessionTitle,
  isFreeTextBlock,
  readSessionBlocks,
  type SnapshotBlock,
  type SnapshotItem
} from "@/data/calendar";

/** Focos deriváveis do enum de bloco do banco; não há campo de foco na prescrição. */
export type WorkoutFocus = "Força" | "Endurance" | "Mixed";

export type TodayBlock = {
  id: string;
  name: string;
  detail: string;
  status: "done" | "pending";
};

/** Faixas operacionais do check-in: verde >= 4,0 · amarelo 3,0-3,9 · vermelho < 3,0. */
export type ReadinessTone = "ready" | "caution" | "risk";

export type ReadinessView = {
  score: string;
  label: string;
  detail: string;
  /** Dor localizada do dia, quando houver: "Dor: joelho 6/10". */
  pain: string | null;
  progress: number;
  tone: ReadinessTone;
};

export type SessionStatusView = {
  label: string;
  tone: "available" | "running" | "done" | "empty";
};

/**
 * Séries de força não têm duração cronometrada na prescrição. A estimativa usa um tempo
 * médio de execução por série somado ao descanso prescrito, e a interface exibe "≈".
 */
const SECONDS_PER_SET = 45;

export function parseCalendarDate(value: string): Date {
  // Meio-dia local: evita que o fuso jogue a data para o dia anterior.
  return new Date(`${value}T12:00:00`);
}

/** "QUINTA · 06 AGO 2026" */
export function formatTodayEyebrow(date: Date): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");

  return `${weekday} · ${day} ${month} ${date.getFullYear()}`.toUpperCase();
}

const strengthKinds = ["strength", "lpo", "gymnastics-skill"];
const enduranceKinds = ["conditioning", "endurance"];

export function deriveSessionFocus(blocks: SnapshotBlock[]): WorkoutFocus {
  const hasStrength = blocks.some((block) => strengthKinds.includes(block.kind));
  const hasConditioning = blocks.some((block) => enduranceKinds.includes(block.kind));

  if (hasStrength && !hasConditioning) return "Força";
  if (hasConditioning && !hasStrength) return "Endurance";
  return "Mixed";
}

function estimateItemSeconds(item: SnapshotItem): number {
  const rest = item.restSeconds ?? 0;
  const setCount = item.sets.length;

  if (item.kind === "timed") {
    const setsDuration = item.sets.reduce((total, set) => total + (set.durationSeconds ?? 0), 0);
    const duration = item.durationSeconds ?? setsDuration;
    return duration + rest * Math.max(setCount - 1, 0);
  }

  if (item.kind === "amrap" || item.kind === "emom") {
    return (item.minutes ?? 0) * 60;
  }

  if (setCount === 0) return item.durationSeconds ?? 0;

  return setCount * SECONDS_PER_SET + rest * Math.max(setCount - 1, 0);
}

export function estimateSessionMinutes(blocks: SnapshotBlock[]): number {
  const seconds = blocks.reduce(
    (total, block) => total + block.items.reduce((blockTotal, item) => blockTotal + estimateItemSeconds(item), 0),
    0
  );

  return Math.round(seconds / 60);
}

export function formatSessionDuration(minutes: number): string {
  return minutes > 0 ? `≈ ${minutes} min` : "Duração livre";
}

/** Resumo de um bloco: primeiro exercício com a prescrição e quantos mais existem. */
export function describeBlock(block: SnapshotBlock): string {
  // Modalidades de texto livre não têm exercício: o resumo é a própria descrição do coach.
  if (isFreeTextBlock(block)) {
    const summary = [
      block.description.split("\n").map((line) => line.trim()).filter(Boolean).join(" · "),
      formatBlockSets(block.sets),
      formatVolumes(block.volumes)
    ]
      .filter(Boolean)
      .join(" · ");

    return summary || "Sem prescrição";
  }

  const [first, ...rest] = block.items;

  if (!first) return "Sem exercícios prescritos";

  const head = `${first.name}${first.sets.length > 0 ? ` · ${formatSetsSummary(first)}` : ""}`;

  return rest.length > 0 ? `${head} · +${rest.length} ${rest.length === 1 ? "exercício" : "exercícios"}` : head;
}

export function formatSetsSummary(item: SnapshotItem): string {
  const reps = item.sets.map((set) => {
    if (typeof set.reps === "number") return String(set.reps);
    if (typeof set.repsMin === "number" && typeof set.repsMax === "number") {
      return `${set.repsMin}-${set.repsMax}`;
    }
    return "—";
  });

  const unique = [...new Set(reps)];
  return `${item.sets.length} × ${unique.join("/")}`;
}

export function buildTodayBlocks(
  session: CalendarSessionRecord,
  progress: AthleteSessionProgressRecord | null
): TodayBlock[] {
  const completed = new Set(progress?.completed_block_ids ?? []);

  return readSessionBlocks(session).map((block) => ({
    id: block.id,
    name: block.name,
    detail: describeBlock(block),
    status: completed.has(block.id) ? "done" : "pending"
  }));
}

export function getWeeklyProgress(completed: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.min(completed / planned, 1);
}

/** "Treino 02 · Semana de 03/08" */
export function formatWeekEyebrow(week: AthleteWeekSummary): string {
  const position = week.position > 0 ? String(week.position).padStart(2, "0") : "01";

  if (!week.start) return `Treino ${position}`;

  const start = parseCalendarDate(week.start);
  const label = `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`;

  return `Treino ${position} · Semana de ${label}`;
}

export function describeSessionStatus(
  session: CalendarSessionRecord | null,
  progress: AthleteSessionProgressRecord | null
): SessionStatusView {
  if (!session) return { label: "SEM SESSÃO HOJE", tone: "empty" };
  if (progress?.state === "completed") return { label: "TREINO CONCLUÍDO", tone: "done" };
  if (progress?.state === "partially_completed") return { label: "CONCLUÍDO PARCIALMENTE", tone: "done" };
  if (progress?.state === "started") return { label: "TREINO EM ANDAMENTO", tone: "running" };
  return { label: "SESSÃO DISPONÍVEL", tone: "available" };
}

export function describeReadiness(checkin: AthleteCheckinRecord | null): ReadinessView | null {
  if (!checkin) return null;

  const readiness = Number(checkin.readiness);
  // A faixa sai do valor já arredondado para uma casa, senão 3,96 apareceria
  // como "4,0" pintado de amarelo.
  const rounded = Math.round(readiness * 10) / 10;
  const tone: ReadinessTone = rounded >= 4 ? "ready" : rounded >= 3 ? "caution" : "risk";

  return {
    score: rounded.toFixed(1).replace(".", ","),
    label:
      tone === "ready"
        ? "Pronto para treinar"
        : tone === "caution"
          ? "Atenção ao volume"
          : "Priorize a recuperação",
    detail: describeWeakestAnswers(checkin),
    pain: describeCheckinPain(checkin),
    progress: Math.min(Math.max(rounded / 5, 0), 1),
    tone
  };
}

/**
 * "Mais baixos: Nível de estresse 2 · Recuperação muscular 3".
 * Sete pares rótulo+nota não cabem no card da Hoje; as duas respostas mais baixas
 * são o que o atleta precisa ver. O detalhe completo fica na tela de check-in.
 */
export function describeWeakestAnswers(checkin: AthleteCheckinRecord, limit = 2): string {
  const ranked = checkinQuestions
    .map((question) => ({ question, value: readCheckinAnswer(checkin, question.key) }))
    .sort((a, b) => a.value - b.value)
    .slice(0, limit);

  if (ranked.every((entry) => entry.value === 5)) return "Todas as respostas no topo";

  return `Mais baixos: ${ranked.map((entry) => `${entry.question.label} ${entry.value}`).join(" · ")}`;
}

/** "Dor: joelho 6/10" quando o atleta marcou uma região. */
export function describeCheckinPain(checkin: AthleteCheckinRecord): string | null {
  if (!checkin.pain_region || checkin.pain_intensity === null) return null;

  const label = painRegions.find((region) => region.value === checkin.pain_region)?.label ?? "Outro";

  return `Dor: ${label.toLowerCase()} ${checkin.pain_intensity}/10`;
}

/** "Sexta · ≈ 52 min · Força" */
export function describeNextSession(session: CalendarSessionRecord): string {
  const date = parseCalendarDate(session.scheduled_date);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  const blocks = readSessionBlocks(session);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return `${capitalized} · ${formatSessionDuration(estimateSessionMinutes(blocks))} · ${deriveSessionFocus(blocks)}`;
}

export function getNextSessionTitle(session: CalendarSessionRecord): string {
  return getSessionTitle(session);
}

/** "Hoje, 07:32" quando a nota é do próprio dia; "05 ago, 07:32" nos demais casos. */
export function formatCoachNoteTime(session: CalendarSessionRecord, reference: Date): string {
  const updatedAt = new Date(session.updated_at);

  if (Number.isNaN(updatedAt.getTime())) return "";

  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(updatedAt);
  const isSameDay =
    updatedAt.getFullYear() === reference.getFullYear() &&
    updatedAt.getMonth() === reference.getMonth() &&
    updatedAt.getDate() === reference.getDate();

  if (isSameDay) return `Hoje, ${time}`;

  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(updatedAt)
    .replace(".", "");

  return `${day}, ${time}`;
}

export type CheckinQuestionKey =
  | "sleepScore"
  | "energyScore"
  | "muscleRecoveryScore"
  | "stressScore"
  | "moodScore"
  | "motivationScore"
  | "overallReadinessScore";

export type CheckinQuestion = {
  key: CheckinQuestionKey;
  /** Sufixo de testID e accessibilityLabel; sem acento de propósito. */
  slug: string;
  label: string;
  /** Âncoras da escala: sem elas, "Nível de estresse 5" é ambíguo. */
  low: string;
  high: string;
};

/** As sete perguntas do check-in, todas de 1 (pior) a 5 (melhor). */
export const checkinQuestions: readonly CheckinQuestion[] = [
  { key: "sleepScore", slug: "sono", label: "Qualidade do sono", low: "Péssimo", high: "Excelente" },
  { key: "energyScore", slug: "energia", label: "Energia física", low: "Exausto", high: "Cheio de energia" },
  {
    key: "muscleRecoveryScore",
    slug: "recuperacao",
    label: "Recuperação muscular",
    low: "Muita dor",
    high: "Recuperado"
  },
  { key: "stressScore", slug: "estresse", label: "Nível de estresse", low: "Muito estressado", high: "Tranquilo" },
  { key: "moodScore", slug: "humor", label: "Humor", low: "Muito ruim", high: "Ótimo" },
  {
    key: "motivationScore",
    slug: "motivacao",
    label: "Motivação para treinar",
    low: "Sem vontade",
    high: "Muito motivado"
  },
  {
    key: "overallReadinessScore",
    slug: "prontidao",
    label: "Prontidão geral",
    low: "Nada pronto",
    high: "Pronto para tudo"
  }
] as const;

/** Ponte entre a chave camelCase da pergunta e a coluna snake_case do registro. */
const checkinAnswerColumns: Record<CheckinQuestionKey, keyof AthleteCheckinRecord> = {
  sleepScore: "sleep_score",
  energyScore: "energy_score",
  muscleRecoveryScore: "muscle_recovery_score",
  stressScore: "stress_score",
  moodScore: "mood_score",
  motivationScore: "motivation_score",
  overallReadinessScore: "overall_readiness_score"
};

export function readCheckinAnswer(checkin: AthleteCheckinRecord, key: CheckinQuestionKey): number {
  return Number(checkin[checkinAnswerColumns[key]]);
}

/** Lista fechada espelhada na check constraint athlete_daily_checkins_pain_region_check. */
export const painRegions: readonly { value: CheckinPainRegion; label: string }[] = [
  { value: "pescoco", label: "Pescoço" },
  { value: "ombro", label: "Ombro" },
  { value: "cotovelo", label: "Cotovelo" },
  { value: "punho_mao", label: "Punho / mão" },
  { value: "costas", label: "Costas" },
  { value: "lombar", label: "Lombar" },
  { value: "quadril", label: "Quadril" },
  { value: "coxa", label: "Coxa" },
  { value: "joelho", label: "Joelho" },
  { value: "panturrilha", label: "Panturrilha" },
  { value: "tornozelo_pe", label: "Tornozelo / pé" },
  { value: "outro", label: "Outro" }
];

export const checkinScale = [1, 2, 3, 4, 5];
export const painIntensityScale = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Preview local enquanto o atleta responde; o valor oficial é derivado no banco. */
export function averageCheckinScore(answers: Record<CheckinQuestionKey, number>): number {
  const total = checkinQuestions.reduce((sum, question) => sum + answers[question.key], 0);

  return total / checkinQuestions.length;
}
