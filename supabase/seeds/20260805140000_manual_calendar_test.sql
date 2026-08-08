-- Seed idempotente para teste manual do calendário e da prescrição.
-- Executar somente depois das migrations 20260805120000, 20260805140000 e 20260805150000.
begin;

do $$
declare
  v_coach_id uuid;
  v_athlete_id uuid;
  v_exercise_id uuid;
  v_team_id constant uuid := '10000000-0000-0000-0000-000000000001';
  v_template_id constant uuid := '10000000-0000-0000-0000-000000000002';
  v_block_id constant uuid := '10000000-0000-0000-0000-000000000003';
  v_item_id constant uuid := '10000000-0000-0000-0000-000000000004';
  v_prescription_id constant uuid := '10000000-0000-0000-0000-000000000005';
  v_set_id constant uuid := '10000000-0000-0000-0000-000000000006';
  v_instance_id constant uuid := '10000000-0000-0000-0000-000000000007';
begin
  select id into v_coach_id
  from auth.users
  where email = 'fitblock.coach.20260805@fitblock.app';

  select id into v_athlete_id
  from auth.users
  where email = 'fitblock.manual.20260805@fitblock.app';

  if v_coach_id is null or v_athlete_id is null then
    raise exception using message = 'As contas manual de coach e atleta precisam existir antes do seed.';
  end if;

  insert into public.teams (id, name, description, level, objective, created_by)
  values (
    v_team_id,
    'FitBlock Manual Test',
    'Equipe criada para validar calendário e prescrição no ambiente de teste.',
    'intermediário',
    'Validar a leitura de sessões prescritas pelo atleta.',
    v_coach_id
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    level = excluded.level,
    objective = excluded.objective,
    created_by = excluded.created_by,
    updated_at = now();

  insert into public.team_members (team_id, user_id, role)
  values
    (v_team_id, v_coach_id, 'coach'),
    (v_team_id, v_athlete_id, 'athlete')
  on conflict (team_id, user_id) do update set
    role = excluded.role,
    updated_at = now();

  insert into public.exercises (slug, name, created_by)
  values ('back-squat', 'Back Squat', v_coach_id)
  on conflict (slug) do update set
    name = excluded.name,
    updated_at = now()
  returning id into v_exercise_id;

  insert into public.session_templates (id, title, status, created_by)
  values (v_template_id, 'Lower Strength · Manual Test', 'published', v_coach_id)
  on conflict (id) do update set
    title = excluded.title,
    status = excluded.status,
    created_by = excluded.created_by,
    updated_at = now();

  insert into public.session_blocks (id, template_id, name, kind, position)
  values (v_block_id, v_template_id, 'Força principal', 'strength', 0)
  on conflict (id) do update set
    name = excluded.name,
    kind = excluded.kind,
    position = excluded.position,
    updated_at = now();

  insert into public.block_items (id, block_id, exercise_id, position)
  values (v_item_id, v_block_id, v_exercise_id, 0)
  on conflict (id) do update set
    exercise_id = excluded.exercise_id,
    position = excluded.position,
    updated_at = now();

  insert into public.prescriptions (id, block_item_id, kind, rest_seconds, notes)
  values (
    v_prescription_id,
    v_item_id,
    'sets-reps',
    150,
    'Controle a descida e mantenha duas repetições em reserva.'
  )
  on conflict (id) do update set
    kind = excluded.kind,
    rest_seconds = excluded.rest_seconds,
    notes = excluded.notes,
    updated_at = now();

  insert into public.prescription_sets (
    id, prescription_id, set_number, reps_min, reps_max, load_type, load_value
  )
  values (v_set_id, v_prescription_id, 1, 3, 5, 'percentage-1rm', 75)
  on conflict (id) do update set
    set_number = excluded.set_number,
    reps_min = excluded.reps_min,
    reps_max = excluded.reps_max,
    load_type = excluded.load_type,
    load_value = excluded.load_value,
    updated_at = now();

  insert into public.session_instances (
    id, template_id, team_id, scheduled_date, status, state, snapshot, created_by
  )
  values (
    v_instance_id,
    v_template_id,
    v_team_id,
    '2026-08-10',
    'published',
    'available',
    jsonb_build_object(
      'template_id', v_template_id,
      'title', 'Lower Strength · Manual Test',
      'blocks', jsonb_build_array(
        jsonb_build_object(
          'id', v_block_id,
          'name', 'Força principal',
          'kind', 'strength',
          'position', 0,
          'items', jsonb_build_array(
            jsonb_build_object(
              'id', v_item_id,
              'exercise_id', v_exercise_id,
              'exercise_name', 'Back Squat',
              'position', 0,
              'prescription', jsonb_build_object(
                'id', v_prescription_id,
                'kind', 'sets-reps',
                'rest_seconds', 150,
                'notes', 'Controle a descida e mantenha duas repetições em reserva.',
                'sets', jsonb_build_array(
                  jsonb_build_object(
                    'id', v_set_id,
                    'set_number', 1,
                    'reps_min', 3,
                    'reps_max', 5,
                    'load_type', 'percentage-1rm',
                    'load_value', 75
                  )
                )
              )
            )
          )
        )
      )
    ),
    v_coach_id
  )
  on conflict (id) do update set
    scheduled_date = excluded.scheduled_date,
    status = excluded.status,
    state = excluded.state,
    snapshot = excluded.snapshot,
    created_by = excluded.created_by,
    updated_at = now();
end;
$$;

commit;
