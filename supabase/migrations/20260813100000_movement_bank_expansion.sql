-- Expansão do catálogo oficial de movimentos (biblioteca do editor do coach).
-- Origem: BANCO DE MOVIMENTOS (1).xlsx — colunas MOVIMENTO, LINK VIDEO e CATEGORIA DE MOVIMENTO,
-- mesma planilha que originou 20260806140000_exercise_video_catalog e as categorias de
-- 20260808160000_exercise_movement_categories.
--
-- Das 17 linhas da planilha, 14 já estavam no catálogo com a mesma categoria; esta migration
-- cobre as três diferenças:
--   1. Back Rack Bulgarian Split Squat  (novo, Força / Acessórios)
--   2. Dumbbell Side Plank Rotations    (novo, Força / Acessórios)
--   3. Panda Snatch High Pull           (renomeia 'snatch-panda-pull' — ver abaixo)
--
-- Slugs seguem a normalização de data/coach-hibrido/text.ts (sem acento, minúsculo, hífen), a
-- mesma que o app usa ao criar exercício inline; divergir aqui criaria movimento duplicado no
-- primeiro `@` que um coach digitasse com o mesmo nome.
--
-- O link de Back Rack Bulgarian Split Squat vem da planilha sem o parâmetro `?list=TLPQ...`:
-- aquilo é uma playlist efêmera da sessão de quem copiou o link, não parte do vídeo.

insert into public.exercises (slug, name, video_url, category, created_by)
values
  (
    'back-rack-bulgarian-split-squat',
    'Back Rack Bulgarian Split Squat',
    'https://youtu.be/fS2A_NhN8hQ',
    'forca-acessorios',
    null
  ),
  (
    'dumbbell-side-plank-rotations',
    'Dumbbell Side Plank Rotations',
    'https://youtu.be/Ec9Ymqhe5i4',
    'forca-acessorios',
    null
  )
on conflict (slug) do update set
  name = excluded.name,
  video_url = excluded.video_url,
  category = excluded.category,
  updated_at = now();

-- 'Panda Snatch High Pull' e 'Snatch Panda Pull' são o mesmo movimento: a planilha traz os dois
-- nomes apontando para o mesmo vídeo (U2dOJBSXJfc). Renomear em vez de inserir mantém uma única
-- entrada na busca por `@` e preserva o vínculo dos treinos já prescritos com 'snatch-panda-pull'
-- (block_items referencia exercises.id, e o slug é o que o payload do editor procura).
update public.exercises
set
  name = 'Panda Snatch High Pull',
  video_url = 'https://youtu.be/U2dOJBSXJfc',
  category = 'forca-lpo',
  updated_at = now()
where slug = 'snatch-panda-pull';

-- Força o PostgREST a recarregar o schema cache (mesma necessidade documentada em
-- 20260807120000_block_categories_and_details).
notify pgrst, 'reload schema';
