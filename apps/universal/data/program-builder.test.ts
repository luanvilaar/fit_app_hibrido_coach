import {
  createProgramSchedule,
  resolveProgramDayDate,
  scheduleToRpc,
  validateProgramSchedule
} from "@/data/program-builder";

describe("program builder", () => {
  it("gera a matriz relativa completa de semanas e dias sem datas", () => {
    const schedule = createProgramSchedule(2, [], "template-1");

    expect(schedule).toHaveLength(14);
    expect(schedule[0]).toMatchObject({
      week_number: 1,
      day_number: 1,
      day_type: "training",
      session_template_id: "template-1"
    });
    expect(schedule[13]).toMatchObject({ week_number: 2, day_number: 7, day_type: "unprogrammed" });
    expect(schedule.some((day) => "scheduled_date" in day)).toBe(false);
  });

  it("rejeita lacunas, dias repetidos e tipos incompatíveis", () => {
    expect(validateProgramSchedule([
      { week_number: 1, day_number: 1, day_type: "training", session_template_id: "a" }
    ], 1)).toMatch(/7 dias/);
    const duplicate = createProgramSchedule(1);
    duplicate[6] = { ...duplicate[0] };
    expect(validateProgramSchedule(duplicate, 1)).toMatch(/repetir/);
    const schedule = createProgramSchedule(1);
    schedule[0] = {
      week_number: 1,
      day_number: 1,
      day_type: "recovery",
      session_template_id: "a"
    };
    expect(validateProgramSchedule(schedule, 1)).toMatch(/Recuperação/);
  });

  it("exige ao menos um treino, mas preserva os quatro outros tipos de dia", () => {
    const schedule = createProgramSchedule(1);
    schedule[1] = { week_number: 1, day_number: 2, day_type: "rest", session_template_id: null };
    schedule[2] = { week_number: 1, day_number: 3, day_type: "recovery", session_template_id: null };
    schedule[3] = { week_number: 1, day_number: 4, day_type: "assessment", session_template_id: null };
    expect(validateProgramSchedule(schedule, 1)).toMatch(/sessão/);
    schedule[0] = { week_number: 1, day_number: 1, day_type: "training", session_template_id: "a" };
    expect(validateProgramSchedule(schedule, 1)).toBeNull();
  });

  it("transforma posições relativas em datas próprias para cada aluno", () => {
    const day3 = { week_number: 1, day_number: 3 };
    expect(resolveProgramDayDate("2026-08-17", day3)).toBe("2026-08-19"); // segunda → quarta
    expect(resolveProgramDayDate("2026-08-20", day3)).toBe("2026-08-22"); // quinta → sábado
    expect(resolveProgramDayDate("2026-08-20", { week_number: 2, day_number: 1 })).toBe("2026-08-27");
  });

  it("ordena a agenda antes de enviar ao backend", () => {
    expect(scheduleToRpc([
      { week_number: 2, day_number: 1, day_type: "training", session_template_id: "b" },
      { week_number: 1, day_number: 2, day_type: "rest", session_template_id: null },
      { week_number: 1, day_number: 1, day_type: "training", session_template_id: "a" }
    ])).toEqual([
      { week_number: 1, day_number: 1, day_type: "training", session_template_id: "a" },
      { week_number: 1, day_number: 2, day_type: "rest", session_template_id: null },
      { week_number: 2, day_number: 1, day_type: "training", session_template_id: "b" }
    ]);
  });
});
