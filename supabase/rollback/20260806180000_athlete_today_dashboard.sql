-- Remove a execução do treino pelo atleta e restaura as RPCs de coach sem coach_note.
-- Atenção: apaga progresso, resultados de série e check-ins já registrados.

drop function if exists public.get_athlete_session_workout(uuid);
drop function if exists public.get_athlete_today(date);
drop function if exists public.upsert_athlete_checkin(smallint, smallint, smallint, text, date);
drop function if exists public.save_athlete_set_result(uuid, uuid, integer, numeric, numeric, boolean);
drop function if exists public.toggle_athlete_block(uuid, uuid);
drop function if exists public.complete_athlete_session(uuid, public.athlete_session_state);
drop function if exists public.start_athlete_session(uuid);

drop table if exists public.athlete_daily_checkins;
drop table if exists public.athlete_set_results;
drop table if exists public.athlete_session_progress;

drop type if exists public.athlete_session_state;

drop function if exists public.enrich_snapshot_media(jsonb);

-- Restaura as assinaturas sem p_coach_note.
drop function if exists public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status, text);
drop function if exists public.update_session_instance(uuid, text, jsonb, date, public.session_status, text);
drop function if exists public.apply_session_template_to_team(uuid, uuid, date, public.session_status, text);

create or replace function public.build_template_snapshot(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'template_id', template_row.id,
    'title', template_row.title,
    'blocks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', block_row.id,
            'name', block_row.name,
            'kind', block_row.kind,
            'position', block_row.position,
            'items', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', item_row.id,
                    'exercise_id', item_row.exercise_id,
                    'exercise_name', exercise_row.name,
                    'position', item_row.position,
                    'prescription', (
                      select jsonb_build_object(
                        'id', prescription_row.id,
                        'kind', prescription_row.kind,
                        'rest_seconds', prescription_row.rest_seconds,
                        'duration_seconds', prescription_row.duration_seconds,
                        'minutes', prescription_row.minutes,
                        'notes', prescription_row.notes,
                        'sets', coalesce(
                          (
                            select jsonb_agg(to_jsonb(set_row) - 'prescription_id' order by set_row.set_number)
                            from public.prescription_sets set_row
                            where set_row.prescription_id = prescription_row.id
                          ),
                          '[]'::jsonb
                        )
                      )
                      from public.prescriptions prescription_row
                      where prescription_row.block_item_id = item_row.id
                    )
                  )
                  order by item_row.position
                )
                from public.block_items item_row
                join public.exercises exercise_row on exercise_row.id = item_row.exercise_id
                where item_row.block_id = block_row.id
              ),
              '[]'::jsonb
            )
          )
          order by block_row.position
        )
        from public.session_blocks block_row
        where block_row.template_id = template_row.id
      ),
      '[]'::jsonb
    )
  )
  from public.session_templates template_row
  where template_row.id = p_template_id;
$$;

create or replace function public.apply_session_template_to_team(
  p_template_id uuid,
  p_team_id uuid,
  p_scheduled_date date,
  p_status public.session_status default 'draft'
)
returns public.session_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
  instance_row public.session_instances%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente coaches da equipe podem aplicar sessões.';
  end if;

  if not exists (
    select 1
    from public.team_members
    where team_id = p_team_id
      and role = 'athlete'
  ) then
    raise exception using message = 'A equipe precisa ter pelo menos um atleta.';
  end if;

  select * into template_row
  from public.session_templates
  where id = p_template_id
    and created_by = auth.uid();

  if template_row.id is null then
    raise exception using message = 'Template de sessão não encontrado ou não autorizado.';
  end if;

  insert into public.session_instances (
    template_id,
    team_id,
    scheduled_date,
    status,
    snapshot,
    created_by
  )
  values (
    template_row.id,
    p_team_id,
    p_scheduled_date,
    p_status,
    public.build_template_snapshot(template_row.id),
    auth.uid()
  )
  returning * into instance_row;

  return instance_row;
end;
$$;

create or replace function public.create_and_apply_session_to_team(
  p_title text,
  p_blocks jsonb,
  p_team_id uuid,
  p_scheduled_date date,
  p_status public.session_status default 'published'
)
returns public.session_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
  instance_row public.session_instances%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not public.is_team_coach(p_team_id) then
    raise exception using message = 'Somente coaches da equipe podem prescrever sessões.';
  end if;

  select * into template_row
  from public.create_session_template_with_content(p_title, p_blocks, p_status);

  select * into instance_row
  from public.apply_session_template_to_team(
    template_row.id,
    p_team_id,
    p_scheduled_date,
    p_status
  );

  return instance_row;
end;
$$;

create or replace function public.update_session_instance(
  p_session_id uuid,
  p_title text,
  p_blocks jsonb,
  p_scheduled_date date default null,
  p_status public.session_status default null
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

  return instance_row;
end;
$$;

alter table public.session_instances drop column if exists coach_note;

revoke all on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status) from public;
revoke all on function public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status) from public;
revoke all on function public.update_session_instance(uuid, text, jsonb, date, public.session_status) from public;

grant execute on function public.apply_session_template_to_team(uuid, uuid, date, public.session_status) to authenticated;
grant execute on function public.create_and_apply_session_to_team(text, jsonb, uuid, date, public.session_status) to authenticated;
grant execute on function public.update_session_instance(uuid, text, jsonb, date, public.session_status) to authenticated;
