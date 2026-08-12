import type { ExerciseRecord } from "@fitblock/backend";
import {
  buildSessionPayload,
  buildUpdateSessionPayload,
  describePrescriptionError
} from "@/data/coach-hibrido/payload";
import {
  addBlock,
  createInitialSessionForm,
  updateBlock,
  updateBlockProtocol,
  updateBlockRanking,
  updateBlockVolume,
  updateEnduranceVolume,
  updateSessionField,
  type SessionForm
} from "@/data/coach-hibrido/session-form";
import type { BlockKind } from "@/data/coach-hibrido/blocks";

const catalog: ExerciseRecord[] = [
  {
    id: "ex-1",
    slug: "front-squat",
    name: "Front Squat",
    video_url: "https://youtu.be/abc",
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-11T00:00:00.000Z"
  }
];

function baseForm(kind: BlockKind, body: string): SessionForm {
  let form = createInitialSessionForm("team-1");
  form = updateSessionField(form, "title", "Terça pesada");
  form = updateSessionField(form, "scheduledDate", "2026-08-12");
  form = addBlock(form, kind);
  return updateBlock(form, form.blocks[0].id, { body });
}

describe("payload da prescrição", () => {
  it("manda o texto do bloco em details.body com a versão do schema", () => {
    const payload = buildSessionPayload(baseForm("strength", "@Front Squat\n4 x 3-5"), catalog);
    const [block] = payload.blocks;

    expect(block.kind).toBe("strength");
    expect(block.details).toMatchObject({ schema_version: 3, body: "@Front Squat\n4 x 3-5" });
  });

  it("transforma cada menção em um item com slug, nome e categoria", () => {
    const payload = buildSessionPayload(baseForm("strength", "@Front Squat\n4 x 5"), catalog);

    expect(payload.blocks[0].items).toEqual([
      {
        exerciseSlug: "front-squat",
        exerciseName: "Front Squat",
        exerciseCategory: "forca-acessorios",
        prescription: { kind: "reference" }
      }
    ]);
  });

  it("não cria item para movimento citado sem @", () => {
    const payload = buildSessionPayload(baseForm("strength", "Front Squat\n4 x 5"), catalog);

    expect(payload.blocks[0].items).toEqual([]);
  });

  it("grava o volume automático lido do texto", () => {
    const payload = buildSessionPayload(baseForm("strength", "4 x 3-5\n3 x 10"), catalog);

    expect(payload.blocks[0].details).toMatchObject({
      volume: { sets: 7, reps: 46, source: "auto" }
    });
  });

  it("grava o volume digitado como manual", () => {
    let form = baseForm("strength", "trabalhe pesado");
    form = updateBlockVolume(form, form.blocks[0].id, { mode: "manual", sets: "14", reps: "102" });

    expect(buildSessionPayload(form, catalog).blocks[0].details).toMatchObject({
      volume: { sets: 14, reps: 102, source: "manual" }
    });
  });

  it("omite o volume quando o texto não tem padrão legível e o coach não digitou", () => {
    const payload = buildSessionPayload(baseForm("strength", "trabalhe pesado"), catalog);

    expect(payload.blocks[0].details).not.toHaveProperty("volume");
  });

  it("grava o ranking obrigatório do metcon", () => {
    let form = baseForm("metcon", "21-15-9\n@Front Squat");
    form = updateBlockProtocol(form, form.blocks[0].id, { type: "for-time" });

    expect(buildSessionPayload(form, catalog).blocks[0].details).toMatchObject({
      ranking: { enabled: true, score_type: "time" },
      protocol: { type: "for-time" }
    });
  });

  it("omite o ranking opcional que o coach deixou desligado", () => {
    const payload = buildSessionPayload(baseForm("strength", "4 x 5"), catalog);

    expect(payload.blocks[0].details).not.toHaveProperty("ranking");
  });

  it("grava o ranking opcional que o coach ligou", () => {
    let form = baseForm("strength", "4 x 5");
    form = updateBlockRanking(form, form.blocks[0].id, { enabled: true, scoreType: "load" });

    expect(buildSessionPayload(form, catalog).blocks[0].details).toMatchObject({
      ranking: { enabled: true, score_type: "load" }
    });
  });

  it("exige duração no AMRAP", () => {
    let form = baseForm("metcon", "5 @Front Squat");
    form = updateBlockProtocol(form, form.blocks[0].id, { type: "amrap" });

    expect(() => buildSessionPayload(form, catalog)).toThrow(/duração em minutos/i);
  });

  it("exige rounds, trabalho e descanso no intervalado", () => {
    let form = baseForm("conditioning", "remo forte");
    form = updateBlockProtocol(form, form.blocks[0].id, { type: "intervals", rounds: "8" });

    expect(() => buildSessionPayload(form, catalog)).toThrow(/tempo de trabalho/i);
  });

  it("exige ao menos uma modalidade no bloco de endurance", () => {
    const form = baseForm("endurance", "5km leve");

    expect(() => buildSessionPayload(form, catalog)).toThrow(/modalidade de endurance/i);
  });

  it("grava as modalidades de endurance escolhidas", () => {
    let form = baseForm("endurance", "5km leve");
    form = updateEnduranceVolume(form, form.blocks[0].id, "run", { enabled: true, value: "5", unit: "km" });

    expect(buildSessionPayload(form, catalog).blocks[0].details).toMatchObject({
      volumes: [{ modality: "run", value: 5, unit: "km" }]
    });
  });

  it("recusa bloco sem texto", () => {
    const form = baseForm("warm-up", "   ");

    expect(() => buildSessionPayload(form, catalog)).toThrow(/escreva o treino/i);
  });

  it("recusa sessão sem bloco, sem título e com data inválida", () => {
    const empty = updateSessionField(createInitialSessionForm("team-1"), "title", "Treino");
    expect(() => buildSessionPayload(empty, catalog)).toThrow(/pelo menos um bloco/i);

    const untitled = updateSessionField(baseForm("warm-up", "2 rounds"), "title", "  ");
    expect(() => buildSessionPayload(untitled, catalog)).toThrow(/Título/i);

    const badDate = updateSessionField(baseForm("warm-up", "2 rounds"), "scheduledDate", "12/08/2026");
    expect(() => buildSessionPayload(badDate, catalog)).toThrow(/AAAA-MM-DD/);
  });

  it("o payload de atualização carrega o id da sessão e não a equipe", () => {
    const payload = buildUpdateSessionPayload("session-9", baseForm("warm-up", "2 rounds"), catalog);

    expect(payload.sessionId).toBe("session-9");
    expect(payload).not.toHaveProperty("teamId");
  });

  it("traduz erro de permissão sem vazar detalhe de RLS", () => {
    expect(describePrescriptionError(new Error("new row violates RLS policy"))).toBe(
      "Você não tem permissão para esta operação."
    );
    expect(describePrescriptionError(new Error("rede indisponível"))).toBe("rede indisponível");
  });
});
