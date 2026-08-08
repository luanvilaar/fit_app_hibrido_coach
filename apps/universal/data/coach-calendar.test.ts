import type { CalendarSessionRecord, ExerciseRecord } from "@fitblock/backend";
import {
  addBlock,
  addBlockSet,
  addItem,
  addSet,
  buildCoachSessionPayload,
  createBlockForm,
  createInitialCoachSessionForm,
  createItemForm,
  createSetForm,
  describeCoachBackendError,
  exerciseCategoryIsQualitative,
  filterExerciseSuggestions,
  findExerciseByName,
  getSessionBlockKinds,
  monthAnchorFromDate,
  removeBlock,
  removeBlockSet,
  removeItem,
  removeSet,
  summarizeCoachSessionForm,
  toCoachSessionForm,
  updateBlockRanking,
  updateBlockVolume,
  updateSessionField,
  type CoachSessionForm
} from "@/data/coach-calendar";

function buildExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: "exercise-01",
    slug: "back-squat",
    name: "Back Squat",
    video_url: null,
    category: null,
    created_by: null,
    created_at: "2026-08-06T14:00:00.000Z",
    ...overrides
  };
}

function buildForm(overrides: Partial<CoachSessionForm> = {}): CoachSessionForm {
  return {
    ...createInitialCoachSessionForm("team-01"),
    title: "Lower Strength",
    scheduledDate: "2026-08-10",
    ...overrides
  };
}

describe("modelo de sessão do coach", () => {
  it("usa a data local de amanhã, não a data UTC", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expected = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0")
    ].join("-");

    expect(createInitialCoachSessionForm().scheduledDate).toBe(expected);
  });

  it("resume blocos, exercícios e séries do formulário", () => {
    const form = buildForm({
      blocks: [
        createBlockForm({ items: [createItemForm({ sets: [createSetForm(), createSetForm()] })] }),
        createBlockForm({ items: [createItemForm(), createItemForm()] })
      ]
    });

    expect(summarizeCoachSessionForm(form)).toEqual({ blocks: 2, exercises: 3, sets: 4 });
  });

  it("não conta exercícios nem séries de exercício em blocos de texto livre", () => {
    const form = buildForm({
      blocks: [
        createBlockForm({ kind: "strength", items: [createItemForm({ sets: [createSetForm()] })] }),
        createBlockForm({ kind: "conditioning", description: "AMRAP 12min" }),
        createBlockForm({ kind: "lpo", description: "Técnica", sets: [createSetForm(), createSetForm()] })
      ]
    });

    // 1 exercício/1 série do bloco de força; condicionamento não conta nada; LPO conta as 2 séries do bloco, sem exercício.
    expect(summarizeCoachSessionForm(form)).toEqual({ blocks: 3, exercises: 1, sets: 3 });
  });

  it("mantém os mínimos estruturais ao remover", () => {
    const form = buildForm();
    const block = form.blocks[0];
    const item = block.items[0];

    expect(removeBlock(form, block.id).blocks).toHaveLength(1);
    expect(removeItem(form, block.id, item.id).blocks[0].items).toHaveLength(1);

    const singleSet = buildForm({
      blocks: [createBlockForm({ items: [createItemForm({ sets: [createSetForm()] })] })]
    });
    const singleSetItem = singleSet.blocks[0].items[0];
    expect(
      removeSet(singleSet, singleSet.blocks[0].id, singleSetItem.id, singleSetItem.sets[0].id).blocks[0].items[0].sets
    ).toHaveLength(1);

    const singleBlockSet = buildForm({ blocks: [createBlockForm({ kind: "lpo", sets: [createSetForm()] })] });
    expect(
      removeBlockSet(singleBlockSet, singleBlockSet.blocks[0].id, singleBlockSet.blocks[0].sets[0].id).blocks[0].sets
    ).toHaveLength(1);
  });

  it("adiciona bloco, exercício e série repetindo a última série", () => {
    const form = buildForm();
    const block = form.blocks[0];
    const item = block.items[0];

    expect(addBlock(form).blocks).toHaveLength(2);
    expect(addItem(form, block.id).blocks[0].items).toHaveLength(2);

    const withSet = addSet(form, block.id, item.id);
    const sets = withSet.blocks[0].items[0].sets;
    expect(sets).toHaveLength(item.sets.length + 1);
    expect(sets[sets.length - 1]).toMatchObject({ reps: "3-5", load: "75", loadType: "percentage-1rm" });
  });

  it("adiciona série no bloco de LPO repetindo a última", () => {
    const form = buildForm({
      blocks: [createBlockForm({ kind: "lpo", sets: [createSetForm({ reps: "3", load: "80" })] })]
    });

    const sets = addBlockSet(form, form.blocks[0].id).blocks[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[1]).toMatchObject({ reps: "3", load: "80", loadType: "percentage-1rm" });
  });

  it("ativa o ranking do bloco de condicionamento e escolhe o tipo de score", () => {
    const form = buildForm({ blocks: [createBlockForm({ kind: "conditioning" })] });

    const withRanking = updateBlockRanking(form, form.blocks[0].id, { enabled: true, scoreType: "rounds-reps" });
    expect(withRanking.blocks[0].ranking).toEqual({ enabled: true, scoreType: "rounds-reps" });
  });

  it("ativa o volume de uma modalidade de endurance", () => {
    const form = buildForm({ blocks: [createBlockForm({ kind: "endurance" })] });

    const withVolume = updateBlockVolume(form, form.blocks[0].id, "run", { enabled: true, volume: "5", unit: "km" });
    const runVolume = withVolume.blocks[0].volumes.find((volume) => volume.modality === "run");
    expect(runVolume).toEqual({ modality: "run", enabled: true, volume: "5", unit: "km" });
  });
});

describe("payload da sessão do coach", () => {
  it("monta múltiplos blocos, exercícios e séries individuais", () => {
    const payload = buildCoachSessionPayload(
      buildForm({
        blocks: [
          createBlockForm({
            name: "Força principal",
            kind: "strength",
            items: [
              createItemForm({
                exerciseName: "Back Squat",
                restSeconds: "150",
                sets: [
                  createSetForm({ reps: "5", load: "70" }),
                  createSetForm({ reps: "3-5", load: "80" })
                ]
              }),
              createItemForm({
                exerciseName: "Romanian Deadlift",
                restSeconds: "",
                sets: [createSetForm({ reps: "8", load: "" })]
              })
            ]
          }),
          createBlockForm({
            name: "Skill",
            kind: "gymnastics-skill",
            items: [
              createItemForm({ exerciseName: "Kipping skin the cat", restSeconds: "60", sets: [createSetForm({ reps: "6" })] })
            ]
          })
        ]
      })
    );

    expect(payload).toMatchObject({
      teamId: "team-01",
      title: "Lower Strength",
      scheduledDate: "2026-08-10",
      status: "published",
      blocks: [
        {
          name: "Força principal",
          kind: "strength",
          items: [
            {
              exerciseSlug: "back-squat",
              exerciseName: "Back Squat",
              prescription: {
                kind: "sets-reps",
                rest_seconds: 150,
                sets: [
                  { reps: 5, load_type: "percentage-1rm", load_value: 70 },
                  { reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 80 }
                ]
              }
            },
            {
              exerciseSlug: "romanian-deadlift",
              prescription: { kind: "sets-reps", sets: [{ reps: 8 }] }
            }
          ]
        },
        {
          name: "Skill",
          kind: "gymnastics-skill",
          items: [{ exerciseSlug: "kipping-skin-the-cat" }]
        }
      ]
    });

    expect(payload.blocks[0].items[1].prescription).not.toHaveProperty("rest_seconds");
    expect(payload.blocks[0].items[1].prescription).toMatchObject({ sets: [{ reps: 8 }] });
  });

  it("monta bloco de condicionamento com descrição e sem ranking por padrão", () => {
    const payload = buildCoachSessionPayload(
      buildForm({ blocks: [createBlockForm({ kind: "conditioning", description: "AMRAP 12min — 10 thrusters" })] })
    );

    expect(payload.blocks[0]).toMatchObject({
      kind: "conditioning",
      details: { description: "AMRAP 12min — 10 thrusters" },
      items: []
    });
    expect(payload.blocks[0].details).not.toHaveProperty("ranking");
  });

  it("inclui o ranking no payload quando o coach ativa", () => {
    const form = buildForm({ blocks: [createBlockForm({ kind: "conditioning", description: "Fran" })] });
    const withRanking = updateBlockRanking(form, form.blocks[0].id, { enabled: true, scoreType: "time" });

    const payload = buildCoachSessionPayload(withRanking);

    expect(payload.blocks[0].details).toMatchObject({
      description: "Fran",
      ranking: { enabled: true, score_type: "time" }
    });
  });

  it("exige descrição em blocos de texto livre", () => {
    expect(() =>
      buildCoachSessionPayload(buildForm({ blocks: [createBlockForm({ kind: "conditioning", description: "" })] }))
    ).toThrow("Bloco 1: descrição do bloco é obrigatório.");
  });

  it("monta bloco de LPO com séries do próprio bloco, sem exercício", () => {
    const payload = buildCoachSessionPayload(
      buildForm({
        blocks: [
          createBlockForm({
            kind: "lpo",
            description: "Snatch técnico",
            sets: [createSetForm({ reps: "2", load: "80" }), createSetForm({ reps: "2", load: "85" })]
          })
        ]
      })
    );

    expect(payload.blocks[0]).toMatchObject({
      kind: "lpo",
      items: [],
      details: {
        description: "Snatch técnico",
        sets: [
          { set_number: 1, reps: 2, load_type: "percentage-1rm", load_value: 80 },
          { set_number: 2, reps: 2, load_type: "percentage-1rm", load_value: 85 }
        ]
      }
    });
  });

  it("monta bloco de endurance só com as modalidades ativadas", () => {
    const form = buildForm({ blocks: [createBlockForm({ kind: "endurance", description: "Ritmo confortável" })] });
    const withVolumes = updateBlockVolume(
      updateBlockVolume(form, form.blocks[0].id, "run", { enabled: true, volume: "5", unit: "km" }),
      form.blocks[0].id,
      "bike",
      { enabled: true, volume: "20", unit: "min" }
    );

    const payload = buildCoachSessionPayload(withVolumes);

    expect(payload.blocks[0].details).toMatchObject({
      description: "Ritmo confortável",
      volumes: [
        { modality: "run", value: 5, unit: "km" },
        { modality: "bike", value: 20, unit: "min" }
      ]
    });
  });

  it("rejeita bloco de endurance sem nenhuma modalidade ativada", () => {
    expect(() =>
      buildCoachSessionPayload(buildForm({ blocks: [createBlockForm({ kind: "endurance", description: "Rodagem" })] }))
    ).toThrow("Bloco 1: escolha pelo menos uma modalidade de endurance.");
  });

  it("monta prescrição qualitativa (Ginástica) sem séries, com o texto livre em notes", () => {
    const payload = buildCoachSessionPayload(
      buildForm({
        blocks: [
          createBlockForm({
            name: "Skill",
            kind: "gymnastics-skill",
            items: [
              createItemForm({
                exerciseName: "CTB Pull Ups",
                category: "ginastica",
                notes: "3 tentativas, foco na transição",
                restSeconds: "90"
              })
            ]
          })
        ]
      })
    );

    expect(payload.blocks[0].items[0]).toMatchObject({
      exerciseSlug: "ctb-pull-ups",
      exerciseName: "CTB Pull Ups",
      exerciseCategory: "ginastica",
      prescription: { kind: "qualitative", notes: "3 tentativas, foco na transição" }
    });
    expect(payload.blocks[0].items[0].prescription).not.toHaveProperty("sets");
    expect(payload.blocks[0].items[0].prescription).not.toHaveProperty("rest_seconds");
  });

  it("exige o texto do movimento qualitativo (Ginástica)", () => {
    expect(() =>
      buildCoachSessionPayload(
        buildForm({
          blocks: [
            createBlockForm({
              items: [createItemForm({ exerciseName: "CTB Pull Ups", category: "ginastica", notes: "" })]
            })
          ]
        })
      )
    ).toThrow("Bloco 1 · exercício 1: descrição é obrigatório.");
  });

  it("respeita o rascunho escolhido pelo coach", () => {
    const payload = buildCoachSessionPayload(updateSessionField(buildForm(), "status", "draft"));

    expect(payload.status).toBe("draft");
  });

  it("rejeita sessão incompleta apontando onde está o erro", () => {
    expect(() => buildCoachSessionPayload(buildForm({ title: "" }))).toThrow("Título da sessão é obrigatório.");

    expect(() => buildCoachSessionPayload(buildForm({ scheduledDate: "10/08/2026" }))).toThrow(
      "Use a data no formato AAAA-MM-DD."
    );

    expect(() =>
      buildCoachSessionPayload(buildForm({ blocks: [createBlockForm({ name: "  " })] }))
    ).toThrow("Bloco 1: nome do bloco é obrigatório.");

    expect(() =>
      buildCoachSessionPayload(
        buildForm({ blocks: [createBlockForm({ items: [createItemForm({ exerciseName: "" })] })] })
      )
    ).toThrow("Bloco 1 · exercício 1: exercício é obrigatório.");

    expect(() =>
      buildCoachSessionPayload(
        buildForm({
          blocks: [
            createBlockForm({
              items: [createItemForm({ exerciseName: "Power Snatch", sets: [createSetForm({ reps: "5-3" })] })]
            })
          ]
        })
      )
    ).toThrow("Bloco 1 · exercício 1 · série 1: repetições: a faixa de repetições é inválida.");
  });
});

describe("hidratação da sessão para edição", () => {
  const session: CalendarSessionRecord = {
    id: "instance-01",
    template_id: "template-01",
    team_id: "team-09",
    scheduled_date: "2026-08-12",
    status: "draft",
    state: "available",
    coach_note: "",
    created_by: "coach-01",
    created_at: "2026-08-06T12:00:00.000Z",
    updated_at: "2026-08-06T12:00:00.000Z",
    snapshot: {
      title: "Upper Strength",
      blocks: [
        {
          name: "Força principal",
          kind: "strength",
          details: {},
          items: [
            {
              exercise_name: "Power Snatch",
              prescription: {
                kind: "sets-reps",
                rest_seconds: 180,
                sets: [
                  { reps: 3, load_type: "percentage-1rm", load_value: 82 },
                  { reps_min: 2, reps_max: 4 }
                ]
              }
            }
          ]
        },
        {
          name: "WOD",
          kind: "conditioning",
          details: { description: "AMRAP 12min", ranking: { enabled: true, score_type: "rounds-reps" } },
          items: []
        },
        {
          name: "Técnica",
          kind: "lpo",
          details: {
            description: "Snatch",
            sets: [{ set_number: 1, reps: 2, load_type: "percentage-1rm", load_value: 80 }]
          },
          items: []
        },
        {
          name: "Aeróbio",
          kind: "endurance",
          details: {
            description: "Rodagem leve",
            volumes: [{ modality: "run", value: 5, unit: "km" }]
          },
          items: []
        }
      ]
    }
  };

  it("converte o snapshot no formulário do editor", () => {
    const form = toCoachSessionForm(session);

    expect(form).toMatchObject({
      teamId: "team-09",
      title: "Upper Strength",
      scheduledDate: "2026-08-12",
      status: "draft"
    });
    expect(form.blocks).toHaveLength(4);

    expect(form.blocks[0]).toMatchObject({
      name: "Força principal",
      kind: "strength",
      items: [
        {
          exerciseName: "Power Snatch",
          restSeconds: "180",
          sets: [
            { reps: "3", load: "82", loadType: "percentage-1rm" },
            { reps: "2-4", load: "", loadType: "percentage-1rm" }
          ]
        }
      ]
    });

    expect(form.blocks[1]).toMatchObject({
      name: "WOD",
      kind: "conditioning",
      description: "AMRAP 12min",
      ranking: { enabled: true, scoreType: "rounds-reps" }
    });

    expect(form.blocks[2]).toMatchObject({
      name: "Técnica",
      kind: "lpo",
      description: "Snatch",
      sets: [{ reps: "2", load: "80", loadType: "percentage-1rm" }]
    });

    const enduranceBlock = form.blocks.find((block) => block.kind === "endurance");
    expect(enduranceBlock?.description).toBe("Rodagem leve");
    const runVolume = enduranceBlock?.volumes.find((volume) => volume.modality === "run");
    expect(runVolume).toEqual({ modality: "run", enabled: true, volume: "5", unit: "km" });
    const rowVolume = enduranceBlock?.volumes.find((volume) => volume.modality === "row");
    expect(rowVolume).toMatchObject({ enabled: false, volume: "" });
  });

  it("regenera um payload equivalente ao snapshot de origem", () => {
    const payload = buildCoachSessionPayload(toCoachSessionForm(session));

    expect(payload.blocks[0]).toMatchObject({
      name: "Força principal",
      kind: "strength",
      items: [
        {
          exerciseSlug: "power-snatch",
          prescription: {
            rest_seconds: 180,
            sets: [
              { reps: 3, load_type: "percentage-1rm", load_value: 82 },
              { reps_min: 2, reps_max: 4 }
            ]
          }
        }
      ]
    });

    expect(payload.blocks[1]).toMatchObject({
      kind: "conditioning",
      details: { description: "AMRAP 12min", ranking: { enabled: true, score_type: "rounds-reps" } }
    });

    expect(payload.blocks[3]).toMatchObject({
      kind: "endurance",
      details: { description: "Rodagem leve", volumes: [{ modality: "run", value: 5, unit: "km" }] }
    });
  });

  it("sobrevive a snapshot vazio ou corrompido", () => {
    const form = toCoachSessionForm({ ...session, snapshot: { blocks: "quebrado" } });

    expect(form.title).toBe("");
    expect(form.blocks).toHaveLength(1);
    expect(form.blocks[0].items).toHaveLength(1);
    expect(form.blocks[0].items[0].sets).toHaveLength(1);
  });

  it("hidrata item qualitativo (Ginástica) sem injetar série falsa", () => {
    const qualitativeForm = toCoachSessionForm({
      ...session,
      snapshot: {
        title: "Skill day",
        blocks: [
          {
            name: "Skill",
            kind: "gymnastics-skill",
            items: [
              {
                exercise_name: "CTB Pull Ups",
                prescription: { kind: "qualitative", notes: "3 tentativas, foco na transição" }
              }
            ]
          }
        ]
      }
    });

    expect(qualitativeForm.blocks[0].items[0]).toMatchObject({
      exerciseName: "CTB Pull Ups",
      category: "ginastica",
      notes: "3 tentativas, foco na transição",
      sets: []
    });
    expect(exerciseCategoryIsQualitative(qualitativeForm.blocks[0].items[0].category)).toBe(true);

    // Regenerar o payload a partir do formulário hidratado reproduz a mesma prescrição qualitativa.
    const payload = buildCoachSessionPayload(qualitativeForm);
    expect(payload.blocks[0].items[0].prescription).toMatchObject({
      kind: "qualitative",
      notes: "3 tentativas, foco na transição"
    });
  });

  it("mapeia categoria legada (warm-up/cooldown/custom) e tipo desconhecido para Força", () => {
    const legacyForm = toCoachSessionForm({
      ...session,
      snapshot: {
        title: "X",
        blocks: [
          { name: "Aquecimento", kind: "warm-up", items: [{ exercise_name: "Mobilidade", prescription: { kind: "sets-reps", sets: [] } }] },
          { name: "Y", kind: "hipertrofia", items: [] }
        ]
      }
    });

    expect(legacyForm.blocks[0].kind).toBe("strength");
    expect(legacyForm.blocks[0].items[0].exerciseName).toBe("Mobilidade");
    expect(legacyForm.blocks[1].kind).toBe("strength");
  });
});

describe("utilitários do painel", () => {
  it("resolve a âncora do mês a partir da data salva", () => {
    const anchor = monthAnchorFromDate("2026-09-21");

    expect(anchor.getFullYear()).toBe(2026);
    expect(anchor.getMonth()).toBe(8);
    expect(anchor.getDate()).toBe(1);
  });

  it("lista as categorias de bloco de uma sessão, sem repetição", () => {
    const session: CalendarSessionRecord = {
      id: "instance-01",
      template_id: "template-01",
      team_id: "team-01",
      scheduled_date: "2026-08-12",
      status: "published",
      state: "available",
      coach_note: "",
      created_by: "coach-01",
      created_at: "2026-08-06T12:00:00.000Z",
      updated_at: "2026-08-06T12:00:00.000Z",
      snapshot: {
        title: "Upper Strength",
        blocks: [
          { name: "Força principal", kind: "strength", items: [] },
          { name: "Força acessória", kind: "strength", items: [] },
          { name: "WOD", kind: "conditioning", items: [] }
        ]
      }
    };

    expect(getSessionBlockKinds(session)).toEqual(["strength", "conditioning"]);
  });

  it("mapeia categorias legadas do snapshot para força, o único fallback sem perda", () => {
    const session: CalendarSessionRecord = {
      id: "instance-02",
      template_id: "template-01",
      team_id: "team-01",
      scheduled_date: "2026-08-12",
      status: "published",
      state: "available",
      coach_note: "",
      created_by: "coach-01",
      created_at: "2026-08-06T12:00:00.000Z",
      updated_at: "2026-08-06T12:00:00.000Z",
      snapshot: {
        title: "Sessão legada",
        blocks: [{ name: "Aquecimento", kind: "warm-up", items: [] }]
      }
    };

    expect(getSessionBlockKinds(session)).toEqual(["strength"]);
  });

  it("traduz falhas técnicas do backend", () => {
    expect(describeCoachBackendError(new Error("permission denied for function update_session_instance"))).toBe(
      "Você não tem permissão para esta operação."
    );
    expect(describeCoachBackendError(new Error("function public.update_session_instance does not exist"))).toBe(
      "Recurso indisponível no servidor. Confirme se as migrations pendentes foram aplicadas."
    );
    expect(describeCoachBackendError(new Error("A equipe precisa ter pelo menos um atleta."))).toBe(
      "A equipe precisa ter pelo menos um atleta."
    );
    expect(describeCoachBackendError("falha")).toBe("Não foi possível concluir a operação. Tente novamente.");
  });
});

describe("sugestão de exercícios já cadastrados", () => {
  const exercises = [
    buildExercise({ id: "ex-1", slug: "back-squat", name: "Back Squat" }),
    buildExercise({ id: "ex-2", slug: "power-snatch", name: "Power Snatch" }),
    buildExercise({ id: "ex-3", slug: "back-lunge", name: "Back Lunge" }),
    buildExercise({ id: "ex-4", slug: "elevacao-pelvica", name: "Elevação Pélvica" })
  ];

  it("casa por slug, ignorando acento, caixa e espaçamento", () => {
    expect(filterExerciseSuggestions(exercises, "back")).toEqual([exercises[0], exercises[2]]);
    expect(filterExerciseSuggestions(exercises, "BACK")).toEqual([exercises[0], exercises[2]]);
    expect(filterExerciseSuggestions(exercises, "elevacao")).toEqual([exercises[3]]);
  });

  it("não sugere nada para texto vazio", () => {
    expect(filterExerciseSuggestions(exercises, "")).toEqual([]);
    expect(filterExerciseSuggestions(exercises, "   ")).toEqual([]);
  });

  it("não repete o próprio exercício quando o texto já bate exatamente", () => {
    expect(filterExerciseSuggestions(exercises, "Back Squat")).toEqual([]);
  });

  it("respeita o limite de sugestões", () => {
    const manyBackExercises = Array.from({ length: 10 }, (_, index) =>
      buildExercise({ id: `ex-back-${index}`, slug: `back-${index}`, name: `Back ${index}` })
    );

    expect(filterExerciseSuggestions(manyBackExercises, "back", 3)).toHaveLength(3);
  });

  it("encontra o exercício do catálogo por nome exato, ignorando acento, caixa e espaçamento", () => {
    expect(findExerciseByName(exercises, "back squat")).toEqual(exercises[0]);
    expect(findExerciseByName(exercises, "  ELEVAÇÃO PÉLVICA  ")).toEqual(exercises[3]);
  });

  it("não encontra exercício para nome vazio ou movimento ainda não cadastrado", () => {
    expect(findExerciseByName(exercises, "")).toBeNull();
    expect(findExerciseByName(exercises, "Bar Muscle Up")).toBeNull();
  });
});
