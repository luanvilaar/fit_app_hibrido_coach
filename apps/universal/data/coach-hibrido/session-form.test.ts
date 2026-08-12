import type { ExerciseRecord } from "@fitblock/backend";
import {
  addBlock,
  changeBlockKind,
  createBlockForm,
  createInitialSessionForm,
  moveBlock,
  removeBlock,
  resetBlockVolume,
  resolveBlockVolume,
  summarizeSession,
  updateBlock,
  updateBlockProtocol,
  updateBlockRanking,
  updateBlockVolume,
  updateEnduranceVolume,
  updateSessionField
} from "@/data/coach-hibrido/session-form";

function catalogEntry(name: string): ExerciseRecord {
  return {
    id: `id-${name}`,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    video_url: null,
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-11T00:00:00.000Z"
  };
}

const catalog = [catalogEntry("Front Squat"), catalogEntry("Thruster")];

describe("formulário da sessão", () => {
  it("começa sem blocos, publicado e com data de amanhã", () => {
    const form = createInitialSessionForm("team-1");

    expect(form.blocks).toEqual([]);
    expect(form.status).toBe("published");
    expect(form.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.teamId).toBe("team-1");
  });

  it("nomeia o bloco novo com o rótulo da categoria", () => {
    const form = addBlock(createInitialSessionForm(), "metcon");

    expect(form.blocks[0].name).toBe("Metcon");
    expect(form.blocks[0].kind).toBe("metcon");
  });

  it("já ativa o ranking obrigatório e deixa o opcional desligado", () => {
    expect(createBlockForm("metcon").ranking.enabled).toBe(true);
    expect(createBlockForm("strength").ranking.enabled).toBe(false);
    expect(createBlockForm("warm-up").ranking.enabled).toBe(false);
  });

  it("cria protocolo apenas nas categorias que pedem dinâmica de tempo", () => {
    expect(createBlockForm("conditioning").protocol).not.toBeNull();
    expect(createBlockForm("strength").protocol).toBeNull();
  });

  it("remove e reordena blocos preservando a ordem de treino", () => {
    let form = addBlock(addBlock(addBlock(createInitialSessionForm(), "warm-up"), "strength"), "metcon");
    const [, strength] = form.blocks;

    form = moveBlock(form, strength.id, -1);
    expect(form.blocks.map((block) => block.kind)).toEqual(["strength", "warm-up", "metcon"]);

    form = removeBlock(form, strength.id);
    expect(form.blocks.map((block) => block.kind)).toEqual(["warm-up", "metcon"]);
  });

  it("ignora um movimento de bloco que sairia da lista", () => {
    const form = addBlock(createInitialSessionForm(), "strength");

    expect(moveBlock(form, form.blocks[0].id, -1)).toBe(form);
    expect(moveBlock(form, form.blocks[0].id, 1)).toBe(form);
  });

  it("trocar a categoria preserva o texto escrito", () => {
    let form = addBlock(createInitialSessionForm(), "conditioning");
    form = updateBlock(form, form.blocks[0].id, { body: "3 rounds\n400m" });
    form = changeBlockKind(form, form.blocks[0].id, "metcon");

    expect(form.blocks[0].body).toBe("3 rounds\n400m");
    expect(form.blocks[0].kind).toBe("metcon");
    expect(form.blocks[0].name).toBe("Metcon");
  });

  it("trocar a categoria mantém um nome que o coach personalizou", () => {
    let form = addBlock(createInitialSessionForm(), "conditioning");
    form = updateBlock(form, form.blocks[0].id, { name: "Chipper da sexta" });
    form = changeBlockKind(form, form.blocks[0].id, "metcon");

    expect(form.blocks[0].name).toBe("Chipper da sexta");
  });

  it("ajusta o placar sugerido ao trocar o protocolo, mas não ao ajustar o tempo", () => {
    let form = addBlock(createInitialSessionForm(), "metcon");
    const blockId = form.blocks[0].id;

    form = updateBlockProtocol(form, blockId, { type: "amrap" });
    expect(form.blocks[0].ranking.scoreType).toBe("rounds-reps");

    form = updateBlockRanking(form, blockId, { scoreType: "reps" });
    form = updateBlockProtocol(form, blockId, { durationMinutes: "12" });
    expect(form.blocks[0].ranking.scoreType).toBe("reps");
  });

  it("calcula o volume do texto e respeita o número digitado pelo coach", () => {
    let form = addBlock(createInitialSessionForm(), "strength");
    const blockId = form.blocks[0].id;
    form = updateBlock(form, blockId, { body: "4 x 3-5\n3 x 10" });

    expect(resolveBlockVolume(form.blocks[0])).toEqual({ sets: 7, reps: 46, source: "auto" });

    form = updateBlockVolume(form, blockId, { mode: "manual", sets: "14", reps: "102" });
    expect(resolveBlockVolume(form.blocks[0])).toEqual({ sets: 14, reps: 102, source: "manual" });

    form = resetBlockVolume(form, blockId);
    expect(resolveBlockVolume(form.blocks[0])).toEqual({ sets: 7, reps: 46, source: "auto" });
  });

  it("não reporta volume quando o texto não tem nenhum padrão legível", () => {
    let form = addBlock(createInitialSessionForm(), "strength");
    form = updateBlock(form, form.blocks[0].id, { body: "trabalhe pesado hoje" });

    expect(resolveBlockVolume(form.blocks[0]).source).toBe("none");
  });

  it("não calcula volume em categoria que não tem esse controle", () => {
    let form = addBlock(createInitialSessionForm(), "metcon");
    form = updateBlock(form, form.blocks[0].id, { body: "4 x 5" });

    expect(resolveBlockVolume(form.blocks[0]).source).toBe("none");
  });

  it("liga uma modalidade de endurance sem tocar nas outras", () => {
    let form = addBlock(createInitialSessionForm(), "endurance");
    form = updateEnduranceVolume(form, form.blocks[0].id, "row", { enabled: true, value: "2000" });

    const volumes = form.blocks[0].enduranceVolumes;
    expect(volumes.find((volume) => volume.modality === "row")).toMatchObject({
      enabled: true,
      value: "2000",
      unit: "m"
    });
    expect(volumes.find((volume) => volume.modality === "run")?.enabled).toBe(false);
    expect(volumes.find((volume) => volume.modality === "bike")?.unit).toBe("min");
  });

  it("resume blocos, movimentos únicos e blocos pontuados", () => {
    let form = addBlock(addBlock(createInitialSessionForm(), "strength"), "metcon");
    form = updateBlock(form, form.blocks[0].id, { body: "@Front Squat\n4 x 5" });
    form = updateBlock(form, form.blocks[1].id, { body: "@Front Squat\n@Thruster" });

    expect(summarizeSession(form, catalog)).toEqual({ blocks: 2, movements: 2, ranked: 1 });
  });

  it("troca campos da sessão sem mexer nos blocos", () => {
    const form = addBlock(createInitialSessionForm(), "strength");
    const next = updateSessionField(form, "title", "Terça pesada");

    expect(next.title).toBe("Terça pesada");
    expect(next.blocks).toBe(form.blocks);
  });
});
