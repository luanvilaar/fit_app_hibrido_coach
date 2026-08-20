import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CoachFlowBackendError,
  createCoachFlowRepository,
  type SessionInstanceRecord,
  type SessionTemplateRecord,
  type TrainingGroupRecord
} from "../../../packages/backend/src/coach-flow-repository";

type MockQuery = {
  single: jest.Mock;
};

function createMockClient(options?: {
  team?: TrainingGroupRecord;
  template?: SessionTemplateRecord;
  instance?: SessionInstanceRecord;
  rpcError?: { message: string };
}) {
  const insertSingle = jest.fn().mockResolvedValue({ data: options?.team, error: null });
  const rpcSingle = jest.fn().mockImplementation((rpcName: string) => {
    if (rpcName === "create_training_group") {
      return Promise.resolve({ data: options?.team, error: null });
    }
    if (rpcName === "create_session_template_with_content") {
      return Promise.resolve({ data: options?.template, error: null });
    }
    return Promise.resolve({ data: options?.instance, error: options?.rpcError ?? null });
  });
  const query: MockQuery = { single: insertSingle };
  const client = {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(query)
      })
    }),
    rpc: jest.fn().mockImplementation((rpcName: string) => ({
      single: () => rpcSingle(rpcName)
    }))
  } as unknown as SupabaseClient;

  return { client, insertSingle, rpcSingle };
}

describe("coach flow backend repository", () => {
  it("creates a team and applies a session through the Supabase contract", async () => {
    const team: TrainingGroupRecord = {
      id: "team-01",
      name: "Strength Base",
      description: "Equipe de força.",
      level: "intermediário",
      objective: "Aumentar força.",
      created_by: "coach-01",
      created_at: "2026-08-05T12:00:00.000Z"
    };
    const instance: SessionInstanceRecord = {
      id: "instance-01",
      template_id: "template-01",
      team_id: "team-01",
      scheduled_date: "2026-08-10",
      status: "published",
      coach_note: "",
      snapshot: { template_id: "template-01", blocks: [] },
      created_by: "coach-01",
      created_at: "2026-08-05T12:00:00.000Z"
    };
    const template: SessionTemplateRecord = {
      id: "template-01",
      title: "Lower Strength",
      status: "published",
      created_by: "coach-01",
      created_at: "2026-08-05T12:00:00.000Z"
    };
    const { client, insertSingle, rpcSingle } = createMockClient({ team, template, instance });
    const repository = createCoachFlowRepository(client);

    await expect(
      repository.createTrainingGroup({
        name: "Strength Base",
        description: "Equipe de força.",
        level: "intermediário",
        objective: "Aumentar força."
      })
    ).resolves.toEqual(team);
    await expect(
      repository.createSessionTemplate({
        title: "Lower Strength",
        status: "published",
        blocks: [
          {
            name: "Força principal",
            kind: "strength",
            items: [
              {
                exerciseSlug: "back-squat",
                exerciseName: "Back Squat",
                prescription: {
                  kind: "sets-reps",
                  rest_seconds: 150,
                  sets: [{ reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 }]
                }
              }
            ]
          }
        ]
      })
    ).resolves.toEqual(template);
    await expect(
      repository.applySessionToTeam({
        templateId: "template-01",
        teamId: team.id,
        scheduledDate: "2026-08-10",
        status: "published"
      })
    ).resolves.toEqual(instance);

    expect(insertSingle).not.toHaveBeenCalled();
    expect(rpcSingle).toHaveBeenCalledTimes(3);
    expect(client.rpc).toHaveBeenCalledWith("create_training_group", {
      p_name: "Strength Base",
      p_description: "Equipe de força.",
      p_level: "intermediário",
      p_objective: "Aumentar força."
    });
    expect(client.rpc).toHaveBeenCalledWith("create_session_template_with_content", {
      p_title: "Lower Strength",
      p_blocks: [
        {
          name: "Força principal",
          kind: "strength",
          details: {},
          items: [
            {
              exercise_slug: "back-squat",
              exercise_name: "Back Squat",
              prescription: {
                kind: "sets-reps",
                rest_seconds: 150,
                sets: [{ reps_min: 3, reps_max: 5, load_type: "percentage-1rm", load_value: 75 }]
              }
            }
          ]
        }
      ],
      p_status: "published"
    });
    expect(client.rpc).toHaveBeenCalledWith("apply_session_template_to_team", {
      p_template_id: "template-01",
      p_team_id: "team-01",
      p_scheduled_date: "2026-08-10",
      p_status: "published",
      p_coach_note: ""
    });
  });

  it("exposes backend errors with the operation that failed", async () => {
    const { client } = createMockClient({ rpcError: { message: "A equipe precisa ter pelo menos um atleta." } });
    const repository = createCoachFlowRepository(client);

    await expect(
      repository.applySessionToTeam({
        templateId: "template-01",
        teamId: "team-empty",
        scheduledDate: "2026-08-10"
      })
    ).rejects.toMatchObject<Partial<CoachFlowBackendError>>({
      name: "CoachFlowBackendError",
      message: "A equipe precisa ter pelo menos um atleta.",
      operation: "applySessionToTeam"
    });
  });

  it("lists coach teams and publishes a prescription in one RPC", async () => {
    const team: TrainingGroupRecord = {
      id: "team-01",
      name: "Strength Base",
      description: "Equipe de força.",
      level: "intermediário",
      objective: "Aumentar força.",
      created_by: "coach-01",
      created_at: "2026-08-05T12:00:00.000Z"
    };
    const instance: SessionInstanceRecord = {
      id: "instance-02",
      template_id: "template-02",
      team_id: "team-01",
      scheduled_date: "2026-08-11",
      status: "published",
      coach_note: "",
      snapshot: { title: "Upper Strength" },
      created_by: "coach-01",
      created_at: "2026-08-05T12:00:00.000Z"
    };
    const rpc = jest.fn().mockImplementation((rpcName: string) => {
      if (rpcName === "list_coach_teams") {
        return Promise.resolve({ data: [team], error: null });
      }

      if (rpcName === "list_coach_calendar") {
        return Promise.resolve({ data: [instance], error: null });
      }

      return {
        single: () => Promise.resolve({ data: instance, error: null })
      };
    });
    const client = { rpc } as unknown as SupabaseClient;
    const repository = createCoachFlowRepository(client);

    await expect(repository.listCoachTeams()).resolves.toEqual([team]);
    await expect(repository.listCoachCalendar({ from: "2026-08-01", to: "2026-08-31" })).resolves.toEqual([instance]);
    await expect(
      repository.prescribeSession({
        teamId: "team-01",
        title: "Upper Strength",
        scheduledDate: "2026-08-11",
        blocks: [
          {
            name: "Força principal",
            kind: "strength",
            items: [
              {
                exerciseSlug: "bench-press",
                exerciseName: "Bench Press",
                prescription: {
                  kind: "sets-reps",
                  sets: [{ reps: 5 }]
                }
              }
            ]
          }
        ]
      })
    ).resolves.toEqual(instance);

    expect(rpc).toHaveBeenCalledWith("list_coach_calendar", {
      p_from: "2026-08-01",
      p_to: "2026-08-31"
    });
    expect(rpc).toHaveBeenCalledWith("create_and_apply_session_to_team", expect.objectContaining({
      p_team_id: "team-01",
      p_scheduled_date: "2026-08-11",
      p_status: "published"
    }));
  });

  it("atualiza uma sessão existente pela RPC de edição", async () => {
    const instance: SessionInstanceRecord = {
      id: "instance-03",
      template_id: "template-03",
      team_id: "team-01",
      scheduled_date: "2026-08-12",
      status: "draft",
      coach_note: "",
      snapshot: { title: "Upper Strength" },
      created_by: "coach-01",
      created_at: "2026-08-06T12:00:00.000Z"
    };
    const rpc = jest.fn().mockReturnValue({
      single: () => Promise.resolve({ data: instance, error: null })
    });
    const client = { rpc } as unknown as SupabaseClient;
    const repository = createCoachFlowRepository(client);

    await expect(
      repository.updateSession({
        sessionId: "instance-03",
        title: "Upper Strength",
        scheduledDate: "2026-08-12",
        status: "draft",
        blocks: [
          {
            name: "Força principal",
            kind: "strength",
            items: [
              {
                exerciseSlug: "power-snatch",
                exerciseName: "Power Snatch",
                prescription: { kind: "sets-reps", sets: [{ reps: 3 }] }
              }
            ]
          }
        ]
      })
    ).resolves.toEqual(instance);

    expect(rpc).toHaveBeenCalledWith("update_session_instance", {
      p_session_id: "instance-03",
      p_title: "Upper Strength",
      p_scheduled_date: "2026-08-12",
      p_status: "draft",
      p_coach_note: "",
      p_blocks: [
        {
          name: "Força principal",
          kind: "strength",
          details: {},
          items: [
            {
              exercise_slug: "power-snatch",
              exercise_name: "Power Snatch",
              prescription: { kind: "sets-reps", sets: [{ reps: 3 }] }
            }
          ]
        }
      ]
    });
  });

  it("exclui uma sessão e propaga a falha com a operação", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const repository = createCoachFlowRepository({ rpc } as unknown as SupabaseClient);

    await expect(repository.deleteSession("instance-03")).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("delete_session_instance", { p_session_id: "instance-03" });

    const failing = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Somente coaches da equipe podem excluir sessões." }
    });

    await expect(
      createCoachFlowRepository({ rpc: failing } as unknown as SupabaseClient).deleteSession("instance-03")
    ).rejects.toMatchObject<Partial<CoachFlowBackendError>>({
      name: "CoachFlowBackendError",
      message: "Somente coaches da equipe podem excluir sessões.",
      operation: "deleteSession"
    });
  });

  it("edita e exclui uma equipe pelo contrato direto do client", async () => {
    const team: TrainingGroupRecord = {
      id: "team-01",
      name: "Strength Base",
      description: "Equipe de força.",
      level: "avançado",
      objective: "Ganhar força.",
      created_by: "coach-01",
      created_at: "2026-08-06T12:00:00.000Z"
    };
    const updateSingle = jest.fn().mockResolvedValue({ data: team, error: null });
    const getSingle = jest.fn().mockResolvedValue({ data: team, error: null });
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const client = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: getSingle }) }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: updateSingle }) })
        }),
        delete: jest.fn().mockReturnValue({ eq: deleteEq })
      })
    } as unknown as SupabaseClient;
    const repository = createCoachFlowRepository(client);

    await expect(repository.getTrainingGroup("team-01")).resolves.toEqual(team);
    await expect(
      repository.updateTrainingGroup({
        teamId: "team-01",
        name: "Strength Base",
        description: "Equipe de força.",
        level: "avançado",
        objective: "Ganhar força."
      })
    ).resolves.toEqual(team);
    await expect(repository.deleteTrainingGroup("team-01")).resolves.toBeUndefined();
    expect(deleteEq).toHaveBeenCalledWith("id", "team-01");
  });

  it("lista equipes com contagem de membros", async () => {
    const summary = {
      id: "team-01",
      name: "Strength Base",
      description: "Equipe de força.",
      level: "avançado",
      objective: "Ganhar força.",
      created_by: "coach-01",
      created_at: "2026-08-06T12:00:00.000Z",
      coach_count: 1,
      athlete_count: 3
    };
    const rpc = jest.fn().mockResolvedValue({ data: [summary], error: null });
    const repository = createCoachFlowRepository({ rpc } as unknown as SupabaseClient);

    await expect(repository.listCoachTeamsWithMemberCounts()).resolves.toEqual([summary]);
    expect(rpc).toHaveBeenCalledWith("list_coach_teams_with_member_counts");
  });

  it("lista e adiciona membros de uma equipe por e-mail, e remove um membro", async () => {
    const member = {
      id: "member-01",
      user_id: "athlete-01",
      email: "atleta@exemplo.com",
      role: "athlete",
      created_at: "2026-08-06T12:00:00.000Z"
    };
    const rpc = jest.fn().mockImplementation((rpcName: string) => {
      if (rpcName === "list_team_members") {
        return Promise.resolve({ data: [member], error: null });
      }

      return { single: () => Promise.resolve({ data: member, error: null }) };
    });
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const client = {
      rpc,
      from: jest.fn().mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: deleteEq }) })
    } as unknown as SupabaseClient;
    const repository = createCoachFlowRepository(client);

    await expect(repository.listTeamMembers("team-01")).resolves.toEqual([member]);
    await expect(
      repository.addTeamMemberByEmail({ teamId: "team-01", email: "atleta@exemplo.com", role: "athlete" })
    ).resolves.toEqual(member);
    expect(rpc).toHaveBeenCalledWith("add_team_member_by_email", {
      p_team_id: "team-01",
      p_email: "atleta@exemplo.com",
      p_role: "athlete"
    });

    await expect(repository.removeTeamMember("member-01")).resolves.toBeUndefined();
    expect(deleteEq).toHaveBeenCalledWith("id", "member-01");
  });

  it("propaga erro amigável ao tentar adicionar membro inexistente", async () => {
    const rpc = jest.fn().mockReturnValue({
      single: () =>
        Promise.resolve({ data: null, error: { message: "Não encontramos nenhuma conta com este e-mail." } })
    });
    const repository = createCoachFlowRepository({ rpc } as unknown as SupabaseClient);

    await expect(
      repository.addTeamMemberByEmail({ teamId: "team-01", email: "ninguem@exemplo.com", role: "athlete" })
    ).rejects.toMatchObject<Partial<CoachFlowBackendError>>({
      name: "CoachFlowBackendError",
      message: "Não encontramos nenhuma conta com este e-mail.",
      operation: "addTeamMemberByEmail"
    });
  });

  it("lista, carrega, edita e exclui um treino da biblioteca", async () => {
    const summary = {
      id: "template-01",
      title: "Lower Strength",
      status: "draft",
      created_at: "2026-08-06T12:00:00.000Z",
      updated_at: "2026-08-06T12:00:00.000Z"
    };
    const content = {
      template_id: "template-01",
      title: "Lower Strength",
      status: "draft",
      blocks: []
    };
    const template: SessionTemplateRecord = {
      id: "template-01",
      title: "Lower Strength",
      status: "published",
      created_by: "coach-01",
      created_at: "2026-08-06T12:00:00.000Z"
    };
    const orderMock = jest.fn().mockResolvedValue({ data: [summary], error: null });
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const rpc = jest.fn().mockImplementation((rpcName: string) => {
      if (rpcName === "get_session_template_content") {
        return Promise.resolve({ data: content, error: null });
      }

      return { single: () => Promise.resolve({ data: template, error: null }) };
    });
    const client = {
      rpc,
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ order: orderMock }),
        delete: jest.fn().mockReturnValue({ eq: deleteEq })
      })
    } as unknown as SupabaseClient;
    const repository = createCoachFlowRepository(client);

    await expect(repository.listSessionTemplates()).resolves.toEqual([summary]);
    await expect(repository.getSessionTemplateContent("template-01")).resolves.toEqual(content);
    await expect(
      repository.updateSessionTemplateContent({
        templateId: "template-01",
        title: "Lower Strength",
        status: "published",
        blocks: [
          {
            name: "Força principal",
            kind: "strength",
            items: [
              { exerciseSlug: "back-squat", exerciseName: "Back Squat", prescription: { kind: "sets-reps", sets: [{ reps: 5 }] } }
            ]
          }
        ]
      })
    ).resolves.toEqual(template);
    expect(rpc).toHaveBeenCalledWith("update_session_template_content", expect.objectContaining({
      p_template_id: "template-01",
      p_title: "Lower Strength",
      p_status: "published"
    }));

    await expect(repository.deleteSessionTemplate("template-01")).resolves.toBeUndefined();
    expect(deleteEq).toHaveBeenCalledWith("id", "template-01");
  });

  it("propaga erro amigável de chave estrangeira ao excluir treino já aplicado", async () => {
    const deleteEq = jest.fn().mockResolvedValue({
      error: {
        message:
          'update or delete on table "session_templates" violates foreign key constraint "session_instances_template_id_fkey" on table "session_instances"'
      }
    });
    const client = {
      from: jest.fn().mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: deleteEq }) })
    } as unknown as SupabaseClient;
    const repository = createCoachFlowRepository(client);

    await expect(repository.deleteSessionTemplate("template-01")).rejects.toMatchObject<
      Partial<CoachFlowBackendError>
    >({
      name: "CoachFlowBackendError",
      operation: "deleteSessionTemplate"
    });
  });
});
