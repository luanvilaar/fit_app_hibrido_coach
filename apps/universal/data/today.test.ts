import type {
  AthleteCheckinRecord,
  AthleteSessionProgressRecord,
  CalendarSessionRecord
} from "@fitblock/backend";
import type { HybridBlock } from "@/data/coach-hibrido/session-snapshot";
import {
  averageCheckinScore,
  buildTodayBlocks,
  describeCheckinPain,
  describeNextSession,
  describeReadiness,
  describeSessionStatus,
  describeWeakestAnswers,
  deriveSessionFocus,
  estimateSessionMinutes,
  formatSessionDuration,
  formatTodayEyebrow,
  formatWeekEyebrow,
  getWeeklyProgress
} from "@/data/today";
import { readSessionBlocks } from "@/data/coach-hibrido/session-snapshot";

function buildBlock(overrides: Partial<HybridBlock> & { id: string }): HybridBlock {
  return {
    name: "Bloco",
    kind: "strength",
    body: "",
    movements: [],
    protocol: null,
    ranking: null,
    volume: null,
    enduranceVolumes: [],
    ...overrides
  };
}

const session: CalendarSessionRecord = {
  id: "instance-01",
  template_id: "template-01",
  team_id: "team-01",
  scheduled_date: "2026-08-06",
  status: "published",
  state: "available",
  coach_note: "Controle o ritmo nas primeiras séries.",
  snapshot: {
    title: "Base forte",
    blocks: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Aquecimento",
        kind: "warm-up",
        details: { schema_version: 3, body: "8 min de mobilidade de quadril" },
        items: []
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Força principal",
        kind: "strength",
        details: {
          schema_version: 3,
          body: "@Back Squat\n3 x 5 @ 75%\n\n@Remada Curvada\n1 x 10",
          volume: { sets: 4, reps: 25, source: "auto" }
        },
        items: [
          {
            id: "aaaaaaa2-2222-2222-2222-222222222222",
            exercise_slug: "back-squat",
            exercise_name: "Back Squat",
            exercise_video_url: "https://youtu.be/exemplo",
            prescription: { kind: "reference" }
          },
          {
            id: "aaaaaaa3-3333-3333-3333-333333333333",
            exercise_slug: "remada-curvada",
            exercise_name: "Remada Curvada",
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

const progress: AthleteSessionProgressRecord = {
  id: "progress-01",
  session_id: "instance-01",
  athlete_id: "athlete-01",
  state: "started",
  completed_block_ids: ["11111111-1111-1111-1111-111111111111"],
  started_at: "2026-08-06T10:00:00.000Z",
  completed_at: null,
  created_at: "2026-08-06T10:00:00.000Z",
  updated_at: "2026-08-06T10:00:00.000Z"
};

/** Check-in neutro (tudo 3, sem dor); cada teste sobrescreve só o que investiga. */
function buildCheckin(overrides: Partial<AthleteCheckinRecord>): AthleteCheckinRecord {
  return {
    id: "checkin-01",
    athlete_id: "athlete-01",
    checkin_date: "2026-08-06",
    sleep_score: 3,
    energy_score: 3,
    muscle_recovery_score: 3,
    stress_score: 3,
    mood_score: 3,
    motivation_score: 3,
    overall_readiness_score: 3,
    pain_region: null,
    pain_intensity: null,
    readiness: 3,
    note: "",
    ...overrides
  };
}

describe("derivações da aba Hoje", () => {
  it("formata o cabeçalho do dia a partir da data real", () => {
    expect(formatTodayEyebrow(new Date(2026, 7, 6))).toBe("QUINTA-FEIRA · 06 AGO 2026");
  });

  it("deriva o foco dos tipos de bloco prescritos", () => {
    const blocks = readSessionBlocks(session);

    expect(deriveSessionFocus(blocks)).toBe("Força");
    expect(deriveSessionFocus([buildBlock({ id: "b", name: "Metcon", kind: "conditioning" })])).toBe(
      "Endurance"
    );
    expect(
      deriveSessionFocus([
        buildBlock({ id: "b1", name: "Força", kind: "strength" }),
        buildBlock({ id: "b2", name: "Metcon", kind: "conditioning" })
      ])
    ).toBe("Mixed");
  });

  it("estima a duração pelo volume de séries do bloco de força", () => {
    // Aquecimento sem tempo declarado + 4 séries × 75s = 300s = 5 min
    expect(estimateSessionMinutes(readSessionBlocks(session))).toBe(5);
    expect(formatSessionDuration(5)).toBe("≈ 5 min");
    expect(formatSessionDuration(0)).toBe("Duração livre");
  });

  it("soma a duração declarada no protocolo e no volume de endurance", () => {
    const amrap = buildBlock({
      id: "b1",
      kind: "metcon",
      protocol: { type: "amrap", durationMinutes: 12, timeCapMinutes: null, rounds: null, workSeconds: null, restSeconds: null }
    });
    const bike = buildBlock({
      id: "b2",
      kind: "endurance",
      enduranceVolumes: [{ modality: "bike", value: 30, unit: "min" }]
    });

    expect(estimateSessionMinutes([amrap, bike])).toBe(42);
  });

  it("não inventa duração para um bloco sem tempo nem volume", () => {
    expect(estimateSessionMinutes([buildBlock({ id: "b", kind: "warm-up", body: "2 rounds leves" })])).toBe(0);
  });

  it("marca como concluídos apenas os blocos registrados no progresso do atleta", () => {
    const blocks = buildTodayBlocks(session, progress);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      name: "Aquecimento",
      status: "done",
      detail: "8 min de mobilidade de quadril"
    });
    expect(blocks[1]).toMatchObject({
      name: "Força principal",
      status: "pending",
      detail: "Back Squat · 3 x 5 @ 75% — 4 séries · 25 reps"
    });
  });

  it("limita o progresso semanal a uma faixa válida", () => {
    expect(getWeeklyProgress(3, 4)).toBe(0.75);
    expect(getWeeklyProgress(8, 4)).toBe(1);
    expect(getWeeklyProgress(2, 0)).toBe(0);
  });

  it("descreve a posição da sessão na semana", () => {
    expect(
      formatWeekEyebrow({ start: "2026-08-03", end: "2026-08-09", planned: 4, completed: 1, position: 2 })
    ).toBe("Treino 02 · Semana de 03/08");
  });

  it("traduz o estado da sessão para o selo da tela", () => {
    expect(describeSessionStatus(null, null)).toMatchObject({ tone: "empty" });
    expect(describeSessionStatus(session, null)).toMatchObject({ tone: "available" });
    expect(describeSessionStatus(session, progress)).toMatchObject({ tone: "running" });
    expect(describeSessionStatus(session, { ...progress, state: "completed" })).toMatchObject({ tone: "done" });
  });

  it("converte o check-in em prontidão legível e devolve null sem registro", () => {
    expect(describeReadiness(buildCheckin({ readiness: 4.33 }))).toMatchObject({
      score: "4,3",
      label: "Pronto para treinar",
      tone: "ready",
      pain: null
    });
    expect(describeReadiness(null)).toBeNull();
  });

  it("classifica a prontidão nas faixas verde, amarela e vermelha", () => {
    expect(describeReadiness(buildCheckin({ readiness: 4 }))).toMatchObject({
      score: "4,0",
      tone: "ready",
      label: "Pronto para treinar"
    });
    expect(describeReadiness(buildCheckin({ readiness: 3.9 }))).toMatchObject({
      score: "3,9",
      tone: "caution",
      label: "Atenção ao volume"
    });
    expect(describeReadiness(buildCheckin({ readiness: 2.86 }))).toMatchObject({
      score: "2,9",
      tone: "risk",
      label: "Priorize a recuperação"
    });
  });

  it("usa o score já arredondado para escolher a faixa, para cor e número não divergirem", () => {
    expect(describeReadiness(buildCheckin({ readiness: 3.96 }))).toMatchObject({
      score: "4,0",
      tone: "ready"
    });
  });

  it("resume as duas respostas mais baixas do check-in", () => {
    const checkin = buildCheckin({
      sleep_score: 4,
      energy_score: 4,
      muscle_recovery_score: 3,
      stress_score: 2,
      mood_score: 5,
      motivation_score: 4,
      overall_readiness_score: 4,
      readiness: 3.71
    });

    expect(describeWeakestAnswers(checkin)).toBe("Mais baixos: Nível de estresse 2 · Recuperação muscular 3");
  });

  it("avisa quando todas as respostas estão no topo", () => {
    const checkin = buildCheckin({
      sleep_score: 5,
      energy_score: 5,
      muscle_recovery_score: 5,
      stress_score: 5,
      mood_score: 5,
      motivation_score: 5,
      overall_readiness_score: 5,
      readiness: 5
    });

    expect(describeWeakestAnswers(checkin)).toBe("Todas as respostas no topo");
  });

  it("descreve a dor localizada apenas quando região e intensidade existem", () => {
    expect(describeCheckinPain(buildCheckin({ pain_region: "joelho", pain_intensity: 6 }))).toBe(
      "Dor: joelho 6/10"
    );
    expect(describeCheckinPain(buildCheckin({}))).toBeNull();
  });

  it("calcula a média das sete respostas para o preview local", () => {
    expect(
      averageCheckinScore({
        sleepScore: 3,
        energyScore: 2,
        muscleRecoveryScore: 2,
        stressScore: 4,
        moodScore: 4,
        motivationScore: 3,
        overallReadinessScore: 2
      })
    ).toBeCloseTo(2.857, 3);
  });

  it("descreve a próxima sessão com dia, duração estimada e foco", () => {
    expect(describeNextSession({ ...session, scheduled_date: "2026-08-07" })).toBe(
      "Sexta-feira · ≈ 5 min · Força"
    );
  });
});
