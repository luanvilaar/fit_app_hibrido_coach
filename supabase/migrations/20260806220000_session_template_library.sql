-- Biblioteca de treinos: ler e editar um template diretamente, fora do fluxo de calendário.
-- A inserção de blocos vira helper reutilizável (insert_template_blocks), consumido tanto pela
-- criação (create_session_template_with_content) quanto pela edição in-place (nova).

create or replace function public.insert_template_blocks(p_template_id uuid, p_blocks jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  block_row public.session_blocks%rowtype;
  item_row public.block_items%rowtype;
  prescription_row public.prescriptions%rowtype;
  block_json jsonb;
  item_json jsonb;
  prescription_json jsonb;
  set_json jsonb;
  exercise_id uuid;
  block_position integer;
  item_position integer;
  set_number integer;
  exercise_slug text;
  exercise_name text;
begin
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) = 0 then
    raise exception using message = 'A sessão precisa ter pelo menos um bloco.';
  end if;

  for block_json, block_position in
    select value, (ordinality - 1)::integer
    from jsonb_array_elements(p_blocks) with ordinality
  loop
    insert into public.session_blocks (template_id, name, kind, position)
    values (
      p_template_id,
      btrim(block_json->>'name'),
      block_json->>'kind',
      block_position
    )
    returning * into block_row;

    if jsonb_typeof(block_json->'items') <> 'array' or jsonb_array_length(block_json->'items') = 0 then
      raise exception using message = 'Cada bloco precisa ter pelo menos um exercício.';
    end if;

    for item_json, item_position in
      select value, (ordinality - 1)::integer
      from jsonb_array_elements(block_json->'items') with ordinality
    loop
      exercise_slug := btrim(item_json->>'exercise_slug');
      exercise_name := btrim(item_json->>'exercise_name');

      if char_length(exercise_slug) < 2 or char_length(exercise_name) < 2 then
        raise exception using message = 'Cada exercício precisa de slug e nome.';
      end if;

      select id into exercise_id
      from public.exercises
      where slug = exercise_slug;

      if exercise_id is null then
        insert into public.exercises (slug, name, created_by)
        values (exercise_slug, exercise_name, auth.uid())
        on conflict (slug) do nothing;

        select id into exercise_id
        from public.exercises
        where slug = exercise_slug;
      end if;

      insert into public.block_items (block_id, exercise_id, position)
      values (block_row.id, exercise_id, item_position)
      returning * into item_row;

      prescription_json := item_json->'prescription';

      if jsonb_typeof(prescription_json) <> 'object' then
        raise exception using message = 'Cada exercício precisa de uma prescrição.';
      end if;

      insert into public.prescriptions (
        block_item_id,
        kind,
        rest_seconds,
        duration_seconds,
        minutes,
        notes
      )
      values (
        item_row.id,
        prescription_json->>'kind',
        nullif(prescription_json->>'rest_seconds', '')::integer,
        nullif(prescription_json->>'duration_seconds', '')::integer,
        nullif(prescription_json->>'minutes', '')::numeric,
        prescription_json->>'notes'
      )
      returning * into prescription_row;

      for set_json, set_number in
        select value, ordinality::integer
        from jsonb_array_elements(coalesce(prescription_json->'sets', '[]'::jsonb)) with ordinality
      loop
        insert into public.prescription_sets (
          prescription_id,
          set_number,
          reps,
          reps_min,
          reps_max,
          load_type,
          load_value,
          effort_type,
          effort_value,
          distance_meters,
          pace_seconds_per_km,
          duration_seconds
        )
        values (
          prescription_row.id,
          set_number,
          case when jsonb_typeof(set_json->'reps') = 'number' then (set_json->>'reps')::integer end,
          nullif(set_json->>'reps_min', '')::integer,
          nullif(set_json->>'reps_max', '')::integer,
          set_json->>'load_type',
          nullif(set_json->>'load_value', '')::numeric,
          set_json->>'effort_type',
          nullif(set_json->>'effort_value', '')::numeric,
          nullif(set_json->>'distance_meters', '')::numeric,
          nullif(set_json->>'pace_seconds_per_km', '')::integer,
          nullif(set_json->>'duration_seconds', '')::integer
        );
      end loop;
    end loop;
  end loop;
end;
$$;

comment on function public.insert_template_blocks(uuid, jsonb) is
  'Insere blocos, exercícios, prescrições e séries de um template a partir do payload jsonb do editor.';

-- Reescreve create_session_template_with_content para consumir o helper, sem duplicar a inserção.
create or replace function public.create_session_template_with_content(
  p_title text,
  p_blocks jsonb,
  p_status public.session_status default 'draft'
)
returns public.session_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if char_length(btrim(p_title)) < 2 then
    raise exception using message = 'O título da sessão é obrigatório.';
  end if;

  insert into public.session_templates (title, status, created_by)
  values (btrim(p_title), p_status, auth.uid())
  returning * into template_row;

  perform public.insert_template_blocks(template_row.id, p_blocks);

  return template_row;
end;
$$;

create or replace function public.get_session_template_content(p_template_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  status_value public.session_status;
begin
  if not public.owns_session_template(p_template_id) then
    raise exception using message = 'Template de sessão não encontrado ou não autorizado.';
  end if;

  select status into status_value
  from public.session_templates
  where id = p_template_id;

  return public.build_template_snapshot(p_template_id) || jsonb_build_object('status', status_value);
end;
$$;

comment on function public.get_session_template_content(uuid) is
  'Carrega título, status e blocos de um template da biblioteca, para edição ou duplicação.';

create or replace function public.update_session_template_content(
  p_template_id uuid,
  p_title text,
  p_blocks jsonb,
  p_status public.session_status default null
)
returns public.session_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.session_templates%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if not public.owns_session_template(p_template_id) then
    raise exception using message = 'Template de sessão não encontrado ou não autorizado.';
  end if;

  if char_length(btrim(p_title)) < 2 then
    raise exception using message = 'O título da sessão é obrigatório.';
  end if;

  -- Apaga o conteúdo anterior do próprio template (cascade cuida de itens/prescrições/séries)
  -- e recria a partir do payload novo, mantendo o mesmo template_id.
  delete from public.session_blocks where template_id = p_template_id;

  update public.session_templates
  set title = btrim(p_title),
      status = coalesce(p_status, status)
  where id = p_template_id
  returning * into template_row;

  perform public.insert_template_blocks(template_row.id, p_blocks);

  return template_row;
end;
$$;

comment on function public.update_session_template_content(uuid, text, jsonb, public.session_status) is
  'Reescreve o conteúdo de um template da biblioteca no próprio template_id; sessões já aplicadas mantêm o snapshot congelado.';

revoke all on function public.insert_template_blocks(uuid, jsonb) from public;
revoke all on function public.get_session_template_content(uuid) from public;
revoke all on function public.update_session_template_content(uuid, text, jsonb, public.session_status) from public;

grant execute on function public.insert_template_blocks(uuid, jsonb) to authenticated;
grant execute on function public.get_session_template_content(uuid) to authenticated;
grant execute on function public.update_session_template_content(uuid, text, jsonb, public.session_status) to authenticated;
