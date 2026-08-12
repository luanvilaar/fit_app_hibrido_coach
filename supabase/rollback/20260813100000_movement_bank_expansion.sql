-- Desfaz a expansão do catálogo vinda de BANCO DE MOVIMENTOS (1).xlsx.
--
-- Movimentos novos só são removidos se nenhum treino os estiver usando — mesma proteção de
-- 20260806140000_exercise_video_catalog: apagar um exercício referenciado deixaria blocos órfãos.

delete from public.exercises
where created_by is null
  and slug in (
    'back-rack-bulgarian-split-squat',
    'dumbbell-side-plank-rotations'
  )
  and not exists (
    select 1
    from public.block_items item_row
    where item_row.exercise_id = public.exercises.id
  );

-- Devolve o nome anterior do movimento renomeado (o slug nunca mudou).
update public.exercises
set
  name = 'Snatch Panda Pull',
  updated_at = now()
where slug = 'snatch-panda-pull';

notify pgrst, 'reload schema';
