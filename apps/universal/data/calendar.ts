/**
 * Aritmética de calendário: intervalos, grades de mês e de semana.
 *
 * A leitura do conteúdo da sessão não mora aqui — ela é do Coach Híbrido,
 * em `@/data/coach-hibrido/session-snapshot`.
 */
import type { CalendarEntryRecord, CalendarSessionRecord } from "@fitblock/backend";

export type CalendarDay<TEntry extends CalendarEntryRecord = CalendarEntryRecord> = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: TEntry[];
};

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

function groupSessionsByDate<TEntry extends CalendarEntryRecord>(sessions: TEntry[]): Map<string, TEntry[]> {
  const sessionsByDate = new Map<string, TEntry[]>();

  sessions.forEach((session) => {
    const current = sessionsByDate.get(session.scheduled_date) ?? [];
    sessionsByDate.set(session.scheduled_date, [...current, session]);
  });

  return sessionsByDate;
}

export function createCalendarGrid<TEntry extends CalendarEntryRecord>(anchor: Date, sessions: TEntry[]): CalendarDay<TEntry>[] {
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
export function createWeekGrid<TEntry extends CalendarEntryRecord>(anchor: Date, sessions: TEntry[]): CalendarDay<TEntry>[] {
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
