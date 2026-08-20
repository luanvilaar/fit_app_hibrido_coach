import type { CoachSupervisionRosterRecord } from "@fitblock/backend";

export type SupervisionAthlete = {
  id: string;
  name: string;
  teams: Array<{ id: string; name: string }>;
};

export type SupervisionTeam = {
  id: string;
  name: string;
  athletes: SupervisionAthlete[];
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function groupSupervisionRoster(rows: CoachSupervisionRosterRecord[]): {
  athletes: SupervisionAthlete[];
  teams: SupervisionTeam[];
} {
  const athleteMap = new Map<string, SupervisionAthlete>();
  const teamMap = new Map<string, SupervisionTeam>();

  rows.forEach((row) => {
    const athlete = athleteMap.get(row.athlete_id) ?? { id: row.athlete_id, name: row.display_name, teams: [] };
    if (!athlete.teams.some((team) => team.id === row.team_id)) athlete.teams.push({ id: row.team_id, name: row.team_name });
    athleteMap.set(row.athlete_id, athlete);

    const team = teamMap.get(row.team_id) ?? { id: row.team_id, name: row.team_name, athletes: [] };
    if (!team.athletes.some((item) => item.id === athlete.id)) team.athletes.push(athlete);
    teamMap.set(row.team_id, team);
  });

  const byName = <T extends { name: string }>(left: T, right: T) => left.name.localeCompare(right.name, "pt-BR");
  return {
    athletes: [...athleteMap.values()].sort(byName),
    teams: [...teamMap.values()].map((team) => ({ ...team, athletes: [...team.athletes].sort(byName) })).sort(byName)
  };
}

export function filterSupervisionItems<T extends { name: string }>(items: T[], query: string): T[] {
  const target = normalize(query.trim());
  return target ? items.filter((item) => normalize(item.name).includes(target)) : items;
}
