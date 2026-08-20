import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20260820130000_coach_athlete_supervision.sql"), "utf8");
const rollback = readFileSync(resolve(process.cwd(), "../../supabase/rollback/20260820130000_coach_athlete_supervision.sql"), "utf8");

describe("migration de acompanhamento", () => {
  it("remove o vínculo atleta da conta operacional e nunca deriva atleta do owner", () => {
    expect(migration).toContain("lower(account.email) = 'l.vilaar@gmail.com'");
    expect(migration).toContain("member_row.role = 'athlete'");
    expect(migration).toContain("'is_athlete', public.is_athlete()");
    expect(migration).not.toContain("union select 'athlete' where public.is_platform_owner()");
  });

  it("mantém owner fora da execução atleta e protege a supervisão por equipe", () => {
    expect(migration).toContain("select auth.uid() is not null and exists (");
    expect(migration).toContain("public.can_supervise_athlete_in_team(p_athlete_id, instance_row.team_id)");
    expect(migration).toContain("athlete_member.role = 'athlete'");
    expect(migration).toContain("revoke all on function public.can_supervise_athlete_in_team(uuid, uuid) from public;");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("tem rollback autocontido das funções e da policy alteradas", () => {
    expect(rollback).toContain("create or replace function public.is_team_member");
    expect(rollback).toContain("create or replace function public.current_user_roles()");
    expect(rollback).toContain('drop policy if exists "team members and coaches can read their teams"');
    expect(rollback).toContain('create policy "team members can read their teams"');
  });
});
