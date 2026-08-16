-- Corrige a limpeza de templates órfãos em update_session_instance/delete_session_instance
-- (20260806160000 e 20260806180000): elas só checavam session_instances antes de apagar o
-- session_template anterior. Desde 20260817100000, store_product_sessions também referencia
-- session_templates com "on delete restrict" — editar ou excluir uma sessão cujo template
-- também está vinculado a um produto publicado na loja agora falha com violação de FK,
-- porque a checagem de órfão nunca soube da tabela nova.

create or replace function public.update_session_instance(
  p_session_id uuid,
  p_title text,
  p_blocks jsonb,
  p_scheduled_date date default null,
  p_status public.session_status default null,
  p_coach_note text default null
)
returns public.session_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  instance_row public.session_instances%rowtype;
  template_row public.session_templates%rowtype;
  previous_template_id uuid;
  next_status public.session_status;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  select * into instance_row
  from public.session_instances
  where id = p_session_id;

  if instance_row.id is null then
    raise exception using message = 'Sessão não encontrada.';
  end if;

  if not public.is_team_coach(instance_row.team_id) then
    raise exception using message = 'Somente coaches da equipe podem editar sessões.';
  end if;

  previous_template_id := instance_row.template_id;
  next_status := coalesce(p_status, instance_row.status);

  -- Cria um template novo em vez de mutar o anterior: outras instâncias podem referenciá-lo.
  select * into template_row
  from public.create_session_template_with_content(p_title, p_blocks, next_status);

  update public.session_instances
  set template_id = template_row.id,
      scheduled_date = coalesce(p_scheduled_date, instance_row.scheduled_date),
      status = next_status,
      coach_note = coalesce(btrim(p_coach_note), instance_row.coach_note),
      snapshot = public.build_template_snapshot(template_row.id)
  where id = p_session_id
  returning * into instance_row;

  -- Só apaga o template anterior se nada mais referenciá-lo: nem outra instância de sessão,
  -- nem um produto da loja (store_product_sessions.session_template_id é "on delete restrict").
  if not exists (
    select 1
    from public.session_instances
    where template_id = previous_template_id
  ) and not exists (
    select 1
    from public.store_product_sessions
    where session_template_id = previous_template_id
  ) then
    delete from public.session_templates where id = previous_template_id;
  end if;

  -- O snapshot novo tem outros ids de bloco: manter os antigos marcaria blocos inexistentes.
  update public.athlete_session_progress
  set completed_block_ids = '{}'
  where session_id = p_session_id
    and completed_block_ids <> '{}';

  return instance_row;
end;
$$;

comment on function public.update_session_instance(uuid, text, jsonb, date, public.session_status, text) is
  'Regrava conteúdo, data, status e nota do coach de uma sessão, atualizando o snapshot congelado da instância. Só apaga o template anterior se nenhuma outra sessão ou produto da loja ainda o referenciar.';

create or replace function public.delete_session_instance(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  instance_row public.session_instances%rowtype;
  previous_template_id uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  select * into instance_row
  from public.session_instances
  where id = p_session_id;

  if instance_row.id is null then
    raise exception using message = 'Sessão não encontrada.';
  end if;

  if not public.is_team_coach(instance_row.team_id) then
    raise exception using message = 'Somente coaches da equipe podem excluir sessões.';
  end if;

  previous_template_id := instance_row.template_id;

  -- Ordem obrigatória: session_instances.template_id é on delete restrict.
  delete from public.session_instances where id = p_session_id;

  -- Só apaga o template órfão se nada mais referenciá-lo: nem outra instância de sessão,
  -- nem um produto da loja (store_product_sessions.session_template_id é "on delete restrict").
  if not exists (
    select 1
    from public.session_instances
    where template_id = previous_template_id
  ) and not exists (
    select 1
    from public.store_product_sessions
    where session_template_id = previous_template_id
  ) then
    delete from public.session_templates where id = previous_template_id;
  end if;
end;
$$;

comment on function public.delete_session_instance(uuid) is
  'Remove uma sessão do calendário do coach e o template que ficar órfão, exceto quando ainda estiver vinculado a um produto da loja.';
