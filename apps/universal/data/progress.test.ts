import type { AthleteSessionProgressRecord, CalendarSessionRecord } from "@fitblock/backend";
import {
  describeSessionHistoryMeta,
  describeSessionHistoryStatus,
  describeStreak,
  formatPersonalRecordDate,
  formatPersonalRecordLoad,
  formatWeekAxisLabel,
  getSessionHistoryTitle,
  getWeeklyRate,
  sortPersonalRecords
} from "@/data/progress";

const session: CalendarSessionRecord = {
  id: "instance-01",
  template_id: "template-01",
  team_id: "team-01",
  scheduled_date: "2026-08-06",
  status: "published",
  state: "completed",
  coach_note: "",
  snapshot: {
    title: "Base forte",
    blocks: [
      {
        id: "block-01",
        name: "Força principal",
        kind: "strength",
        details: {
          schema_version: 3,
          body: "@Back Squat\n4 x 5",
          volume: { sets: 4, reps: 20, source: "auto" }
        },
        items: [
          {
            id: "item-01",
            exercise_slug: "back-squat",
            exercise_name: "Back Squat",
            prescription: { kind: "reference" }
          }
        ]
      }
    ]
  },
  created_by: "coach-01",
  created_at: "2026-08-05T12:00:00.000Z",
  updated_at: "2026-08-06T10:32:00.000Z"
};

const completedProgress: AthleteSessionProgressRecord = {
  id: "progress-01",
  session_id: "instance-01",
  athlete_id: "athlete-01",
  state: "completed",
  completed_block_ids: ["block-01"],
  started_at: "2026-08-06T10:00:00.000Z",
  completed_at: "2026-08-06T10:45:00.000Z",
  created_at: "2026-08-06T10:00:00.000Z",
  updated_at: "2026-08-06T10:45:00.000Z"
};

describe("describeStreak", () => {
  it("convida a começar quando não há dias de sequência", () => {
    expect(describeStreak(0)).toBe("Comece sua sequência");
  });

  it("usa o singular para um dia", () => {
    expect(describeStreak(1)).toBe("1 dia de consistência");
  });

  it("usa o plural para mais de um dia", () => {
    expect(describeStreak(12)).toBe("12 dias de consistência");
  });
});

describe("getWeeklyRate", () => {
  it("retorna zero quando não há sessões planejadas", () => {
    expect(getWeeklyRate({ week_start: "2026-08-03", planned: 0, completed: 0 })).toBe(0);
  });

  it("calcula a proporção concluída sobre o planejado", () => {
    expect(getWeeklyRate({ week_start: "2026-08-03", planned: 4, completed: 3 })).toBeCloseTo(0.75);
  });

  it("nunca ultrapassa 1 mesmo com mais concluído que planejado", () => {
    expect(getWeeklyRate({ week_start: "2026-08-03", planned: 2, completed: 3 })).toBe(1);
  });
});

describe("formatWeekAxisLabel", () => {
  it("formata a data de início da semana como dd/mm", () => {
    expect(formatWeekAxisLabel("2026-08-03")).toBe("03/08");
  });
});

describe("formatPersonalRecordLoad", () => {
  it("omite casas decimais para cargas inteiras", () => {
    expect(formatPersonalRecordLoad(100)).toBe("100 kg");
  });

  it("usa vírgula decimal para cargas fracionárias", () => {
    expect(formatPersonalRecordLoad(82.5)).toBe("82,5 kg");
  });
});

describe("formatPersonalRecordDate", () => {
  it("formata a data do recorde sem o ano", () => {
    expect(formatPersonalRecordDate("2026-08-01")).toBe("01 de ago");
  });
});

describe("sortPersonalRecords", () => {
  it("ordena os recordes da maior para a menor carga", () => {
    const records = sortPersonalRecords([
      { exercise_name: "Deadlift", load_kg: 140, reps: 3, achieved_on: "2026-07-20" },
      { exercise_name: "Back Squat", load_kg: 100, reps: 5, achieved_on: "2026-08-01" }
    ]);

    expect(records.map((record) => record.exercise_name)).toEqual(["Deadlift", "Back Squat"]);
  });
});

describe("session history helpers", () => {
  it("descreve título, meta e status de uma sessão concluída", () => {
    const entry = { session, progress: completedProgress };

    expect(getSessionHistoryTitle(entry)).toBe("Base forte");
    expect(describeSessionHistoryMeta(entry)).toBe("06 de ago · Força · ≈ 5 min");
    expect(describeSessionHistoryStatus(completedProgress)).toBe("Concluído");
  });

  it("marca sessões parcialmente concluídas como Parcial", () => {
    expect(describeSessionHistoryStatus({ ...completedProgress, state: "partially_completed" })).toBe("Parcial");
  });
});
