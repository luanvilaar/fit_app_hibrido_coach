import { filterSupervisionItems, groupSupervisionRoster } from "@/data/coach-supervision";

const roster = [
  { athlete_id: "a-1", display_name: "João Álvares", team_id: "t-1", team_name: "Força" },
  { athlete_id: "a-1", display_name: "João Álvares", team_id: "t-2", team_name: "Corrida" },
  { athlete_id: "a-2", display_name: "Maria", team_id: "t-1", team_name: "Força" }
];

describe("acompanhamento do coach", () => {
  it("agrupa atletas por equipes sem duplicar vínculos", () => {
    const grouped = groupSupervisionRoster(roster);
    expect(grouped.athletes).toEqual([
      { id: "a-1", name: "João Álvares", teams: [{ id: "t-1", name: "Força" }, { id: "t-2", name: "Corrida" }] },
      { id: "a-2", name: "Maria", teams: [{ id: "t-1", name: "Força" }] }
    ]);
    expect(grouped.teams.find((team) => team.id === "t-1")?.athletes).toHaveLength(2);
  });

  it("filtra por nome sem distinguir caixa ou acento", () => {
    const athletes = groupSupervisionRoster(roster).athletes;
    expect(filterSupervisionItems(athletes, "joao")).toHaveLength(1);
    expect(filterSupervisionItems(athletes, "MARIA")).toHaveLength(1);
  });
});
