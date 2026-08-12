import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkoutRepository } from "../../../packages/backend/src/workout-repository";

describe("RPCs de leaderboard", () => {
  it("envia score do atleta e consulta o ranking do bloco", async () => {
    const rpc = jest.fn().mockImplementation((name: string) => {
      if (name === "submit_block_score") return { single: () => Promise.resolve({ data: { id: "score-01" }, error: null }) };
      return Promise.resolve({ data: [{ id: "score-01", rank: 1, display_name: "Atleta" }], error: null });
    });
    const repository = createWorkoutRepository({ rpc } as unknown as SupabaseClient);

    await expect(repository.submitBlockScore({ sessionId: "session-01", blockId: "block-01", scoreType: "time", timeSeconds: 95 })).resolves.toMatchObject({ id: "score-01" });
    await expect(repository.listBlockLeaderboard("session-01", "block-01")).resolves.toEqual([{ id: "score-01", rank: 1, display_name: "Atleta" }]);
    expect(rpc).toHaveBeenCalledWith("submit_block_score", expect.objectContaining({ p_session_id: "session-01", p_block_id: "block-01", p_score_type: "time", p_time_seconds: 95 }));
    expect(rpc).toHaveBeenCalledWith("list_block_leaderboard", { p_session_id: "session-01", p_block_id: "block-01" });
  });
});
