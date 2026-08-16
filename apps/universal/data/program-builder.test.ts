import {
  createInitialProgramSchedule,
  scheduleToRpc,
  validateProgramSchedule
} from "@/data/program-builder";

describe("program builder", () => {
  it("cria uma sessão inicial ou descanso sem misturar os dois estados", () => {
    expect(createInitialProgramSchedule("template-1")[0]).toMatchObject({
      week_number: 1,
      day_number: 1,
      is_rest_day: false,
      session_template_id: "template-1"
    });
    expect(createInitialProgramSchedule()[0]).toMatchObject({
      is_rest_day: true,
      session_template_id: null
    });
  });

  it("rejeita dias repetidos, descanso com template e programa só de descanso", () => {
    expect(validateProgramSchedule([
      { week_number: 1, day_number: 1, is_rest_day: false, session_template_id: "a" },
      { week_number: 1, day_number: 1, is_rest_day: false, session_template_id: "b" }
    ])).toMatch(/repetir/);
    expect(validateProgramSchedule([
      { week_number: 1, day_number: 1, is_rest_day: true, session_template_id: "a" }
    ])).toMatch(/descanso/);
    expect(validateProgramSchedule([
      { week_number: 1, day_number: 1, is_rest_day: true, session_template_id: null }
    ])).toMatch(/sessão/);
  });

  it("ordena a agenda antes de enviar ao backend", () => {
    expect(scheduleToRpc([
      { week_number: 2, day_number: 1, is_rest_day: false, session_template_id: "b" },
      { week_number: 1, day_number: 2, is_rest_day: true, session_template_id: null },
      { week_number: 1, day_number: 1, is_rest_day: false, session_template_id: "a" }
    ])).toEqual([
      { week_number: 1, day_number: 1, is_rest_day: false, session_template_id: "a" },
      { week_number: 1, day_number: 2, is_rest_day: true, session_template_id: null },
      { week_number: 2, day_number: 1, is_rest_day: false, session_template_id: "b" }
    ]);
  });
});
