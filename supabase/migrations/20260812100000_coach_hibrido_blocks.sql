-- Coach Híbrido: todo bloco passa a ser uma folha de texto livre.
--
-- Duas consequências no banco:
-- 1. Aquecimento e Mobilidade & Recovery deixam de ser categorias legadas e viram
--    categorias oferecidas no compositor, ao lado das sete existentes.
-- 2. `items[]` deixa de ser obrigatório em qualquer categoria: ele agora carrega só os
--    movimentos que o coach mencionou com `@` no texto, para dar nome e vídeo ao atleta.
--    Um bloco sem nenhuma menção é legítimo e continua tendo conteúdo — o texto.

create or replace function public.block_kind_allows_empty_items(p_kind text)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'warm-up',
    'strength',
    'lpo',
    'conditioning',
    'metcon',
    'endurance',
    'gymnastics-skill',
    'gymnastics-conditioning',
    'cooldown',
    'custom'
  );
$$;

comment on function public.block_kind_allows_empty_items(text) is
  'Coach Híbrido: o conteúdo do bloco é o texto em details.body, então nenhuma categoria exige items[].';

notify pgrst, 'reload schema';
