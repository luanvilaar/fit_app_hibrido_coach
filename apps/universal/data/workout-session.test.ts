import type { AthleteSetResultRecord, CalendarSessionRecord } from "@fitblock/backend";
import {
  buildWorkoutExercises,
  countSessionSets,
  getCompletedSetCount,
  resolveSessionOutcome,
  sanitizeNumericInput,
  toNumberOrNull
} from "@/data/workout-session";

const session: CalendarSessionRecord = {
  id: "instance-01",
  template_id: "template-01",
  team_id: "team-01",
  scheduled_date: "2026-08-06",
  status: "published",
  state: "available",
  coach_note: "",
  snapshot: {
    title: "Base forte",
    blocks: [
      {
        id: "block-01",
        name: "Força principal",
        kind: "strength",
        items: [
          {
            id: "item-01",
            exercise_name: "Back Squat",
            exercise_video_url: "https://youtu.be/exemplo",
            prescription: {
              kind: "sets-reps",
              rest_seconds: 150,
              sets: [
                { set_number: 1, reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 },
                { set_number: 2, reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 }
              ]
            }
          }
        ]
      },
      {
        id: "block-02",
        name: "Condicionamento",
        kind: "conditioning",
        items: [
          {
            id: "item-02",
            exercise_name: "Assault Bike",
            prescription: { kind: "amrap", minutes: 10, sets: [] }
          }
        ]
      },
      {
        id: "block-03",
        name: "Skill",
        kind: "gymnastics-skill",
        items: [
          {
            id: "item-03",
            exercise_name: "CTB Pull Ups",
            prescription: { kind: "qualitative", notes: "3 tentativas, foco na transição" }
          }
        ]
      }
    ]
  },
  created_by: "coach-01",
  created_at: "2026-08-05T12:00:00.000Z",
  updated_at: "2026-08-05T12:00:00.000Z"
};

const storedResult: AthleteSetResultRecord = {
  id: "result-01",
  session_id: "instance-01",
  athlete_id: "athlete-01",
  block_item_id: "item-01",
  set_number: 1,
  reps: 5,
  load_kg: 82.5,
  completed: true
};

describe("execução da sessão do atleta", () => {
  it("monta os exercícios da sessão com vídeo, alvo e resultados já registrados", () => {
    const exercises = buildWorkoutExercises(session, [storedResult]);

    expect(exercises).toHaveLength(3);
    expect(exercises[0]).toMatchObject({
      itemId: "item-01",
      blockName: "Força principal",
      name: "Back Squat",
      videoUrl: "https://youtu.be/exemplo",
      targetSummary: "2 × 3-5 reps · 75% 1RM",
      restLabel: "Descanso 150s",
      isQualitative: false
    });
    expect(exercises[0].sets[0]).toMatchObject({
      setNumber: 1,
      reps: "5",
      kilograms: "82.5",
      completed: true,
      target: "3-5 reps · 75% 1RM"
    });
    expect(exercises[0].sets[1]).toMatchObject({ reps: "", kilograms: "", completed: false });
  });

  it("dá uma linha de registro para prescrições sem série definida", () => {
    const exercises = buildWorkoutExercises(session, []);

    expect(exercises[1].targetSummary).toBe("AMRAP · 10 min");
    expect(exercises[1].sets).toHaveLength(1);
  });

  it("marca exercício qualitativo (Ginástica) sem tabela de reps/carga, com uma linha de conclusão única", () => {
    const exercises = buildWorkoutExercises(session, []);
    const skillExercise = exercises[2];

    expect(skillExercise).toMatchObject({
      itemId: "item-03",
      name: "CTB Pull Ups",
      isQualitative: true,
      notes: "3 tentativas, foco na transição"
    });
    expect(skillExercise.sets).toHaveLength(1);
    expect(skillExercise.sets[0]).toMatchObject({ setNumber: 1, completed: false });
  });

  it("mantém apenas valores numéricos não negativos nos campos de resultado", () => {
    expect(sanitizeNumericInput("12kg")).toBe("12");
    expect(sanitizeNumericInput("20,5")).toBe("20.5");
    expect(sanitizeNumericInput("-8")).toBe("8");
    expect(sanitizeNumericInput("3.5.2")).toBe("3.52");
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull("32.5")).toBe(32.5);
  });

  it("conta séries concluídas e resolve o desfecho da sessão", () => {
    const exercises = buildWorkoutExercises(session, [storedResult]);

    expect(getCompletedSetCount(exercises[0].sets)).toBe(1);
    expect(countSessionSets(exercises)).toEqual({ completed: 1, total: 4 });
    expect(resolveSessionOutcome(exercises)).toBe("partially_completed");
    expect(resolveSessionOutcome(buildWorkoutExercises(session, []))).toBeNull();

    const allDone = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set, completed: true }))
    }));
    expect(resolveSessionOutcome(allDone)).toBe("completed");
  });
});
