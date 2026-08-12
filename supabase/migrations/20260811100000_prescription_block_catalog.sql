-- Prescrição híbrida: separar o bloco de condicionamento geral do Metcon e
-- permitir condicionamento ginástico como uma categoria própria.

alter table public.session_blocks
  drop constraint if exists session_blocks_kind_check;

alter table public.session_blocks
  add constraint session_blocks_kind_check
  check (
    kind in (
      'strength',
      'conditioning',
      'metcon',
      'lpo',
      'endurance',
      'gymnastics-skill',
      'gymnastics-conditioning',
      'warm-up',
      'cooldown',
      'custom'
    )
  );

create or replace function public.block_kind_allows_empty_items(p_kind text)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'conditioning',
    'metcon',
    'lpo',
    'endurance',
    'gymnastics-conditioning'
  );
$$;

comment on function public.block_kind_allows_empty_items(text) is
  'Categorias cujo conteúdo pode começar em texto livre, com movimento do catálogo opcional.';

notify pgrst, 'reload schema';
