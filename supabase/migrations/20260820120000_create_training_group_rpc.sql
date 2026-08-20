-- Criação atômica de equipes pelo coach autenticado.
--
-- A inserção direta pelo client depende simultaneamente da policy de INSERT
-- e da policy de SELECT para devolver `insert().select().single()`. Esta RPC
-- preserva o auth.uid() do chamador e executa a gravação como função dona do
-- schema, evitando que uma policy RLS ausente/inconsistente bloqueie o fluxo.

create or replace function public.create_training_group(
  p_name text,
  p_description text,
  p_level public.training_group_level,
  p_objective text
)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  team_row public.teams%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  insert into public.teams (name, description, level, objective, created_by)
  values (p_name, p_description, p_level, p_objective, auth.uid())
  returning * into team_row;

  return team_row;
end;
$$;

revoke all on function public.create_training_group(text, text, public.training_group_level, text) from public;
grant execute on function public.create_training_group(text, text, public.training_group_level, text) to authenticated;

-- PostgREST mantém um cache de funções RPC. Sem este sinal a função recém-criada
-- pode continuar indisponível para o client até o próximo reload automático.
notify pgrst, 'reload schema';
