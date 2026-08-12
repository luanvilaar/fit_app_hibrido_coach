import {
  createCalendarGrid,
  createWeekGrid,
  formatMonthLabel,
  formatWeekLabel,
  getMonthRange,
  getSessionStateLabel,
  getWeekRange,
  parseCalendarDate,
  shiftMonth,
  shiftWeek,
  toCalendarDate
} from "@/data/calendar";
import type { CalendarSessionRecord } from "@fitblock/backend";

const session = {
  id: "instance-01",
  team_id: "team-01",
  scheduled_date: "2026-08-10",
  status: "published",
  state: "available",
  coach_note: "",
  snapshot: { title: "Lower Strength", blocks: [] },
  created_at: "2026-08-05T12:00:00.000Z",
  updated_at: "2026-08-05T12:00:00.000Z"
} as unknown as CalendarSessionRecord;

describe("aritmética de calendário", () => {
  it("converte data em texto e de volta sem deslocar o dia", () => {
    expect(toCalendarDate(new Date(2026, 7, 3))).toBe("2026-08-03");
    expect(parseCalendarDate("2026-08-03")).toEqual(new Date(2026, 7, 3));
  });

  it("cria o intervalo do mês e avança sem mutar a âncora", () => {
    const anchor = new Date(2026, 7, 15);

    expect(getMonthRange(anchor)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(shiftMonth(anchor, 1)).toEqual(new Date(2026, 8, 1));
    expect(anchor).toEqual(new Date(2026, 7, 15));
  });

  it("posiciona a sessão no dia agendado da grade do mês", () => {
    const grid = createCalendarGrid(new Date(2026, 7, 1), [session]);
    const sessionDay = grid.find((day) => day.date === "2026-08-10");

    expect(sessionDay?.sessions).toEqual([session]);
    expect(sessionDay?.isCurrentMonth).toBe(true);
  });

  it("cria a semana começando na segunda e avança sem mutar a âncora", () => {
    const anchor = new Date(2026, 7, 10); // segunda-feira

    expect(getWeekRange(anchor)).toEqual({ from: "2026-08-10", to: "2026-08-16" });
    expect(shiftWeek(anchor, 1)).toEqual(new Date(2026, 7, 17));
    expect(shiftWeek(anchor, -1)).toEqual(new Date(2026, 7, 3));
    expect(anchor).toEqual(new Date(2026, 7, 10));
  });

  it("resolve a semana a partir de qualquer dia, não só da segunda", () => {
    expect(getWeekRange(new Date(2026, 7, 12))).toEqual({ from: "2026-08-10", to: "2026-08-16" });
  });

  it("rotula a semana dentro do mês e atravessando a virada", () => {
    expect(formatWeekLabel(new Date(2026, 7, 10))).toBe("10 a 16 de agosto de 2026");
    expect(formatWeekLabel(new Date(2026, 7, 1))).toBe("27 de jul a 02 de agosto de 2026");
  });

  it("rotula o mês em português", () => {
    expect(formatMonthLabel(new Date(2026, 7, 10))).toBe("agosto de 2026");
  });

  it("monta uma semana de sete dias, todos correntes, com a sessão no lugar", () => {
    const grid = createWeekGrid(new Date(2026, 7, 10), [session]);

    expect(grid).toHaveLength(7);
    expect(grid.every((day) => day.isCurrentMonth)).toBe(true);
    expect(grid[0].date).toBe("2026-08-10");
    expect(grid[6].date).toBe("2026-08-16");
    expect(grid.find((day) => day.date === "2026-08-10")?.sessions).toEqual([session]);
  });

  it("monta a semana que atravessa a virada do mês", () => {
    const grid = createWeekGrid(new Date(2026, 7, 1), []);

    expect(grid.map((day) => day.date)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02"
    ]);
  });

  it("traduz cada estado de sessão", () => {
    expect(getSessionStateLabel("available")).toBe("Disponível");
    expect(getSessionStateLabel("partially_completed")).toBe("Concluída parcialmente");
  });
});
