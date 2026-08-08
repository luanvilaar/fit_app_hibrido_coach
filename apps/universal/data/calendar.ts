import type { CalendarSessionRecord } from "@fitblock/backend";

export type CalendarDay = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: CalendarSessionRecord[];
};

export type CalendarDisplayItem = {
  id: string;
  name: string;
  prescription: string;
};

export type CalendarDisplayBlock = {
  id: string;
  name: string;
  /** Modalidade do bloco: strength, conditioning, lpo, endurance, gymnastics-skill ou legado. */
  kind: string;
  /** Texto livre das modalidades sem lista de exercícios; vazio nas demais. */
  description: string;
  /** Volume prescrito por modalidade num bloco de endurance. */
  volumes: SnapshotVolume[];
  /** Séries prescritas direto no bloco (LPO), sem exercício do banco. */
  sets: SnapshotSet[];
  items: CalendarDisplayItem[];
};

export type SnapshotVolume = {
  modality: string;
  value: number;
  unit: string;
};

export type SnapshotRanking = {
  enabled: boolean;
  scoreType: string;
};

type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getMonthRange(anchor: Date): { from: string; to: string } {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  return {
    from: toCalendarDate(new Date(year, month, 1)),
    to: toCalendarDate(new Date(year, month + 1, 0))
  };
}

export function shiftMonth(anchor: Date, amount: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1);
}

export function formatMonthLabel(anchor: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(anchor);
}

function groupSessionsByDate(sessions: CalendarSessionRecord[]): Map<string, CalendarSessionRecord[]> {
  const sessionsByDate = new Map<string, CalendarSessionRecord[]>();

  sessions.forEach((session) => {
    const current = sessionsByDate.get(session.scheduled_date) ?? [];
    sessionsByDate.set(session.scheduled_date, [...current, session]);
  });

  return sessionsByDate;
}

export function createCalendarGrid(anchor: Date, sessions: CalendarSessionRecord[]): CalendarDay[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const today = toCalendarDate(new Date());
  const sessionsByDate = groupSessionsByDate(sessions);

  return Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = index - leadingDays + 1;
    const date = new Date(year, month, dayOffset);
    const dateString = toCalendarDate(date);

    return {
      date: dateString,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateString === today,
      sessions: sessionsByDate.get(dateString) ?? []
    };
  });
}

/** Início da semana (segunda-feira) que contém a data âncora. */
export function getWeekStart(anchor: Date): Date {
  const mondayOffset = (anchor.getDay() + 6) % 7;
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - mondayOffset);
}

export function getWeekRange(anchor: Date): { from: string; to: string } {
  const start = getWeekStart(anchor);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { from: toCalendarDate(start), to: toCalendarDate(end) };
}

export function shiftWeek(anchor: Date, amount: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + amount * 7);
}

export function formatWeekLabel(anchor: Date): string {
  const start = getWeekStart(anchor);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const startDay = String(start.getDate()).padStart(2, "0");
  const endDay = String(end.getDate()).padStart(2, "0");

  if (start.getMonth() === end.getMonth()) {
    const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(end);
    return `${startDay} a ${endDay} de ${monthYear}`;
  }

  const startMonth = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(start).replace(".", "");
  const endMonthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(end);
  return `${startDay} de ${startMonth} a ${endDay} de ${endMonthYear}`;
}

/** Sempre 7 dias (segunda a domingo); não há noção de "fora do período" na visão semanal. */
export function createWeekGrid(anchor: Date, sessions: CalendarSessionRecord[]): CalendarDay[] {
  const start = getWeekStart(anchor);
  const today = toCalendarDate(new Date());
  const sessionsByDate = groupSessionsByDate(sessions);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const dateString = toCalendarDate(date);

    return {
      date: dateString,
      day: date.getDate(),
      isCurrentMonth: true,
      isToday: dateString === today,
      sessions: sessionsByDate.get(dateString) ?? []
    };
  });
}

export function getSessionTitle(session: CalendarSessionRecord): string {
  const title = isRecord(session.snapshot) ? session.snapshot.title : undefined;
  return asString(title, "Sessão FitBlock");
}

export type SnapshotSet = {
  setNumber: number;
  reps: number | null;
  repsMin: number | null;
  repsMax: number | null;
  loadType: string | null;
  loadValue: number | null;
  durationSeconds: number | null;
};

export type SnapshotItem = {
  id: string;
  exerciseId: string | null;
  name: string;
  videoUrl: string | null;
  kind: string;
  restSeconds: number | null;
  durationSeconds: number | null;
  minutes: number | null;
  notes: string;
  sets: SnapshotSet[];
  /** Prescrição como veio do jsonb, para formatação e estimativas. */
  prescriptionRaw: unknown;
};

export type SnapshotBlock = {
  id: string;
  name: string;
  kind: string;
  /** Texto livre das modalidades sem lista de exercícios (Condicionamento, LPO, Endurance). */
  description: string;
  /** Ranking interno do bloco, quando o coach ativou. */
  ranking: SnapshotRanking | null;
  /** Séries prescritas direto no bloco (LPO). */
  sets: SnapshotSet[];
  /** Volume prescrito por modalidade (Endurance). */
  volumes: SnapshotVolume[];
  items: SnapshotItem[];
};

const freeTextBlockKinds = ["conditioning", "lpo", "endurance"];

/** Modalidades cujo conteúdo é o texto livre do bloco, sem exercícios do banco. */
export function isFreeTextBlock(block: Pick<SnapshotBlock, "kind">): boolean {
  return freeTextBlockKinds.includes(block.kind);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readSnapshotSets(value: unknown): SnapshotSet[] {
  const sets = Array.isArray(value) ? value.filter(isRecord) : [];

  return sets.map((set, setIndex) => ({
    setNumber: asNumber(set.set_number) ?? setIndex + 1,
    reps: asNumber(set.reps),
    repsMin: asNumber(set.reps_min),
    repsMax: asNumber(set.reps_max),
    loadType: asNullableString(set.load_type),
    loadValue: asNumber(set.load_value),
    durationSeconds: asNumber(set.duration_seconds)
  }));
}

function readSnapshotVolumes(value: unknown): SnapshotVolume[] {
  const volumes = Array.isArray(value) ? value.filter(isRecord) : [];

  return volumes.flatMap((volume) => {
    const modality = asString(volume.modality, "");
    const parsed = asNumber(volume.value);

    if (!modality || parsed === null) return [];

    return [{ modality, value: parsed, unit: asString(volume.unit, "m") }];
  });
}

function readSnapshotRanking(value: unknown): SnapshotRanking | null {
  if (!isRecord(value) || value.enabled !== true) return null;

  return { enabled: true, scoreType: asString(value.score_type, "time") };
}

/** Leitura tipada do snapshot congelado; é a fonte única de parse do jsonb da sessão. */
export function readSessionBlocks(session: CalendarSessionRecord): SnapshotBlock[] {
  const snapshot = isRecord(session.snapshot) ? session.snapshot : {};
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];

  return blocks.filter(isRecord).map((block, blockIndex) => {
    const items = Array.isArray(block.items) ? block.items : [];
    const details = isRecord(block.details) ? block.details : {};

    return {
      id: asString(block.id, `block-${blockIndex}`),
      name: asString(block.name, "Bloco de treino"),
      kind: asString(block.kind, "custom"),
      description: asString(details.description, ""),
      ranking: readSnapshotRanking(details.ranking),
      sets: readSnapshotSets(details.sets),
      volumes: readSnapshotVolumes(details.volumes),
      items: items.filter(isRecord).map((item, itemIndex) => {
        const prescription = isRecord(item.prescription) ? item.prescription : {};

        return {
          id: asString(item.id, `item-${blockIndex}-${itemIndex}`),
          exerciseId: asNullableString(item.exercise_id),
          name: asString(item.exercise_name, "Exercício"),
          videoUrl: asNullableString(item.exercise_video_url),
          kind: asString(prescription.kind, ""),
          restSeconds: asNumber(prescription.rest_seconds),
          durationSeconds: asNumber(prescription.duration_seconds),
          minutes: asNumber(prescription.minutes),
          notes: asString(prescription.notes, ""),
          sets: readSnapshotSets(prescription.sets),
          prescriptionRaw: item.prescription
        };
      })
    };
  });
}

export function getSessionBlocks(session: CalendarSessionRecord): CalendarDisplayBlock[] {
  return readSessionBlocks(session).map((block) => ({
    id: block.id,
    name: block.name,
    kind: block.kind,
    description: block.description,
    volumes: block.volumes,
    sets: block.sets,
    items: block.items.map((item) => ({
      id: item.id,
      name: item.name,
      prescription: formatPrescription(item.prescriptionRaw)
    }))
  }));
}

/** "5 km de corrida · 2000 m de remo" — resumo dos volumes de um bloco de endurance. */
export function formatVolumes(volumes: SnapshotVolume[]): string {
  const labels: Record<string, string> = { run: "corrida", row: "remo", bike: "bike" };

  return volumes
    .map((volume) => `${volume.value} ${volume.unit} de ${labels[volume.modality] ?? volume.modality}`)
    .join(" · ");
}

/** "3 × 3-5 · 75% 1RM" — resumo das séries prescritas direto no bloco (LPO). */
export function formatBlockSets(sets: SnapshotSet[]): string {
  if (sets.length === 0) return "";

  const reps = sets.map((set) => {
    if (typeof set.reps === "number") return String(set.reps);
    if (typeof set.repsMin === "number" && typeof set.repsMax === "number") {
      return `${set.repsMin}-${set.repsMax}`;
    }
    return "—";
  });

  const load = sets.find((set) => typeof set.loadValue === "number");
  const loadLabel = load
    ? load.loadType === "percentage-1rm"
      ? `${load.loadValue}% 1RM`
      : `${load.loadValue} kg`
    : "";

  return [`${sets.length} × ${[...new Set(reps)].join("/")}`, loadLabel].filter(Boolean).join(" · ");
}

export function formatPrescription(value: unknown): string {
  if (!isRecord(value)) return "Prescrição a confirmar";

  const kind = asString(value.kind, "");
  const sets = Array.isArray(value.sets) ? value.sets.filter(isRecord) : [];

  if (kind === "sets-reps") {
    const reps = sets.map((set) => {
      if (typeof set.reps === "number") return String(set.reps);
      if (typeof set.reps_min === "number" && typeof set.reps_max === "number") {
        return `${set.reps_min}-${set.reps_max}`;
      }
      return "—";
    });
    const load = sets.find((set) => typeof set.load_value === "number");
    const loadLabel = load
      ? load.load_type === "percentage-1rm"
        ? `${load.load_value}% 1RM`
        : `${load.load_value} kg`
      : "";
    const seriesLabel = `${sets.length || "—"} × ${reps.length ? [...new Set(reps)].join("/") : "reps"}`;
    return [seriesLabel, loadLabel].filter(Boolean).join(" · ");
  }

  if (kind === "timed") {
    const seconds = typeof value.duration_seconds === "number" ? value.duration_seconds : 0;
    return seconds > 0 ? `${Math.round(seconds / 60)} min` : "Por tempo";
  }

  if (kind === "amrap") {
    return typeof value.minutes === "number" ? `AMRAP · ${value.minutes} min` : "AMRAP";
  }

  if (kind === "emom") return "EMOM";
  if (kind === "for-time") return "For time";
  if (kind === "intervals") return "Intervalos";
  if (kind === "qualitative") return "Tarefa qualitativa";
  return "Prescrição a confirmar";
}

export function getSessionStateLabel(state: CalendarSessionRecord["state"]): string {
  const labels: Record<CalendarSessionRecord["state"], string> = {
    available: "Disponível",
    started: "Iniciada",
    completed: "Concluída",
    partially_completed: "Concluída parcialmente",
    missed: "Perdida",
    cancelled: "Cancelada",
    rescheduled: "Remarcada",
    plan_locked: "Bloqueada por plano",
    recovery: "Em recuperação"
  };

  return labels[state];
}
