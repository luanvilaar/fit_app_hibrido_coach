import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TeamDiscoveryBackendError,
  createTeamDiscoveryRepository,
  type DiscoverableTeamRecord,
  type TeamJoinRequestRecord,
  type TeamJoinRequestWithAthleteRecord
} from "../../../packages/backend/src/team-discovery-repository";

function createClient(response: { data?: unknown; error?: { message: string } } = {}) {
  const rpcSingle = jest.fn().mockResolvedValue({ data: response.data ?? null, error: response.error ?? null });
  const rpc = jest.fn().mockImplementation(() => ({
    single: () => rpcSingle()
  }));

  return { client: { rpc } as unknown as SupabaseClient, rpc, rpcSingle };
}

describe("team discovery backend repository", () => {
  it("busca o próprio perfil pelo contrato direto do client", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { user_id: "athlete-01", display_name: "Maria Lima" }, error: null });
    const client = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle }) })
      })
    } as unknown as SupabaseClient;
    const repository = createTeamDiscoveryRepository(client);

    await expect(repository.getMyProfile("athlete-01")).resolves.toEqual({
      user_id: "athlete-01",
      display_name: "Maria Lima"
    });
  });

  it("devolve null quando o próprio perfil ainda não tem linha", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle }) })
      })
    } as unknown as SupabaseClient;
    const repository = createTeamDiscoveryRepository(client);

    await expect(repository.getMyProfile("athlete-01")).resolves.toBeNull();
  });

  it("lista grupos disponíveis pela RPC list_discoverable_teams", async () => {
    const team: DiscoverableTeamRecord = {
      id: "team-01",
      name: "Strength Base",
      description: "Equipe de força.",
      level: "intermediário",
      objective: "Aumentar força.",
      coach_display_name: "Carlos Souza",
      athlete_count: 3,
      membership_status: "none",
      join_request_id: null
    };
    const rpc = jest.fn().mockResolvedValue({ data: [team], error: null });
    const repository = createTeamDiscoveryRepository({ rpc } as unknown as SupabaseClient);

    await expect(repository.listDiscoverableTeams()).resolves.toEqual([team]);
    expect(rpc).toHaveBeenCalledWith("list_discoverable_teams");
  });

  it("devolve lista vazia quando a RPC não retorna dados", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const repository = createTeamDiscoveryRepository({ rpc } as unknown as SupabaseClient);

    await expect(repository.listDiscoverableTeams()).resolves.toEqual([]);
  });

  it("solicita e cancela vínculo com um grupo", async () => {
    const request: TeamJoinRequestRecord = {
      id: "request-01",
      team_id: "team-01",
      athlete_id: "athlete-01",
      status: "pending",
      created_at: "2026-08-08T12:00:00.000Z"
    };
    const { client, rpc, rpcSingle } = createClient({ data: request });
    const repository = createTeamDiscoveryRepository(client);

    await expect(repository.requestTeamJoin("team-01")).resolves.toEqual(request);
    expect(rpc).toHaveBeenCalledWith("request_team_join", { p_team_id: "team-01" });
    expect(rpcSingle).toHaveBeenCalledTimes(1);

    const cancelRpc = jest.fn().mockResolvedValue({ data: request, error: null });
    await expect(
      createTeamDiscoveryRepository({ rpc: cancelRpc } as unknown as SupabaseClient).cancelTeamJoinRequest(
        "request-01"
      )
    ).resolves.toBeUndefined();
    expect(cancelRpc).toHaveBeenCalledWith("cancel_team_join_request", { p_request_id: "request-01" });
  });

  it("propaga erro amigável ao solicitar vínculo duplicado", async () => {
    const { client } = createClient({ error: { message: "Você já tem uma solicitação pendente para este grupo." } });
    const repository = createTeamDiscoveryRepository(client);

    await expect(repository.requestTeamJoin("team-01")).rejects.toMatchObject<Partial<TeamDiscoveryBackendError>>({
      name: "TeamDiscoveryBackendError",
      message: "Você já tem uma solicitação pendente para este grupo.",
      operation: "requestTeamJoin"
    });
  });

  it("lista e responde solicitações pendentes do lado do coach", async () => {
    const request: TeamJoinRequestWithAthleteRecord = {
      id: "request-01",
      team_id: "team-01",
      athlete_id: "athlete-01",
      athlete_display_name: "Maria Lima",
      status: "pending",
      created_at: "2026-08-08T12:00:00.000Z"
    };
    const rpc = jest.fn().mockResolvedValue({ data: [request], error: null });
    const repository = createTeamDiscoveryRepository({ rpc } as unknown as SupabaseClient);

    await expect(repository.listTeamJoinRequests("team-01")).resolves.toEqual([request]);
    expect(rpc).toHaveBeenCalledWith("list_team_join_requests", { p_team_id: "team-01" });

    const respondRpc = jest.fn().mockResolvedValue({ data: { ...request, status: "accepted" }, error: null });
    await expect(
      createTeamDiscoveryRepository({ rpc: respondRpc } as unknown as SupabaseClient).respondTeamJoinRequest(
        "request-01",
        true
      )
    ).resolves.toBeUndefined();
    expect(respondRpc).toHaveBeenCalledWith("respond_team_join_request", {
      p_request_id: "request-01",
      p_accept: true
    });
  });

  it("atualiza o nome de exibição do usuário autenticado", async () => {
    const { client, rpc } = createClient({ data: { user_id: "athlete-01", display_name: "Maria Lima" } });
    const repository = createTeamDiscoveryRepository(client);

    await expect(repository.updateMyDisplayName("Maria Lima")).resolves.toEqual({
      user_id: "athlete-01",
      display_name: "Maria Lima"
    });
    expect(rpc).toHaveBeenCalledWith("update_my_display_name", { p_display_name: "Maria Lima" });
  });
});
