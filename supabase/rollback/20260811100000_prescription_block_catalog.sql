alter table public.session_blocks
  drop constraint if exists session_blocks_kind_check;

alter table public.session_blocks
  add constraint session_blocks_kind_check
  check (
    kind in (
      'strength',
      'conditioning',
      'lpo',
      'endurance',
      'gymnastics-skill',
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
  select p_kind in ('conditioning', 'lpo', 'endurance');
$$;

notify pgrst, 'reload schema';
