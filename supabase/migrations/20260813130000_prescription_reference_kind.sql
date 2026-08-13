-- Corrige violação de prescriptions_kind_check ao salvar sessões do Coach Híbrido.
--
-- O compositor de texto livre grava, para cada movimento mencionado no corpo do bloco, um item
-- com prescription.kind = 'reference' (apenas linka nome/vídeo do exercício — não é uma
-- prescrição estruturada). A constraint nunca previu esse valor, e insert_template_blocks
-- também nunca soube que 'reference' não tem séries — só tratava 'qualitative' assim.

alter table public.prescriptions
  drop constraint if exists prescriptions_kind_check;

alter table public.prescriptions
  add constraint prescriptions_kind_check
  check (
    kind in (
      'sets-reps',
      'timed',
      'amrap',
      'emom',
      'for-time',
      'intervals',
      'qualitative',
      'reference'
    )
  );

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
  block_details jsonb;
  exercise_id uuid;
  exercise_category public.exercise_category;
  prescription_kind text;
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
    block_details := block_json->'details';

    if block_details is null or jsonb_typeof(block_details) <> 'object' then
      block_details := '{}'::jsonb;
    end if;

    insert into public.session_blocks (template_id, name, kind, position, details)
    values (
      p_template_id,
      btrim(block_json->>'name'),
      block_json->>'kind',
      block_position,
      block_details
    )
    returning * into block_row;

    if jsonb_typeof(block_json->'items') <> 'array'
      or jsonb_array_length(block_json->'items') = 0 then
      if public.block_kind_allows_empty_items(block_row.kind) then
        continue;
      end if;

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
        exercise_category := nullif(item_json->>'exercise_category', '')::public.exercise_category;

        insert into public.exercises (slug, name, category, created_by)
        values (exercise_slug, exercise_name, exercise_category, auth.uid())
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

      prescription_kind := prescription_json->>'kind';

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
        prescription_kind,
        nullif(prescription_json->>'rest_seconds', '')::integer,
        nullif(prescription_json->>'duration_seconds', '')::integer,
        nullif(prescription_json->>'minutes', '')::numeric,
        prescription_json->>'notes'
      )
      returning * into prescription_row;

      -- Qualitativa (Ginástica) e referência (movimento citado no texto livre) não têm séries.
      if prescription_kind in ('qualitative', 'reference') then
        continue;
      end if;

      if jsonb_typeof(coalesce(prescription_json->'sets', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(prescription_json->'sets', '[]'::jsonb)) = 0 then
        raise exception using message = 'Cada exercício precisa de pelo menos uma série.';
      end if;

      for set_json, set_number in
        select value, ordinality::integer
        from jsonb_array_elements(prescription_json->'sets') with ordinality
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
  'Insere blocos, exercícios, prescrições e séries de um template a partir do payload jsonb do '
  'editor. Blocos de categoria de texto livre são gravados sem exercícios, com o conteúdo em '
  'details; itens de prescrição qualitativa (Ginástica) ou de referência (menção no texto livre) '
  'são gravados sem séries.';

revoke all on function public.insert_template_blocks(uuid, jsonb) from public;
grant execute on function public.insert_template_blocks(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
