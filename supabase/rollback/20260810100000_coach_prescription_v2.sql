-- Rollback reversível da projeção de scores da prescrição v2.
drop function if exists public.list_block_leaderboard(uuid, uuid);
drop function if exists public.submit_block_score(uuid, uuid, text, numeric, integer, numeric, numeric);
drop table if exists public.athlete_block_scores;
