-- Volta o check-in diário para três perguntas (sono, energia, dor muscular).
-- Atenção: apaga as quatro respostas novas e a dor localizada. As três originais voltam
-- intactas, porque a inversão de escala é reversível (6 - (6 - x) = x).

drop function if exists public.upsert_athlete_checkin(
  smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  text, smallint, text, date
);

-- A coluna gerada depende das sete respostas: sai antes de qualquer drop de coluna.
alter table public.athlete_daily_checkins drop column if exists readiness;

-- "Recuperação muscular" volta a ser "dor muscular", desinvertendo a escala.
-- Guardado por pg_attribute para não desfazer a conversão numa reexecução.
do $$
begin
  if exists (
    select 1
    from pg_attribute
    where attrelid = 'public.athlete_daily_checkins'::regclass
      and attname = 'muscle_recovery_score'
      and not attisdropped
  ) then
    alter table public.athlete_daily_checkins
      rename column muscle_recovery_score to soreness_score;

    update public.athlete_daily_checkins
      set soreness_score = 6 - soreness_score;
  end if;
end;
$$;

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_muscle_recovery_score_check;
alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_soreness_score_check;
alter table public.athlete_daily_checkins
  add constraint athlete_daily_checkins_soreness_score_check
  check (soreness_score between 1 and 5);

alter table public.athlete_daily_checkins
  drop constraint if exists athlete_daily_checkins_pain_pair_check,
  drop constraint if exists athlete_daily_checkins_pain_region_check,
  drop constraint if exists athlete_daily_checkins_pain_intensity_check,
  drop constraint if exists athlete_daily_checkins_stress_score_check,
  drop constraint if exists athlete_daily_checkins_mood_score_check,
  drop constraint if exists athlete_daily_checkins_motivation_score_check,
  drop constraint if exists athlete_daily_checkins_overall_readiness_score_check,
  drop column if exists pain_region,
  drop column if exists pain_intensity,
  drop column if exists stress_score,
  drop column if exists mood_score,
  drop column if exists motivation_score,
  drop column if exists overall_readiness_score;

alter table public.athlete_daily_checkins
  add column if not exists readiness numeric(3, 2) generated always as (
    round((sleep_score + energy_score + (6 - soreness_score))::numeric / 3, 2)
  ) stored;

comment on table public.athlete_daily_checkins is
  'Check-in diário do atleta com sono, energia e dor muscular.';
comment on column public.athlete_daily_checkins.soreness_score is
  'Dor muscular de 1 (nenhuma) a 5 (muita); entra invertida no cálculo de prontidão.';
comment on column public.athlete_daily_checkins.readiness is
  'Prontidão de 1 a 5 derivada de sono, energia e dor muscular.';

create or replace function public.upsert_athlete_checkin(
  p_sleep_score smallint,
  p_energy_score smallint,
  p_soreness_score smallint,
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
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  if p_sleep_score is null or p_energy_score is null or p_soreness_score is null then
    raise exception using message = 'Informe sono, energia e dor muscular.';
  end if;

  insert into public.athlete_daily_checkins (
    athlete_id,
    checkin_date,
    sleep_score,
    energy_score,
    soreness_score,
    note
  )
  values (
    auth.uid(),
    coalesce(p_checkin_date, current_date),
    p_sleep_score,
    p_energy_score,
    p_soreness_score,
    coalesce(btrim(p_note), '')
  )
  on conflict (athlete_id, checkin_date) do update
    set sleep_score = excluded.sleep_score,
        energy_score = excluded.energy_score,
        soreness_score = excluded.soreness_score,
        note = excluded.note
  returning * into checkin_row;

  return checkin_row;
end;
$$;

revoke all on function public.upsert_athlete_checkin(smallint, smallint, smallint, text, date) from public;
grant execute on function public.upsert_athlete_checkin(smallint, smallint, smallint, text, date) to authenticated;
