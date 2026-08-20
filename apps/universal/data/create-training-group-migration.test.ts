import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../../supabase/migrations/20260820120000_create_training_group_rpc.sql"
);

describe("create_training_group migration", () => {
  it("publica a RPC autenticada e recarrega o schema cache do PostgREST", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create or replace function public.create_training_group(");
    expect(migration).toContain("security definer");
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).toContain("grant execute on function public.create_training_group");
    expect(migration.trimEnd().endsWith("notify pgrst, 'reload schema';")).toBe(true);
  });
});
