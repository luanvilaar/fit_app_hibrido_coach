import {
  canAccessCoachArea,
  canAccessOwnerArea,
  emptyUserRoles,
  hasRole,
  normalizeUserRoles,
  roleFallbackRoute
} from "@/auth/roles";

describe("modelo de papéis", () => {
  it("normaliza o payload da RPC preservando papéis e equipes", () => {
    const userRoles = normalizeUserRoles({
      user_id: "user-01",
      is_coach: true,
      is_athlete: true,
      roles: ["athlete", "coach"],
      coach_team_ids: ["team-01"],
      athlete_team_ids: ["team-02", "team-02"]
    });

    expect(userRoles).toEqual({
      userId: "user-01",
      roles: ["coach", "athlete"],
      coachTeamIds: ["team-01"],
      athleteTeamIds: ["team-02"]
    });
    expect(hasRole(userRoles, "coach")).toBe(true);
    expect(canAccessCoachArea(userRoles)).toBe(true);
  });

  it("trata um atleta sem vínculo de coach como sem acesso à área do coach", () => {
    const userRoles = normalizeUserRoles({
      user_id: "user-02",
      is_coach: false,
      is_athlete: true,
      roles: ["athlete"],
      coach_team_ids: [],
      athlete_team_ids: ["team-02"]
    });

    expect(userRoles.roles).toEqual(["athlete"]);
    expect(canAccessCoachArea(userRoles)).toBe(false);
  });

  it("descarta papéis desconhecidos e valores inválidos", () => {
    const userRoles = normalizeUserRoles({
      user_id: 42,
      roles: ["admin", "coach", null, ""],
      coach_team_ids: ["team-01", 7],
      athlete_team_ids: "team-02"
    });

    expect(userRoles).toEqual({
      userId: null,
      roles: ["coach"],
      coachTeamIds: ["team-01"],
      athleteTeamIds: []
    });
  });

  it("infere o papel quando a RPC devolve apenas as equipes", () => {
    const userRoles = normalizeUserRoles({
      user_id: "user-03",
      coach_team_ids: ["team-01"],
      athlete_team_ids: []
    });

    expect(canAccessCoachArea(userRoles)).toBe(true);
  });

  it("reconhece o papel global de proprietário a partir de is_owner", () => {
    const userRoles = normalizeUserRoles({
      user_id: "owner-01",
      is_owner: true,
      coach_team_ids: [],
      athlete_team_ids: []
    });

    expect(userRoles.roles).toEqual(["coach", "owner"]);
    expect(hasRole(userRoles, "owner")).toBe(true);
    expect(hasRole(userRoles, "coach")).toBe(true);
    expect(hasRole(userRoles, "athlete")).toBe(false);
    expect(canAccessCoachArea(userRoles)).toBe(true);
    expect(canAccessOwnerArea(userRoles)).toBe(true);
  });

  it("não concede acesso de proprietário sem is_owner", () => {
    const userRoles = normalizeUserRoles({
      user_id: "coach-02",
      is_coach: true,
      coach_team_ids: ["team-01"],
      athlete_team_ids: []
    });

    expect(canAccessOwnerArea(userRoles)).toBe(false);
  });

  it("devolve o modelo vazio para payloads ausentes ou inválidos", () => {
    expect(normalizeUserRoles(null)).toEqual(emptyUserRoles);
    expect(normalizeUserRoles(undefined)).toEqual(emptyUserRoles);
    expect(normalizeUserRoles("coach")).toEqual(emptyUserRoles);
    expect(canAccessCoachArea(emptyUserRoles)).toBe(false);
  });

  it("mantém a rota de fallback da área restrita", () => {
    expect(roleFallbackRoute).toBe("/app/hoje");
  });
});
