import {
  addGroupMembers,
  applySessionToGroup,
  createSessionTemplate,
  createTrainingGroup,
  updateSessionInstancePrescription
} from "@/data/coach-flow";

describe("coach team and prescription flow", () => {
  it("creates a team and applies an editable prescription to its athletes", () => {
    const group = createTrainingGroup({
      id: "team-strength-01",
      name: "Strength Base",
      description: "Equipe para construir força com consistência.",
      level: "intermediário",
      objective: "Aumentar força nos levantamentos principais."
    });

    const groupWithMembers = addGroupMembers(group, {
      coachIds: ["coach-uma"],
      athleteIds: ["athlete-lia", "athlete-caio", "athlete-caio"]
    });

    const template = createSessionTemplate({
      id: "session-lower-strength",
      title: "Lower Strength · Semana 01",
      status: "published",
      blocks: [
        {
          id: "block-strength",
          name: "Força principal",
          kind: "strength",
          items: [
            {
              id: "item-back-squat",
              exerciseId: "back-squat",
              exerciseName: "Back Squat",
              prescription: {
                kind: "sets-reps",
                sets: 5,
                reps: { min: 3, max: 5 },
                load: { type: "percentage-1rm", value: 75, unit: "%" },
                effort: { type: "rpe", value: 8 },
                restSeconds: 150,
                notes: "Manter duas repetições em reserva quando necessário."
              }
            }
          ]
        }
      ]
    });

    const scheduledSession = applySessionToGroup(groupWithMembers, template, {
      id: "instance-strength-2026-08-10",
      scheduledDate: "2026-08-10",
      status: "published"
    });

    expect(groupWithMembers).toMatchObject({
      id: "team-strength-01",
      coachIds: ["coach-uma"],
      athleteIds: ["athlete-lia", "athlete-caio"]
    });
    expect(scheduledSession).toMatchObject({
      templateId: "session-lower-strength",
      groupId: "team-strength-01",
      athleteIds: ["athlete-lia", "athlete-caio"],
      scheduledDate: "2026-08-10",
      status: "published"
    });
    expect(scheduledSession.blocks[0].items[0].prescription).toMatchObject({
      kind: "sets-reps",
      sets: 5,
      reps: { min: 3, max: 5 },
      load: { type: "percentage-1rm", value: 75 },
      effort: { type: "rpe", value: 8 }
    });
  });

  it("keeps the library template unchanged when the coach adapts the group session", () => {
    const group = addGroupMembers(
      createTrainingGroup({
        id: "team-conditioning-01",
        name: "Conditioning Base",
        description: "Equipe para desenvolver capacidade de trabalho.",
        level: "iniciante",
        objective: "Criar consistência no condicionamento."
      }),
      { athleteIds: ["athlete-nina"] }
    );
    const template = createSessionTemplate({
      id: "session-conditioning-01",
      title: "Conditioning · Semana 01",
      blocks: [
        {
          id: "block-conditioning",
          name: "Condicionamento",
          kind: "conditioning",
          items: [
            {
              id: "item-row",
              exerciseId: "row",
              exerciseName: "Remo",
              prescription: { kind: "timed", seconds: 900, restSeconds: 120 }
            }
          ]
        }
      ]
    });
    const scheduledSession = applySessionToGroup(group, template, {
      id: "instance-conditioning-2026-08-11",
      scheduledDate: "2026-08-11"
    });

    const adaptedSession = updateSessionInstancePrescription(
      scheduledSession,
      "block-conditioning",
      "item-row",
      { kind: "timed", seconds: 720, restSeconds: 120, notes: "Adaptado para a prontidão do grupo." }
    );

    expect(adaptedSession.blocks[0].items[0].prescription).toMatchObject({ seconds: 720 });
    expect(template.blocks[0].items[0].prescription).toMatchObject({ seconds: 900 });
    expect(scheduledSession.blocks[0].items[0].prescription).toMatchObject({ seconds: 900 });
  });

  it("requires athletes and a valid calendar date before applying a session", () => {
    const group = createTrainingGroup({
      id: "team-empty",
      name: "Equipe vazia",
      description: "Grupo de teste.",
      level: "iniciante",
      objective: "Validar regras do fluxo."
    });
    const template = createSessionTemplate({
      id: "session-empty-check",
      title: "Sessão de validação",
      blocks: [
        {
          id: "block-check",
          name: "Bloco",
          kind: "custom",
          items: [
            {
              id: "item-check",
              exerciseId: "push-up",
              exerciseName: "Push-up",
              prescription: { kind: "sets-reps", sets: 3, reps: 10 }
            }
          ]
        }
      ]
    });

    expect(() =>
      applySessionToGroup(group, template, {
        id: "instance-invalid",
        scheduledDate: "10/08/2026"
      })
    ).toThrow("Adicione pelo menos um atleta");

    const staffedGroup = addGroupMembers(group, { athleteIds: ["athlete-001"] });
    expect(() =>
      applySessionToGroup(staffedGroup, template, {
        id: "instance-invalid-date",
        scheduledDate: "10/08/2026"
      })
    ).toThrow("AAAA-MM-DD");
  });
});
