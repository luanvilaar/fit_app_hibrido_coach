-- Categorias de movimento no catálogo (biblioteca de movimentos): cada categoria decide o
-- formato de prescrição do exercício quando ele entra num bloco baseado em exercícios
-- (Força ou Skill ginástico) — reps + carga para as duas categorias de Força, texto livre
-- (prescriptions.kind = 'qualitative' + notes) para Ginástica.
--
-- Origem: BANCO DE MOVIMENTOS.xlsx (coluna CATEGORIA DE MOVIMENTO), mesma planilha que originou
-- o seed de 20260806140000_exercise_video_catalog.
--
-- category fica nullable de propósito: linhas antigas/criadas fora do app não têm categoria
-- definida, e a ausência de categoria cai no comportamento padrão (reps + carga), o mesmo que
-- todo exercício já tinha antes desta migration. Só 'ginastica' explícito muda o comportamento.

create type public.exercise_category as enum ('forca-acessorios', 'forca-lpo', 'ginastica');

alter table public.exercises
  add column if not exists category public.exercise_category;

comment on column public.exercises.category is
  'Categoria do movimento no catálogo: decide se o exercício usa reps+carga (Força) ou texto '
  'livre (Ginástica) no editor do coach. Null (legado) se comporta como Força.';

update public.exercises set category = 'forca-acessorios'
where slug in (
  'hand-supported-single-leg-dumbbell-rdl',
  'romanian-deadlift',
  'single-leg-dumbbell-romanian-deadlift',
  'half-kneeling-single-arm-arnold-press',
  'single-arm-standing-dumbbell-lateral-raise',
  'kettlebell-horn-curls',
  'zottman-curls'
);

update public.exercises set category = 'forca-lpo'
where slug in (
  'power-snatch',
  'snatch-panda-pull'
);

update public.exercises set category = 'ginastica'
where slug in (
  'ctb-pull-ups',
  'kipping-skin-the-cat',
  'kipping-skin-the-cat-with-a-pull',
  'strict-knee-to-elbow',
  'tucked-ring-shoulder-stand'
);

-- insert_template_blocks passa a gravar a categoria ao criar um exercício novo inline (o coach
-- digitou um nome que ainda não existe no catálogo); exercício já existente mantém sua
-- categoria atual mesmo que o payload mande outra — recategorizar o catálogo não é escopo de
-- salvar uma sessão. Junto, prescrição vira opcional: categorias qualitativas (Ginástica) não
-- têm séries, só notes; a validação de "pelo menos uma série" só se aplica a sets-reps.
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

      -- Qualitativa (Ginástica) não tem séries: o conteúdo é só o texto em notes.
      if prescription_kind = 'qualitative' then
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
  'details; itens de prescrição qualitativa (movimento Ginástica) são gravados sem séries.';

revoke all on function public.insert_template_blocks(uuid, jsonb) from public;
grant execute on function public.insert_template_blocks(uuid, jsonb) to authenticated;

-- Força o PostgREST a recarregar o schema cache (mesma necessidade documentada em
-- 20260807120000_block_categories_and_details).
notify pgrst, 'reload schema';
