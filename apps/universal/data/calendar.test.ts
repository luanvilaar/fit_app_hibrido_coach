import {
  createCalendarGrid,
  createWeekGrid,
  formatBlockSets,
  formatPrescription,
  formatVolumes,
  formatWeekLabel,
  getSessionBlocks,
  getSessionTitle,
  getSessionStateLabel,
  getMonthRange,
  getWeekRange,
  isFreeTextBlock,
  readSessionBlocks,
  shiftMonth,
  shiftWeek,
} from "@/data/calendar";
import type { CalendarSessionRecord } from "@fitblock/backend";

const session: CalendarSessionRecord = {
  id: "instance-01",
  template_id: "template-01",
  team_id: "team-01",
  scheduled_date: "2026-08-10",
  status: "published",
  state: "available",
  coach_note: "",
  snapshot: {
    title: "Lower Strength",
    blocks: [
      {
        id: "block-01",
        name: "Força principal",
        items: [
          {
            id: "item-01",
            exercise_name: "Back Squat",
            prescription: {
              kind: "sets-reps",
              sets: [
                { set_number: 1, reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 },
                { set_number: 2, reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 }
              ]
            }
          }
        ]
      }
    ]
  },
  created_by: "coach-01",
  created_at: "2026-08-05T12:00:00.000Z",
  updated_at: "2026-08-05T12:00:00.000Z"
};

describe("calendar data helpers", () => {
  it("creates a month range and shifts months without mutating the anchor", () => {
    const anchor = new Date(2026, 7, 15);

    expect(getMonthRange(anchor)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(shiftMonth(anchor, 1)).toEqual(new Date(2026, 8, 1));
    expect(anchor).toEqual(new Date(2026, 7, 15));
  });

  it("maps snapshots into calendar labels and prescription rows", () => {
    expect(getSessionTitle(session)).toBe("Lower Strength");
    expect(getSessionStateLabel("available")).toBe("Disponível");
    expect(formatPrescription({ kind: "timed", duration_seconds: 900 })).toBe("15 min");
    expect(getSessionBlocks(session)[0].items[0]).toMatchObject({
      name: "Back Squat",
      prescription: "2 × 3-5 · 75% 1RM"
    });
  });

  it("places a session on its calendar date", () => {
    const grid = createCalendarGrid(new Date(2026, 7, 1), [session]);
    const sessionDay = grid.find((day) => day.date === "2026-08-10");

    expect(sessionDay?.sessions).toEqual([session]);
    expect(sessionDay?.isCurrentMonth).toBe(true);
  });

  it("creates a week range starting on Monday and shifts weeks without mutating the anchor", () => {
    const anchor = new Date(2026, 7, 10); // Monday 2026-08-10

    expect(getWeekRange(anchor)).toEqual({ from: "2026-08-10", to: "2026-08-16" });
    expect(shiftWeek(anchor, 1)).toEqual(new Date(2026, 7, 17));
    expect(shiftWeek(anchor, -1)).toEqual(new Date(2026, 7, 3));
    expect(anchor).toEqual(new Date(2026, 7, 10));
  });

  it("resolves the week range from any weekday, not just Monday", () => {
    const wednesday = new Date(2026, 7, 12);

    expect(getWeekRange(wednesday)).toEqual({ from: "2026-08-10", to: "2026-08-16" });
  });

  it("formats a week label within the same month and across a month boundary", () => {
    expect(formatWeekLabel(new Date(2026, 7, 10))).toBe("10 a 16 de agosto de 2026");
    expect(formatWeekLabel(new Date(2026, 7, 1))).toBe("27 de jul a 02 de agosto de 2026");
  });

  it("builds a 7-day week grid, always marking days as current and placing sessions by date", () => {
    const grid = createWeekGrid(new Date(2026, 7, 10), [session]);

    expect(grid).toHaveLength(7);
    expect(grid.every((day) => day.isCurrentMonth)).toBe(true);
    expect(grid[0].date).toBe("2026-08-10");
    expect(grid[6].date).toBe("2026-08-16");

    const sessionDay = grid.find((day) => day.date === "2026-08-10");
    expect(sessionDay?.sessions).toEqual([session]);
  });

  it("builds a week grid spanning a month boundary", () => {
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
});

describe("blocos de texto livre (Condicionamento, LPO, Endurance)", () => {
  const freeTextSession: CalendarSessionRecord = {
    ...session,
    scheduled_date: "2026-08-11",
    snapshot: {
      title: "WOD day",
      blocks: [
        {
          id: "block-cond",
          name: "WOD",
          kind: "conditioning",
          details: {
            description: "AMRAP 12min — 10 thrusters, 8 burpees",
            ranking: { enabled: true, score_type: "rounds-reps" }
          },
          items: []
        },
        {
          id: "block-lpo",
          name: "Técnica",
          kind: "lpo",
          details: {
            description: "Snatch técnico",
            sets: [
              { set_number: 1, reps: 2, load_type: "percentage-1rm", load_value: 80 },
              { set_number: 2, reps: 2, load_type: "percentage-1rm", load_value: 85 }
            ]
          },
          items: []
        },
        {
          id: "block-endurance",
          name: "Aeróbio",
          kind: "endurance",
          details: {
            description: "Ritmo confortável",
            volumes: [
              { modality: "run", value: 5, unit: "km" },
              { modality: "row", value: 2000, unit: "m" }
            ]
          },
          items: []
        }
      ]
    }
  };

  it("lê description, ranking, sets e volumes do details congelado no snapshot", () => {
    const blocks = readSessionBlocks(freeTextSession);

    expect(blocks[0]).toMatchObject({
      kind: "conditioning",
      description: "AMRAP 12min — 10 thrusters, 8 burpees",
      ranking: { enabled: true, scoreType: "rounds-reps" }
    });

    expect(blocks[1]).toMatchObject({
      kind: "lpo",
      description: "Snatch técnico",
      sets: [
        { setNumber: 1, reps: 2, loadType: "percentage-1rm", loadValue: 80 },
        { setNumber: 2, reps: 2, loadType: "percentage-1rm", loadValue: 85 }
      ]
    });

    expect(blocks[2]).toMatchObject({
      kind: "endurance",
      description: "Ritmo confortável",
      volumes: [
        { modality: "run", value: 5, unit: "km" },
        { modality: "row", value: 2000, unit: "m" }
      ]
    });
  });

  it("não confunde ranking desativado com ausência de ranking", () => {
    const blocks = readSessionBlocks({
      ...freeTextSession,
      snapshot: {
        blocks: [{ id: "b", name: "WOD", kind: "conditioning", details: { description: "Fran" } }]
      }
    });

    expect(blocks[0].ranking).toBeNull();
  });

  it("identifica blocos de texto livre pela categoria", () => {
    expect(isFreeTextBlock({ kind: "conditioning" })).toBe(true);
    expect(isFreeTextBlock({ kind: "lpo" })).toBe(true);
    expect(isFreeTextBlock({ kind: "endurance" })).toBe(true);
    expect(isFreeTextBlock({ kind: "strength" })).toBe(false);
    expect(isFreeTextBlock({ kind: "gymnastics-skill" })).toBe(false);
  });

  it("formata o resumo de séries e de volumes para exibição", () => {
    const blocks = readSessionBlocks(freeTextSession);

    expect(formatBlockSets(blocks[1].sets)).toBe("2 × 2 · 80% 1RM");
    expect(formatBlockSets([])).toBe("");
    expect(formatVolumes(blocks[2].volumes)).toBe("5 km de corrida · 2000 m de remo");
  });

  it("inclui o bloco de texto livre na grade do calendário e no display do atleta", () => {
    const grid = createCalendarGrid(new Date(2026, 7, 1), [freeTextSession]);
    const day = grid.find((entry) => entry.date === "2026-08-11");
    expect(day?.sessions).toEqual([freeTextSession]);

    const display = getSessionBlocks(freeTextSession);
    expect(display[0]).toMatchObject({ kind: "conditioning", description: "AMRAP 12min — 10 thrusters, 8 burpees" });
    expect(display[1].sets).toHaveLength(2);
    expect(display[2].volumes).toHaveLength(2);
  });
});
