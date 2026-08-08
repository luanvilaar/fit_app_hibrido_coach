-- Reverte as categorias por modalidade e session_blocks.details.
--
-- ATENÇÃO: blocos já gravados com as categorias novas ('strength' continua válido, mas
-- 'lpo', 'endurance' e 'gymnastics-skill' não) violariam o constraint antigo. O rollback
-- remapeia esses blocos para 'custom' antes de restaurar o constraint, e o conteúdo de
-- texto livre guardado em details é perdido.

update public.session_blocks
set kind = 'custom'
where kind in ('lpo', 'endurance', 'gymnastics-skill');

alter table public.session_blocks
  drop constraint if exists session_blocks_details_object_check;

alter table public.session_blocks
  drop column if exists details;

alter table public.session_blocks
  drop constraint if exists session_blocks_kind_check;

alter table public.session_blocks
  add constraint session_blocks_kind_check
  check (kind in ('warm-up', 'strength', 'conditioning', 'cooldown', 'custom'));

drop function if exists public.block_kind_allows_empty_items(text);

-- Restaura insert_template_blocks sem details e voltando a exigir exercício em todo bloco.
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

-- Restaura build_template_snapshot sem details.
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
                    'exercise_slug', exercise_row.slug,
                    'exercise_video_url', exercise_row.video_url,
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
