import type { CalendarSessionRecord } from "@fitblock/backend";
import {
  describeBlock,
  formatEnduranceVolumes,
  formatProtocol,
  getSessionTitle,
  rankedBlocks,
  readSessionBlocks
} from "@/data/coach-hibrido/session-snapshot";
import { toSessionForm } from "@/data/coach-hibrido/session-edit";

function session(blocks: unknown[], overrides: Partial<CalendarSessionRecord> = {}): CalendarSessionRecord {
  return {
    id: "session-1",
    team_id: "team-1",
    scheduled_date: "2026-08-12",
    status: "published",
    state: "available",
    coach_note: "Controle o ritmo.",
    snapshot: { title: "Terça pesada", blocks },
    updated_at: "2026-08-11T10:00:00.000Z",
    ...overrides
  } as unknown as CalendarSessionRecord;
}

const hybridBlock = {
  id: "block-1",
  name: "Força & Acessórios",
  kind: "strength",
  details: {
    schema_version: 3,
    body: "@Front Squat\n4 x 3-5",
    volume: { sets: 4, reps: 16, source: "auto" }
  },
  items: [
    {
      id: "item-1",
      exercise_slug: "front-squat",
      exercise_name: "Front Squat",
      exercise_video_url: "https://youtu.be/abc",
      prescription: { kind: "reference" }
    }
  ]
};

describe("leitura do snapshot Coach Híbrido", () => {
  it("lê texto, movimentos e volume do bloco", () => {
    const [block] = readSessionBlocks(session([hybridBlock]));

    expect(block).toMatchObject({
      id: "block-1",
      kind: "strength",
      name: "Força & Acessórios",
      body: "@Front Squat\n4 x 3-5",
      volume: { sets: 4, reps: 16, source: "auto" }
    });
    expect(block.movements).toEqual([
      { slug: "front-squat", name: "Front Squat", videoUrl: "https://youtu.be/abc", category: null, itemId: "item-1" }
    ]);
  });

  it("lê protocolo, ranking e volumes de endurance", () => {
    const [block] = readSessionBlocks(
      session([
        {
          id: "block-2",
          name: "Endurance",
          kind: "endurance",
          details: {
            schema_version: 3,
            body: "5km leve",
            ranking: { enabled: true, score_type: "time" },
            volumes: [{ modality: "run", value: 5, unit: "km" }]
          },
          items: []
        }
      ])
    );

    expect(block.ranking).toEqual({ enabled: true, scoreType: "time" });
    expect(block.enduranceVolumes).toEqual([{ modality: "run", value: 5, unit: "km" }]);
  });

  it("não confunde ranking desativado com ranking presente", () => {
    const [block] = readSessionBlocks(
      session([{ id: "b", name: "Força", kind: "strength", details: { ranking: { enabled: false } }, items: [] }])
    );

    expect(block.ranking).toBeNull();
  });

  it("cai para uma categoria conhecida quando o snapshot traz um kind legado", () => {
    const [block] = readSessionBlocks(
      session([{ id: "b", name: "Bloco", kind: "custom", details: { body: "livre" }, items: [] }])
    );

    expect(block.kind).toBe("strength");
  });

  it("converte prescrição estruturada antiga em texto, mantendo o vídeo pelo @", () => {
    const [block] = readSessionBlocks(
      session([
        {
          id: "legacy",
          name: "Força",
          kind: "strength",
          details: { description: "Trabalhe pesado." },
          items: [
            {
              id: "item-1",
              exercise_name: "Front Squat",
              exercise_video_url: "https://youtu.be/abc",
              prescription: {
                kind: "sets-reps",
                rest_seconds: 90,
                notes: "controle a descida",
                sets: [
                  { set_number: 1, reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 },
                  { set_number: 2, reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 }
                ]
              }
            }
          ]
        }
      ])
    );

    expect(block.body).toBe(
      "Trabalhe pesado.\n\n@Front Squat\n2 x 3-5 · 75% 1RM\ndescanse 90seg entre as séries.\ncontrole a descida"
    );
    expect(block.movements[0].videoUrl).toBe("https://youtu.be/abc");
  });

  it("lista os blocos pontuados na ordem da sessão", () => {
    const blocks = readSessionBlocks(
      session([
        hybridBlock,
        {
          id: "block-2",
          name: "Metcon",
          kind: "metcon",
          details: { body: "21-15-9", ranking: { enabled: true, score_type: "time" } },
          items: []
        }
      ])
    );

    expect(rankedBlocks(blocks).map((block) => block.id)).toEqual(["block-2"]);
  });

  it("resume o bloco para o calendário com as primeiras linhas e o metadado", () => {
    const [block] = readSessionBlocks(session([hybridBlock]));

    expect(describeBlock(block)).toBe("Front Squat · 4 x 3-5 — 4 séries · 16 reps");
  });

  it("avisa quando o bloco não tem prescrição alguma", () => {
    const [block] = readSessionBlocks(session([{ id: "b", name: "Bloco", kind: "warm-up", items: [] }]));

    expect(describeBlock(block)).toBe("Sem prescrição");
  });

  it("formata cada protocolo com o que o coach preencheu", () => {
    expect(formatProtocol({ type: "amrap", durationMinutes: 12, timeCapMinutes: null, rounds: null, workSeconds: null, restSeconds: null })).toBe("AMRAP · 12 min");
    expect(formatProtocol({ type: "for-time", timeCapMinutes: 15, durationMinutes: null, rounds: null, workSeconds: null, restSeconds: null })).toBe("For time · limite 15 min");
    expect(formatProtocol({ type: "for-time", timeCapMinutes: null, durationMinutes: null, rounds: null, workSeconds: null, restSeconds: null })).toBe("For time");
    expect(formatProtocol({ type: "intervals", rounds: 8, workSeconds: 40, restSeconds: 20, timeCapMinutes: null, durationMinutes: null })).toBe("Intervalado · 8 rounds · 40s / 20s");
    expect(formatProtocol(null)).toBe("");
  });

  it("formata o volume de endurance em linguagem corrente", () => {
    expect(
      formatEnduranceVolumes([
        { modality: "run", value: 5, unit: "km" },
        { modality: "row", value: 2000, unit: "m" }
      ])
    ).toBe("5 km de corrida · 2000 m de remo");
  });

  it("usa o título do snapshot e um rótulo neutro quando ele falta", () => {
    expect(getSessionTitle(session([]))).toBe("Terça pesada");
    expect(getSessionTitle(session([], { snapshot: {} } as Partial<CalendarSessionRecord>))).toBe("Sessão FitBlock");
  });
});

describe("snapshot de volta para o formulário", () => {
  it("recupera equipe, data, título e blocos editáveis", () => {
    const form = toSessionForm(session([hybridBlock]));

    expect(form).toMatchObject({
      teamId: "team-1",
      title: "Terça pesada",
      scheduledDate: "2026-08-12",
      status: "published",
      coachNote: "Controle o ritmo."
    });
    expect(form.blocks[0]).toMatchObject({ kind: "strength", body: "@Front Squat\n4 x 3-5" });
  });

  it("volume automático volta a ser recalculado, e o manual continua manual", () => {
    const auto = toSessionForm(session([hybridBlock]));
    expect(auto.blocks[0].volume).toEqual({ mode: "auto", sets: "", reps: "" });

    const manual = toSessionForm(
      session([
        {
          ...hybridBlock,
          details: { ...hybridBlock.details, volume: { sets: 14, reps: 102, source: "manual" } }
        }
      ])
    );
    expect(manual.blocks[0].volume).toEqual({ mode: "manual", sets: "14", reps: "102" });
  });

  it("recria o protocolo padrão quando a categoria exige e o snapshot não tem", () => {
    const form = toSessionForm(
      session([{ id: "b", name: "Metcon", kind: "metcon", details: { body: "21-15-9" }, items: [] }])
    );

    expect(form.blocks[0].protocol).toMatchObject({ type: "for-time" });
  });
});
