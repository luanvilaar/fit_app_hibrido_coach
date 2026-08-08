import type { AthleteSessionProgressRecord, PersonalRecordEntry, SessionHistoryEntry, WeeklyHistoryEntry } from "@fitblock/backend";
import { getSessionTitle, readSessionBlocks } from "@/data/calendar";
import { deriveSessionFocus, estimateSessionMinutes, formatSessionDuration, parseCalendarDate } from "@/data/today";

/** "12 dias de consistência" · "Comece sua sequência" quando ainda não há dias concluídos. */
export function describeStreak(streakDays: number): string {
  if (streakDays <= 0) return "Comece sua sequência";
  return `${streakDays} ${streakDays === 1 ? "dia" : "dias"} de consistência`;
}

/** Proporção 0–1 de sessões concluídas na semana; usada na altura da barra do gráfico. */
export function getWeeklyRate(entry: WeeklyHistoryEntry): number {
  if (entry.planned <= 0) return 0;
  return Math.min(entry.completed / entry.planned, 1);
}

/** "03/08" — início da semana, rótulo curto para o eixo do gráfico. */
export function formatWeekAxisLabel(weekStart: string): string {
  const date = parseCalendarDate(weekStart);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "82,5 kg" — carga com vírgula decimal pt-BR e uma casa quando necessário. */
export function formatPersonalRecordLoad(loadKg: number): string {
  const formatted = Number.isInteger(loadKg) ? String(loadKg) : loadKg.toFixed(1).replace(".", ",");
  return `${formatted} kg`;
}

/** "05 ago" — data curta para o recorde, sem ano (assume-se recorde recente). */
export function formatPersonalRecordDate(dateValue: string): string {
  const date = parseCalendarDate(dateValue);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
}

export function sortPersonalRecords(records: PersonalRecordEntry[]): PersonalRecordEntry[] {
  return [...records].sort((a, b) => b.load_kg - a.load_kg);
}

/** "05 ago · Força · ≈ 52 min" — resumo de uma sessão concluída na lista de histórico. */
export function describeSessionHistoryMeta(entry: SessionHistoryEntry): string {
  const date = parseCalendarDate(entry.session.scheduled_date);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
  const blocks = readSessionBlocks(entry.session);
  const focus = deriveSessionFocus(blocks);
  const duration = formatSessionDuration(estimateSessionMinutes(blocks));

  return `${day} · ${focus} · ${duration}`;
}

export function getSessionHistoryTitle(entry: SessionHistoryEntry): string {
  return getSessionTitle(entry.session);
}

export function describeSessionHistoryStatus(progress: AthleteSessionProgressRecord): string {
  return progress.state === "completed" ? "Concluído" : "Parcial";
}
