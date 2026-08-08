import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RolesBackendError,
  createRolesRepository,
  emptyUserRolesRecord,
  type UserRolesRecord
} from "../../../packages/backend/src/roles-repository";

function createClient(response: { data?: unknown; error?: { message: string } }) {
  const rpc = jest.fn().mockResolvedValue({
    data: response.data ?? null,
    error: response.error ?? null
  });

  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("roles backend repository", () => {
  it("lê o modelo de papéis pela RPC current_user_roles", async () => {
    const record: UserRolesRecord = {
      user_id: "coach-01",
      is_coach: true,
      is_athlete: true,
      is_owner: false,
      roles: ["athlete", "coach"],
      coach_team_ids: ["team-01"],
      athlete_team_ids: ["team-02"]
    };
    const { client, rpc } = createClient({ data: record });
    const repository = createRolesRepository(client);

    await expect(repository.getCurrentUserRoles()).resolves.toEqual(record);
    expect(rpc).toHaveBeenCalledWith("current_user_roles");
  });

  it("devolve o registro vazio quando a RPC não retorna dados", async () => {
    const { client } = createClient({});
    const repository = createRolesRepository(client);

    await expect(repository.getCurrentUserRoles()).resolves.toEqual(emptyUserRolesRecord);
  });

  it("expõe o erro do backend com a operação que falhou", async () => {
    const { client } = createClient({ error: { message: "permission denied for function current_user_roles" } });
    const repository = createRolesRepository(client);

    await expect(repository.getCurrentUserRoles()).rejects.toMatchObject<Partial<RolesBackendError>>({
      name: "RolesBackendError",
      message: "permission denied for function current_user_roles",
      operation: "getCurrentUserRoles"
    });
  });
});
