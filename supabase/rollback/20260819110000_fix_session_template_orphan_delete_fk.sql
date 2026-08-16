-- Rollback de 20260819110000: restaura update_session_instance/delete_session_instance
-- para a checagem de órfão que considera só session_instances (comportamento anterior,
-- que falha com violação de FK ao editar/excluir sessões vinculadas a produtos da loja).

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

  if not exists (
    select 1
    from public.session_instances
    where template_id = previous_template_id
  ) then
    delete from public.session_templates where id = previous_template_id;
  end if;

  update public.athlete_session_progress
  set completed_block_ids = '{}'
  where session_id = p_session_id
    and completed_block_ids <> '{}';

  return instance_row;
end;
$$;

comment on function public.update_session_instance(uuid, text, jsonb, date, public.session_status, text) is
  'Regrava conteúdo, data e status de uma sessão do coach, atualizando o snapshot congelado da instância.';

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

  delete from public.session_instances where id = p_session_id;

  if not exists (
    select 1
    from public.session_instances
    where template_id = previous_template_id
  ) then
    delete from public.session_templates where id = previous_template_id;
  end if;
end;
$$;

comment on function public.delete_session_instance(uuid) is
  'Remove uma sessão do calendário do coach e o template que ficar órfão.';
