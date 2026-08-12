import { estimateVolume, formatVolume } from "@/data/coach-hibrido/volume";

describe("volume lido do texto do bloco", () => {
  it("soma séries e repetições do bloco de força do exemplo do coach", () => {
    const body = [
      "@Front Squat",
      "4 x 3-5",
      "trabalhe com cargas pesadas.",
      "descanse 90seg entre as séries.",
      "",
      "@Back Rack Bulgarian Split Squat",
      "4 x 5",
      "trabalhe com cargas moderadas a pesadas",
      "",
      "@Weighted Zombie Sit Up",
      "3 x 10-12",
      "A cada 1min10seg por 3sets",
      "",
      "@Dumbbell Side Plank Rotations",
      "3 x 10",
      "A cada 1min30seg por 3sets"
    ].join("\n");

    expect(estimateVolume(body)).toEqual({ sets: 14, reps: 99, matchedLines: 4 });
  });

  it("usa o meio da faixa de repetições", () => {
    expect(estimateVolume("4 x 3-5")).toMatchObject({ sets: 4, reps: 16 });
    expect(estimateVolume("3 x 10-12")).toMatchObject({ sets: 3, reps: 33 });
  });

  it("aceita o × tipográfico e a escrita sem espaço", () => {
    expect(estimateVolume("4×5")).toMatchObject({ sets: 4, reps: 20 });
    expect(estimateVolume("4x5")).toMatchObject({ sets: 4, reps: 20 });
  });

  it("lê séries x reps mesmo com percentual na mesma linha", () => {
    expect(estimateVolume("5 x 2 @ 75%")).toMatchObject({ sets: 5, reps: 10 });
  });

  it("conta uma lista de repetições por série", () => {
    expect(estimateVolume("6, 10, 6, 10, 6, 10")).toMatchObject({ sets: 6, reps: 48 });
  });

  it("conta uma escada de repetições como uma série por degrau", () => {
    expect(estimateVolume("21-15-9")).toMatchObject({ sets: 3, reps: 45 });
  });

  it("não confunde uma faixa isolada com escada", () => {
    expect(estimateVolume("3-5")).toEqual({ sets: 0, reps: 0, matchedLines: 0 });
  });

  it("ignora linhas de orientação e nomes de movimento", () => {
    const body = "@Thruster 43/30kg\ndescanse 90seg entre as séries.\ntrabalhe pesado";

    expect(estimateVolume(body)).toEqual({ sets: 0, reps: 0, matchedLines: 0 });
  });

  it("devolve zero para texto vazio", () => {
    expect(estimateVolume("   ")).toEqual({ sets: 0, reps: 0, matchedLines: 0 });
  });

  it("conta uma linha só uma vez, mesmo com dois padrões possíveis", () => {
    expect(estimateVolume("4 x 5")).toMatchObject({ matchedLines: 1 });
  });

  it("formata o total no singular e no plural", () => {
    expect(formatVolume(14, 99)).toBe("14 séries · 99 reps");
    expect(formatVolume(1, 1)).toBe("1 série · 1 rep");
  });
});
