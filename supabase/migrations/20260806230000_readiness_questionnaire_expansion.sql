-- Expande o check-in diário de três para sete perguntas, todas na mesma direção (5 = melhor),
-- e acrescenta dor localizada opcional (região + intensidade 0-10).
-- O que era "dor muscular" (escala invertida) vira "recuperação muscular" com os valores convertidos.

-- 1. A assinatura da RPC muda de 5 para 11 parâmetros. `create or replace` não troca a lista
-- de parâmetros: sem o drop explícito nasceria uma sobrecarga e o PostgREST ficaria ambíguo.
drop function if exists public.upsert_athlete_checkin(smallint, smallint, smallint, text, date);

-- 2. A prontidão passa a sair de sete respostas. A expressão de uma coluna gerada não pode ser
-- alterada no lugar, então a coluna sai aqui e volta no passo 9; sair antes também libera a
-- dependência sobre as colunas-fonte, que são renomeadas logo abaixo.
alter table public.athlete_daily_checkins drop column if exists readiness;

-- 3. "Dor muscular" vira "recuperação muscular" e a escala inverte junto.
-- O bloco só roda enquanto a coluna antiga existir: garante que a conversão aconteça
-- exatamente uma vez, mesmo se a migration for reaplicada.
do $$
begin
  if exists (
    select 1
    from pg_attribute
    where attrelid = 'public.athlete_daily_checkins'::regclass
      and attname = 'soreness_score'
      and not attisdropped
  ) then
    alter table public.athlete_daily_checkins
      rename column soreness_score to muscle_recovery_score;

    -- 1 = nenhuma dor  ->  5 = totalmente recuperado
    -- 5 = muita dor    ->  1 = nada recuperado
    update public.athlete_daily_checkins
      set muscle_recovery_score = 6 - muscle_recovery_score;
  end if;
end;
$$;

-- 4. A check constraint acompanha o rename da coluna, mas mantém o nome antigo.
alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_soreness_score_check;
alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_muscle_recovery_score_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_muscle_recovery_score_check
  check (muscle_recovery_score between 1 and 5);

-- 5. As quatro perguntas novas entram nullable para o backfill do passo 6 poder rodar.
alter table public.athlete_daily_checkins
  add column if not exists stress_score smallint,
  add column if not exists mood_score smallint,
  add column if not exists motivation_score smallint,
  add column if not exists overall_readiness_score smallint;

-- 6. Linhas anteriores a esta migration só têm três das sete respostas. As quatro que faltam
-- recebem a média arredondada das três que o atleta de fato respondeu naquele dia: mantém a
-- posição relativa do histórico em vez de achatar todo mundo num "3 neutro".
-- Idempotente pelo filtro `is null`.
update public.athlete_daily_checkins as checkin_row
set stress_score = coalesce(checkin_row.stress_score, legacy.fallback_score),
    mood_score = coalesce(checkin_row.mood_score, legacy.fallback_score),
    motivation_score = coalesce(checkin_row.motivation_score, legacy.fallback_score),
    overall_readiness_score =
      coalesce(checkin_row.overall_readiness_score, legacy.fallback_score)
from (
  select
    id,
    round(
      (sleep_score + energy_score + muscle_recovery_score)::numeric / 3
    )::smallint as fallback_score
  from public.athlete_daily_checkins
) as legacy
where legacy.id = checkin_row.id
  and (
    checkin_row.stress_score is null
    or checkin_row.mood_score is null
    or checkin_row.motivation_score is null
    or checkin_row.overall_readiness_score is null
  );

-- 7. Só depois do backfill as quatro passam a ser obrigatórias.
alter table public.athlete_daily_checkins
  alter column stress_score set not null,
  alter column mood_score set not null,
  alter column motivation_score set not null,
  alter column overall_readiness_score set not null;

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_stress_score_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_stress_score_check
  check (stress_score between 1 and 5);

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_mood_score_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_mood_score_check
  check (mood_score between 1 and 5);

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_motivation_score_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_motivation_score_check
  check (motivation_score between 1 and 5);

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_overall_readiness_score_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_overall_readiness_score_check
  check (overall_readiness_score between 1 and 5);

-- 8. Dor localizada é opcional e vem em par: região sem intensidade não diz nada.
-- A lista de regiões fica em check constraint, não em enum, porque o Postgres não tem
-- `alter type ... drop value` — evoluir a lista precisa ser possível numa migration comum.
alter table public.athlete_daily_checkins
  add column if not exists pain_region text,
  add column if not exists pain_intensity smallint;

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_pain_region_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_pain_region_check
  check (
    pain_region is null
    or pain_region in (
      'pescoco', 'ombro', 'cotovelo', 'punho_mao', 'costas', 'lombar',
      'quadril', 'coxa', 'joelho', 'panturrilha', 'tornozelo_pe', 'outro'
    )
  );

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_pain_intensity_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_pain_intensity_check
  check (pain_intensity is null or pain_intensity between 0 and 10);

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_pain_pair_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_pain_pair_check
  check ((pain_region is null) = (pain_intensity is null));

-- 9. Prontidão = média simples das sete respostas, todas na mesma direção (5 = melhor).
alter table public.athlete_daily_checkins
  add column if not exists readiness numeric(3, 2) generated always as (
    round(
      (
        sleep_score
        + energy_score
        + muscle_recovery_score
        + stress_score
        + mood_score
        + motivation_score
        + overall_readiness_score
      )::numeric / 7,
      2
    )
  ) stored;

-- 10. Comentários. A colisão entre `readiness` (média derivada) e `overall_readiness_score`
-- (uma das sete perguntas) é o principal risco de leitura desta tabela.
comment on table public.athlete_daily_checkins is
  'Check-in diário do atleta: sete respostas de 1 a 5 (5 = melhor em todas) mais dor localizada opcional.';
comment on column public.athlete_daily_checkins.muscle_recovery_score is
  'Recuperação muscular de 1 (nada recuperado / muita dor) a 5 (totalmente recuperado).';
comment on column public.athlete_daily_checkins.stress_score is
  'Nível de estresse já invertido para a direção única: 1 = muito estressado, 5 = tranquilo.';
comment on column public.athlete_daily_checkins.overall_readiness_score is
  'Resposta subjetiva "prontidão geral", uma das sete perguntas. Não confundir com a coluna readiness.';
comment on column public.athlete_daily_checkins.readiness is
  'Média das sete respostas, derivada no banco. Não confundir com overall_readiness_score.';
comment on column public.athlete_daily_checkins.pain_region is
  'Região do corpo com dor, opcional. Lista fechada espelhada em apps/universal/data/today.ts.';
comment on column public.athlete_daily_checkins.pain_intensity is
  'Intensidade da dor de 0 a 10, obrigatória sempre que houver região.';

-- 11. Grava as sete respostas do dia; a dor localizada é opcional e vem em par.
create or replace function public.upsert_athlete_checkin(
  p_sleep_score smallint,
  p_energy_score smallint,
  p_muscle_recovery_score smallint,
  p_stress_score smallint,
  p_mood_score smallint,
  p_motivation_score smallint,
  p_overall_readiness_score smallint,
  p_pain_region text default null,
  p_pain_intensity smallint default null,
  p_note text default '',
  p_checkin_date date default current_date
)
returns public.athlete_daily_checkins
language plpgsql
security invoker
set search_path = public
as $$
declare
  checkin_row public.athlete_daily_checkins%rowtype;
  answers smallint[] := array[
    p_sleep_score,
    p_energy_score,
    p_muscle_recovery_score,
    p_stress_score,
    p_mood_score,
    p_motivation_score,
    p_overall_readiness_score
  ];
  normalized_region text := nullif(btrim(coalesce(p_pain_region, '')), '');
  normalized_intensity smallint := p_pain_intensity;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  -- array_position compara com IS NOT DISTINCT FROM, então localiza NULL.
  if array_position(answers, null) is not null then
    raise exception using message = 'Responda as sete perguntas do check-in.';
  end if;

  if exists (select 1 from unnest(answers) as answer where answer not between 1 and 5) then
    raise exception using message = 'As respostas do check-in vão de 1 a 5.';
  end if;

  -- Sem região não existe intensidade; com região a intensidade é obrigatória.
  if normalized_region is null then
    normalized_intensity := null;
  elsif normalized_intensity is null or normalized_intensity not between 0 and 10 then
    raise exception using message = 'Informe a intensidade da dor de 0 a 10.';
  end if;

  insert into public.athlete_daily_checkins (
    athlete_id,
    checkin_date,
    sleep_score,
    energy_score,
    muscle_recovery_score,
    stress_score,
    mood_score,
    motivation_score,
    overall_readiness_score,
    pain_region,
    pain_intensity,
    note
  )
  values (
    auth.uid(),
    coalesce(p_checkin_date, current_date),
    p_sleep_score,
    p_energy_score,
    p_muscle_recovery_score,
    p_stress_score,
    p_mood_score,
    p_motivation_score,
    p_overall_readiness_score,
    normalized_region,
    normalized_intensity,
    coalesce(btrim(p_note), '')
  )
  on conflict (athlete_id, checkin_date) do update
    set sleep_score = excluded.sleep_score,
        energy_score = excluded.energy_score,
        muscle_recovery_score = excluded.muscle_recovery_score,
        stress_score = excluded.stress_score,
        mood_score = excluded.mood_score,
        motivation_score = excluded.motivation_score,
        overall_readiness_score = excluded.overall_readiness_score,
        pain_region = excluded.pain_region,
        pain_intensity = excluded.pain_intensity,
        note = excluded.note
  returning * into checkin_row;

  return checkin_row;
end;
$$;

comment on function public.upsert_athlete_checkin(
  smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  text, smallint, text, date
) is
  'Grava o check-in diário do atleta: sete respostas de 1 a 5 e dor localizada opcional.';

-- 12. Permissões da assinatura nova.
revoke all on function public.upsert_athlete_checkin(
  smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  text, smallint, text, date
) from public;

grant execute on function public.upsert_athlete_checkin(
  smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  text, smallint, text, date
) to authenticated;
