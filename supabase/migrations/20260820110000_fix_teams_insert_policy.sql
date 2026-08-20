-- Corrige a policy de INSERT em public.teams: coaches não conseguiam criar
-- equipes ("new row violates row-level security policy for table teams"),
-- mesmo enviando created_by = auth.uid() explicitamente.
--
-- Diagnóstico (reproduzido por script contra o banco real, com usuário
-- descartável): auth.uid() resolve corretamente para a sessão em outros
-- contextos de RLS (ex.: is_team_coach, usada por list_coach_teams_with_
-- member_counts), mas o insert em teams falha mesmo com created_by correto
-- e mesmo para um usuário sem nenhum histórico. A policy declarada em
-- 20260805120000_coach_training_flow.sql não está efetivamente ativa no
-- banco — provável falha silenciosa ao aplicar manualmente, pelo SQL
-- Editor, aquela migration de ~650 linhas.
--
-- Reaplica a policy de forma idempotente (drop if exists + create), com o
-- mesmo texto da migration original.

drop policy if exists "authenticated users can create teams" on public.teams;

create policy "authenticated users can create teams"
on public.teams for insert to authenticated
with check (created_by = auth.uid());
