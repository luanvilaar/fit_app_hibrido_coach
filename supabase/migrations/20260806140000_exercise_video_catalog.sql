-- Catálogo oficial de movimentos com link de vídeo.
-- Origem: bancomove.xlsx (colunas MOVIMENTO e LINK VIDEO).
-- Convenção: exercício com created_by null é catálogo oficial; com created_by preenchido é criação de coach.

alter table public.exercises
  add column if not exists video_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercises_video_url_check'
      and conrelid = 'public.exercises'::regclass
  ) then
    alter table public.exercises
      add constraint exercises_video_url_check
      check (video_url is null or video_url ~ '^https://');
  end if;
end;
$$;

comment on column public.exercises.video_url is
  'URL https de demonstração do movimento; null quando não há vídeo cadastrado.';

comment on column public.exercises.created_by is
  'Coach que criou o exercício; null identifica movimento do catálogo oficial FitBlock.';

-- Slugs seguem a mesma normalização do app (data/coach-calendar.ts): sem acento, minúsculo, hífen.
insert into public.exercises (slug, name, video_url, created_by)
values
  ('ctb-pull-ups', 'CTB Pull Ups', 'https://youtu.be/8Rp-OeeJP-Y', null),
  ('hand-supported-single-leg-dumbbell-rdl', 'Hand Supported Single Leg Dumbbell RDL', 'https://youtu.be/Ylj7UU-1-ag', null),
  ('kipping-skin-the-cat', 'Kipping skin the cat', 'https://youtube.com/shorts/E3WgekDPSWY', null),
  ('kipping-skin-the-cat-with-a-pull', 'Kipping skin the cat with a pull', 'https://youtube.com/shorts/KGb_hoKvoz8', null),
  ('power-snatch', 'Power Snatch', 'https://youtu.be/6bQ-a16HS3c', null),
  ('romanian-deadlift', 'Romanian Deadlift', 'https://youtu.be/2G6m2hWvMWM', null),
  ('single-leg-dumbbell-romanian-deadlift', 'Single Leg Dumbbell Romanian Deadlift', 'https://youtu.be/IlOrGu1qzWs', null),
  ('snatch-panda-pull', 'Snatch Panda Pull', 'https://youtu.be/U2dOJBSXJfc', null),
  ('strict-knee-to-elbow', 'Strict Knee to Elbow', 'https://youtu.be/HPZikDifU6o', null),
  ('tucked-ring-shoulder-stand', 'Tucked Ring Shoulder Stand', 'https://youtu.be/QollAGaPr0Q', null),
  ('half-kneeling-single-arm-arnold-press', 'Half Kneeling Single Arm Arnold Press', 'https://youtu.be/kX1oAGdEZfM', null),
  ('single-arm-standing-dumbbell-lateral-raise', 'Single Arm Standing Dumbbell Lateral Raise', 'https://youtu.be/RYCFn3TkeIs', null),
  ('kettlebell-horn-curls', 'Kettlebell Horn Curls', 'https://youtu.be/YzTfq9VaQKs', null),
  ('zottman-curls', 'Zottman Curls', 'https://youtu.be/Kh7oukUJWEM', null)
on conflict (slug) do update set
  name = excluded.name,
  video_url = excluded.video_url,
  updated_at = now();
