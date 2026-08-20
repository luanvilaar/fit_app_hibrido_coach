import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20260820130000_coach_athlete_supervision.sql"), "utf8");
const repair = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20260820140000_repair_coach_supervision_schema_cache.sql"), "utf8");
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

  it("repara as três RPCs com assinaturas, escopo e cache explícitos", () => {
    expect(repair).toContain("create or replace function public.list_coach_supervision_roster()");
    expect(repair).toContain("create or replace function public.list_coach_supervision_sessions(");
    expect(repair).toContain("create or replace function public.get_coach_supervision_session(p_athlete_id uuid, p_session_id uuid)");
    expect(repair).toContain("public.can_supervise_athlete_in_team(p_athlete_id, instance_row.team_id)");
    expect(repair).toContain("athlete_member.role = 'athlete'");
    expect(repair).toContain("security definer");
    expect(repair).toContain("set search_path = public");
    expect(repair).toContain("revoke all on function public.list_coach_supervision_roster() from public;");
    expect(repair).toContain("revoke all on function public.list_coach_supervision_sessions(uuid, date, date) from public;");
    expect(repair).toContain("revoke all on function public.get_coach_supervision_session(uuid, uuid) from public;");
    expect(repair).toContain("grant execute on function public.list_coach_supervision_roster() to authenticated;");
    expect(repair).toContain("grant execute on function public.list_coach_supervision_sessions(uuid, date, date) to authenticated;");
    expect(repair).toContain("grant execute on function public.get_coach_supervision_session(uuid, uuid) to authenticated;");
    expect(repair).toContain("notify pgrst, 'reload schema'");
  });
});
