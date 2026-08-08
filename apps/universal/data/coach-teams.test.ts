import {
  buildAddMemberPayload,
  buildCreateTeamPayload,
  buildUpdateTeamPayload,
  createInitialMemberInviteForm,
  createInitialTeamForm,
  toTeamForm,
  updateMemberInviteField,
  updateTeamField
} from "@/data/coach-teams";

describe("formulário de equipe", () => {
  it("começa vazio com o nível iniciante", () => {
    expect(createInitialTeamForm()).toEqual({
      name: "",
      description: "",
      level: "iniciante",
      objective: ""
    });
  });

  it("hidrata o formulário a partir de uma equipe existente", () => {
    const team = { name: "Strength Base", description: "Equipe de força.", level: "avançado" as const, objective: "Ganhar força." };
    expect(toTeamForm(team)).toEqual(team);
  });

  it("atualiza um campo sem afetar os demais", () => {
    const form = createInitialTeamForm();
    const next = updateTeamField(form, "name", "Strength Base");
    expect(next.name).toBe("Strength Base");
    expect(next.level).toBe("iniciante");
  });

  it("exige nome e objetivo para montar o payload de criação", () => {
    const form = createInitialTeamForm();
    expect(() => buildCreateTeamPayload(form)).toThrow("Nome da equipe é obrigatório.");
    expect(() => buildCreateTeamPayload({ ...form, name: "Strength Base" })).toThrow(
      "Objetivo da equipe é obrigatório."
    );
  });

  it("aceita descrição vazia e monta o payload de criação completo", () => {
    const form = { name: " Strength Base ", description: "  ", level: "intermediário" as const, objective: " Ganhar força. " };
    expect(buildCreateTeamPayload(form)).toEqual({
      name: "Strength Base",
      description: "",
      level: "intermediário",
      objective: "Ganhar força."
    });
  });

  it("monta o payload de edição com o teamId", () => {
    const form = { name: "Strength Base", description: "Equipe de força.", level: "avançado" as const, objective: "Ganhar força." };
    expect(buildUpdateTeamPayload("team-01", form)).toEqual({
      teamId: "team-01",
      name: "Strength Base",
      description: "Equipe de força.",
      level: "avançado",
      objective: "Ganhar força."
    });
  });
});

describe("formulário de convite por e-mail", () => {
  it("começa com papel atleta", () => {
    expect(createInitialMemberInviteForm()).toEqual({ email: "", role: "athlete" });
  });

  it("atualiza um campo do convite", () => {
    const form = createInitialMemberInviteForm();
    expect(updateMemberInviteField(form, "role", "coach")).toEqual({ email: "", role: "coach" });
  });

  it("rejeita e-mail vazio", () => {
    expect(() => buildAddMemberPayload("team-01", createInitialMemberInviteForm())).toThrow(
      "E-mail é obrigatório."
    );
  });

  it("rejeita e-mail em formato inválido", () => {
    expect(() =>
      buildAddMemberPayload("team-01", { email: "nao-e-email", role: "athlete" })
    ).toThrow("Informe um e-mail válido.");
  });

  it("normaliza o e-mail para minúsculas e monta o payload", () => {
    expect(buildAddMemberPayload("team-01", { email: " Atleta@Exemplo.com ", role: "athlete" })).toEqual({
      teamId: "team-01",
      email: "atleta@exemplo.com",
      role: "athlete"
    });
  });
});
