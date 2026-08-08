-- Remove os movimentos do catálogo oficial que não estejam em uso por nenhum treino
-- e desfaz a coluna de vídeo.

delete from public.exercises
where created_by is null
  and slug in (
    'ctb-pull-ups',
    'hand-supported-single-leg-dumbbell-rdl',
    'kipping-skin-the-cat',
    'kipping-skin-the-cat-with-a-pull',
    'power-snatch',
    'romanian-deadlift',
    'single-leg-dumbbell-romanian-deadlift',
    'snatch-panda-pull',
    'strict-knee-to-elbow',
    'tucked-ring-shoulder-stand',
    'half-kneeling-single-arm-arnold-press',
    'single-arm-standing-dumbbell-lateral-raise',
    'kettlebell-horn-curls',
    'zottman-curls'
  )
  and not exists (
    select 1
    from public.block_items item_row
    where item_row.exercise_id = public.exercises.id
  );

alter table public.exercises
  drop constraint if exists exercises_video_url_check;

alter table public.exercises
  drop column if exists video_url;
