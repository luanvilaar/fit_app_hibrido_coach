import type { ExerciseRecord } from "@fitblock/backend";
import {
  buildCreateExerciseRequest,
  describeMovementBankError,
  withMovement
} from "@/data/coach-hibrido/movement-bank";

function exercise(patch: Partial<ExerciseRecord> & { name: string; slug: string }): ExerciseRecord {
  return {
    id: patch.slug,
    video_url: null,
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-13T00:00:00.000Z",
    ...patch
  };
}

const catalog: ExerciseRecord[] = [
  exercise({ name: "Front Squat", slug: "front-squat", video_url: "https://youtu.be/abc" }),
  exercise({ name: "Thruster", slug: "thruster" })
];

describe("cadastro de movimento no banco", () => {
  it("normaliza o nome e deriva o slug pela mesma regra das menções", () => {
    const request = buildCreateExerciseRequest(
      { name: "  Back Rack   Bulgarian Split Squat ", category: "forca-lpo", videoUrl: "" },
      catalog
    );

    expect(request).toEqual({
      slug: "back-rack-bulgarian-split-squat",
      name: "Back Rack Bulgarian Split Squat",
      category: "forca-lpo",
      videoUrl: null
    });
  });

  it("recusa nome que o banco também recusaria", () => {
    expect(() =>
      buildCreateExerciseRequest({ name: "A", category: "ginastica", videoUrl: "" }, catalog)
    ).toThrow(/pelo menos 2/);
  });

  it("aponta o movimento existente em vez de deixar o slug repetido explodir no banco", () => {
    expect(() =>
      buildCreateExerciseRequest({ name: "front squat", category: "ginastica", videoUrl: "" }, catalog)
    ).toThrow(/já está no banco/);
  });

  it("exige https no link, como a constraint do catálogo", () => {
    expect(() =>
      buildCreateExerciseRequest(
        { name: "Panda Pull", category: "forca-lpo", videoUrl: "youtu.be/sem-esquema" },
        catalog
      )
    ).toThrow(/https:\/\//);
  });

  it("mantém o catálogo em ordem alfabética depois do cadastro", () => {
    const created = exercise({ name: "Air Squat", slug: "air-squat" });

    expect(withMovement(catalog, created).map((item) => item.name)).toEqual([
      "Air Squat",
      "Front Squat",
      "Thruster"
    ]);
  });

  it("traduz a violação de unicidade do Postgres", () => {
    const error = new Error('duplicate key value violates unique constraint "exercises_slug_key"');

    expect(describeMovementBankError(error)).toMatch(/já está no banco/);
  });

  it("traduz a recusa de RLS", () => {
    const error = new Error("new row violates row-level security policy for table exercises");

    expect(describeMovementBankError(error)).toMatch(/permissão/);
  });
});
