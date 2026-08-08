-- Aba Progresso do atleta: consistência (sequência + histórico semanal), sessões concluídas
-- e recordes pessoais por exercício. Agrega dados já existentes de athlete_session_progress
-- e athlete_set_results; não cria tabelas novas.

create or replace function public.get_athlete_progress(p_weeks integer default 8)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  streak_days integer := 0;
  weeks_back integer := greatest(coalesce(p_weeks, 8), 1);
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  -- Sequência atual: mesma lógica de get_athlete_today, dias com sessão prescrita
  -- do mais recente para trás até o primeiro não concluído.
  with day_status as (
    select
      instance_row.scheduled_date as training_day,
      bool_or(progress.state in ('completed', 'partially_completed')) as is_done
    from public.session_instances instance_row
    left join public.athlete_session_progress progress
      on progress.session_id = instance_row.id
     and progress.athlete_id = auth.uid()
    where instance_row.status = 'published'
      and instance_row.scheduled_date <= current_date
      and public.is_team_member(instance_row.team_id)
    group by instance_row.scheduled_date
  ),
  ranked as (
    select
      is_done,
      row_number() over (order by training_day desc) as day_rank
    from day_status
    where not (training_day = current_date and not coalesce(is_done, false))
  )
  select coalesce(
    (select min(day_rank) - 1 from ranked where not coalesce(is_done, false)),
    (select count(*) from ranked)
  )::integer
  into streak_days;

  return jsonb_build_object(
    'streak_days', coalesce(streak_days, 0),

    -- Histórico semanal: planejado x concluído nas últimas p_weeks semanas, para o gráfico
    -- de consistência. Semanas sem sessão prescrita entram com planned=0.
    'weekly_history', (
      with weeks as (
        select generate_series(
          date_trunc('week', current_date)::date - ((weeks_back - 1) * 7),
          date_trunc('week', current_date)::date,
          interval '7 days'
        )::date as week_start
      ),
      week_stats as (
        select
          w.week_start,
          count(instance_row.id) filter (where instance_row.status = 'published')::integer as planned,
          count(instance_row.id) filter (
            where instance_row.status = 'published'
              and progress.state in ('completed', 'partially_completed')
          )::integer as completed
        from weeks w
        left join public.session_instances instance_row
          on instance_row.scheduled_date >= w.week_start
         and instance_row.scheduled_date < w.week_start + 7
         and public.is_team_member(instance_row.team_id)
        left join public.athlete_session_progress progress
          on progress.session_id = instance_row.id
         and progress.athlete_id = auth.uid()
        group by w.week_start
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object('week_start', week_start, 'planned', planned, 'completed', completed)
          order by week_start
        ),
        '[]'::jsonb
      )
      from week_stats
    ),

    -- Últimas 30 sessões concluídas ou parcialmente concluídas pelo atleta, mais recente primeiro.
    -- Devolve session + progress no mesmo formato de get_athlete_today para reaproveitar
    -- os helpers do front-end (getSessionTitle, deriveSessionFocus, readSessionBlocks).
    'session_history', (
      select coalesce(jsonb_agg(entry.payload), '[]'::jsonb)
      from (
        select
          jsonb_build_object('session', to_jsonb(instance_row), 'progress', to_jsonb(progress)) as payload
        from public.session_instances instance_row
        join public.athlete_session_progress progress
          on progress.session_id = instance_row.id
         and progress.athlete_id = auth.uid()
        where instance_row.status = 'published'
          and progress.state in ('completed', 'partially_completed')
        order by instance_row.scheduled_date desc, progress.completed_at desc nulls last
        limit 30
      ) entry
    ),

    -- Recorde pessoal (maior carga) por exercício, entre séries marcadas como concluídas
    -- com carga registrada. O nome do exercício vem do snapshot congelado da sessão,
    -- não da tabela exercises, porque o template pode já ter sido substituído.
    'personal_records', (
      with results as (
        select
          set_result.session_id,
          set_result.block_item_id,
          set_result.load_kg,
          set_result.reps,
          instance_row.scheduled_date
        from public.athlete_set_results set_result
        join public.session_instances instance_row on instance_row.id = set_result.session_id
        where set_result.athlete_id = auth.uid()
          and set_result.completed = true
          and set_result.load_kg is not null
      ),
      snapshot_items as (
        select distinct
          instance_row.id as session_id,
          (item ->> 'id')::uuid as block_item_id,
          coalesce(item ->> 'exercise_name', 'Exercício') as exercise_name
        from public.session_instances instance_row
        join (select distinct session_id from results) used_session
          on used_session.session_id = instance_row.id,
          jsonb_array_elements(coalesce(instance_row.snapshot -> 'blocks', '[]'::jsonb)) as block,
          jsonb_array_elements(coalesce(block -> 'items', '[]'::jsonb)) as item
      ),
      joined as (
        select
          snapshot_items.exercise_name,
          results.load_kg,
          results.reps,
          results.scheduled_date
        from results
        join snapshot_items
          on snapshot_items.session_id = results.session_id
         and snapshot_items.block_item_id = results.block_item_id
      ),
      ranked_records as (
        select
          exercise_name,
          load_kg,
          reps,
          scheduled_date,
          row_number() over (
            partition by exercise_name
            order by load_kg desc, scheduled_date desc
          ) as rnk
        from joined
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'exercise_name', exercise_name,
            'load_kg', load_kg,
            'reps', reps,
            'achieved_on', scheduled_date
          )
          order by load_kg desc, exercise_name
        ),
        '[]'::jsonb
      )
      from ranked_records
      where rnk = 1
    )
  );
end;
$$;

comment on function public.get_athlete_progress(integer) is
  'Agregador da aba Progresso: sequência, histórico semanal, sessões concluídas e recordes pessoais.';

revoke all on function public.get_athlete_progress(integer) from public;
grant execute on function public.get_athlete_progress(integer) to authenticated;
