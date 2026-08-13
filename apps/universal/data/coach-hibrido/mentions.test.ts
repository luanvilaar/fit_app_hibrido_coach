import type { ExerciseRecord } from "@fitblock/backend";
import {
  applyMention,
  collectMentions,
  findMentionQuery,
  splitBody,
  splitSegments,
  suggestMovements,
  toBlockMovement
} from "@/data/coach-hibrido/mentions";

function exercise(name: string, overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: `id-${name}`,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    video_url: null,
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-11T00:00:00.000Z",
    ...overrides
  };
}

const catalog = [
  exercise("Front Squat", { video_url: "https://youtu.be/abc" }),
  exercise("Front Squat Machine"),
  exercise("Back Rack Bulgarian Split Squat"),
  exercise("Thruster"),
  exercise("Agachamento Búlgaro")
];

describe("menções de movimento", () => {
  it("abre a menção no @ imediatamente anterior ao cursor", () => {
    const text = "4 x 3-5\n@Front";
    const query = findMentionQuery(text, text.length);

    expect(query).toEqual({ start: 8, end: 14, term: "Front" });
  });

  it("não abre menção quando o @ está colado em palavra, como em e-mail", () => {
    const text = "avise coach@fitblock";

    expect(findMentionQuery(text, text.length)).toBeNull();
  });

  it("não atravessa a quebra de linha ao procurar o @", () => {
    const text = "@Front Squat\n4 x 3-5";

    expect(findMentionQuery(text, text.length)).toBeNull();
  });

  it("desiste do termo depois de quatro palavras, para não virar busca do parágrafo", () => {
    const text = "@uma duas tres quatro cinco";

    expect(findMentionQuery(text, text.length)).toBeNull();
  });

  it("fecha a menção quando a prescrição começa, para não buscar durante as séries", () => {
    const text = "@Front Squat 4 x";

    expect(findMentionQuery(text, text.length)).toBeNull();
  });

  it("mantém a menção viva em nome com hífen e apóstrofo", () => {
    const text = "@Sots-Press";

    expect(findMentionQuery(text, text.length)).toMatchObject({ term: "Sots-Press" });
  });

  it("substitui o termo digitado pelo nome completo e devolve o cursor depois do espaço", () => {
    const text = "@Fro";
    const query = findMentionQuery(text, text.length);
    const applied = applyMention(text, query!, "Front Squat");

    expect(applied.text).toBe("@Front Squat ");
    expect(applied.cursor).toBe(13);
  });

  it("preserva o texto à direita do cursor ao inserir a menção", () => {
    const text = "@Fro\n4 x 5";
    const applied = applyMention(text, findMentionQuery(text, 4)!, "Front Squat");

    expect(applied.text).toBe("@Front Squat \n4 x 5");
  });

  it("sugere primeiro quem começa com o termo e ignora acento", () => {
    const names = suggestMovements(catalog, "bulgaro").map((item) => item.name);

    expect(names).toEqual(["Agachamento Búlgaro"]);
  });

  it("ordena prefixo antes de trecho no meio do nome", () => {
    const names = suggestMovements(catalog, "front").map((item) => item.name);

    expect(names).toEqual(["Front Squat", "Front Squat Machine"]);
  });

  it("para de sugerir quando o termo já é exatamente um movimento", () => {
    expect(suggestMovements(catalog, "Front Squat")).toEqual([]);
  });

  it("coleta apenas os movimentos escritos como @Nome, na ordem do texto", () => {
    const body = "@Back Rack Bulgarian Split Squat\n4 x 5\n\n@Front Squat\n4 x 3-5";

    expect(collectMentions(body, catalog).map((movement) => movement.name)).toEqual([
      "Back Rack Bulgarian Split Squat",
      "Front Squat"
    ]);
  });

  it("não coleta um movimento citado sem o @", () => {
    expect(collectMentions("Front Squat 4 x 3-5", catalog)).toEqual([]);
  });

  it("não confunde um nome com o prefixo de outro mais longo", () => {
    const movements = collectMentions("@Front Squat Machine\n3 x 10", catalog);

    expect(movements.map((movement) => movement.name)).toEqual(["Front Squat Machine"]);
  });

  it("quebra a linha em texto e menção, preservando o que vem depois", () => {
    const movements = [toBlockMovement(catalog[0])];
    const segments = splitSegments("15 @Front Squat 43kg", movements);

    expect(segments).toEqual([
      { type: "text", value: "15 " },
      { type: "mention", value: "Front Squat", movement: movements[0] },
      { type: "text", value: " 43kg" }
    ]);
  });

  it("dá o vídeo do movimento à menção renderizada", () => {
    const movements = [toBlockMovement(catalog[0])];
    const [segment] = splitSegments("@Front Squat", movements);

    expect(segment).toMatchObject({ type: "mention" });
    expect(segment.type === "mention" && segment.movement.videoUrl).toBe("https://youtu.be/abc");
  });

  it("preserva a quebra de linha ao segmentar o corpo inteiro, como o espelho do editor faz", () => {
    const movements = [toBlockMovement(catalog[0])];
    const segments = splitSegments("@Front Squat\n4 x 3-5", movements);

    expect(segments).toEqual([
      { type: "mention", value: "Front Squat", movement: movements[0] },
      { type: "text", value: "\n4 x 3-5" }
    ]);
  });

  it("mantém uma entrada por linha do texto original", () => {
    const lines = splitBody("linha um\n\nlinha tres", []);

    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
  });
});
