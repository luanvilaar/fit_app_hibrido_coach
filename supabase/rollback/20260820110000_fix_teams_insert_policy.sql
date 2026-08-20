-- Rollback de 20260820110000_fix_teams_insert_policy.sql.
--
-- Remove a policy de INSERT em public.teams recriada por essa migration,
-- devolvendo o estado observado em produção antes dela: coaches não
-- conseguem criar equipes (erro de RLS em qualquer tentativa). Só execute
-- se a correção causar algum efeito colateral inesperado.

drop policy if exists "authenticated users can create teams" on public.teams;
