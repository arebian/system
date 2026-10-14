-- THE SYSTEM 2.8.6 — Timed training must use a server clock, not GPS.
--
-- Static holds and calisthenics are not movement routes. This creates a
-- server-owned timer session, prevents the legacy direct completion path from
-- bypassing it, and leaves explicit outdoor/distance training on GPS.

create table if not exists public.workout_timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id bigint not null references public.workout_templates(id) on delete cascade,
  workout_name_snapshot text not null,
  verification_mode text not null default 'TIMER' check (verification_mode = 'TIMER'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETING', 'COMPLETED', 'EXPIRED')),
  target_seconds integer not null check (target_seconds between 60 and 7200),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  completed_workout_session_id bigint references public.user_workout_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workout_timer_sessions_one_active_per_user_idx
  on public.workout_timer_sessions (user_id)
  where status = 'ACTIVE';

create index if not exists workout_timer_sessions_user_started_idx
  on public.workout_timer_sessions (user_id, started_at desc);

alter table public.workout_timer_sessions enable row level security;

revoke all on table public.workout_timer_sessions from public, anon, authenticated;
grant select on table public.workout_timer_sessions to authenticated;

drop policy if exists "Players can view their own workout timer sessions" on public.workout_timer_sessions;
create policy "Players can view their own workout timer sessions"
  on public.workout_timer_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Explicit metadata makes the intended Core Foundation behavior clear. The
-- helper below also safely classifies other timed stationary workouts so the
-- rule remains consistent as the catalog grows.
update public.workout_templates
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'verification_mode', 'TIMER',
  'timer_protocol', 'SERVER_COUNTDOWN'
)
where upper(name) = 'CORE FOUNDATION';

update public.workout_templates
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'verification_mode', 'GPS'
)
where upper(name) in ('RUNNER BASE', '5K BUILDER');

create or replace function public.system_workout_verification_mode_v1(
  p_workout_id bigint
)
returns text
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_workout public.workout_templates;
  v_explicit_mode text;
  v_text text;
  v_has_timed_steps boolean := false;
begin
  select * into v_workout
  from public.workout_templates
  where id = p_workout_id;

  if not found then
    return 'PERFORMANCE';
  end if;

  v_explicit_mode := upper(trim(coalesce(v_workout.metadata ->> 'verification_mode', '')));
  if v_explicit_mode in ('GPS', 'TIMER', 'PERFORMANCE') then
    return v_explicit_mode;
  end if;

  select exists (
    select 1
    from public.workout_steps step
    where step.workout_id = v_workout.id
      and coalesce(step.duration_seconds, 0) > 0
  ) into v_has_timed_steps;

  v_text := upper(concat_ws(' ', v_workout.name, v_workout.description, v_workout.category));

  -- Word boundaries are deliberate: the old loose /RUN/ check incorrectly
  -- matched the word "trunk" in Core Foundation's description.
  if v_text ~ '\\m(RUN|WALK|JOG|HIKE|TRAIL|SPRINT|CYCLE|CYCLING|BIKE|SWIM)\\M' then
    return 'GPS';
  end if;

  if v_has_timed_steps then
    return 'TIMER';
  end if;

  return 'PERFORMANCE';
end;
$function$;

revoke all on function public.system_workout_verification_mode_v1(bigint) from public, anon, authenticated;

create or replace function public.system_start_timed_workout_v1(
  p_workout_id bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_workout public.workout_templates;
  v_timer public.workout_timer_sessions;
  v_mode text;
  v_target_seconds integer;
  v_elapsed_seconds integer := 0;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_workout_id is null or p_workout_id <= 0 then
    raise exception 'INVALID_WORKOUT_ID';
  end if;

  if not public.system_workout_available(p_workout_id) then
    raise exception 'WORKOUT_LOCKED_OR_UNAVAILABLE';
  end if;

  select * into v_workout
  from public.workout_templates
  where id = p_workout_id
    and active = true;

  if not found then
    raise exception 'WORKOUT_NOT_FOUND';
  end if;

  v_mode := public.system_workout_verification_mode_v1(v_workout.id);
  if v_mode <> 'TIMER' then
    raise exception 'WORKOUT_DOES_NOT_USE_TIMER';
  end if;

  -- A player may resume an in-progress timer, but cannot run several timers
  -- in parallel. Timers get a 2x-duration grace window for a normal call,
  -- hydration, or browser backgrounding; after that they expire safely.
  select * into v_timer
  from public.workout_timer_sessions
  where user_id = v_user
    and status = 'ACTIVE'
  order by started_at desc
  limit 1
  for update;

  if found then
    v_elapsed_seconds := greatest(
      0,
      floor(extract(epoch from clock_timestamp() - v_timer.started_at))::integer
    );

    if v_elapsed_seconds <= v_timer.target_seconds * 2 then
      select * into v_workout
      from public.workout_templates
      where id = v_timer.workout_id;

      return jsonb_build_object(
        'session', to_jsonb(v_timer),
        'workout', to_jsonb(v_workout),
        'resumed', true,
        'server_now', clock_timestamp()
      );
    end if;

    update public.workout_timer_sessions
    set
      status = 'EXPIRED',
      updated_at = clock_timestamp()
    where id = v_timer.id;
  end if;

  v_target_seconds := least(
    7200,
    greatest(
      60,
      coalesce(v_workout.estimated_minutes, 10) * 60
    )
  );

  insert into public.workout_timer_sessions(
    user_id,
    workout_id,
    workout_name_snapshot,
    target_seconds,
    metadata
  )
  values (
    v_user,
    v_workout.id,
    v_workout.name,
    v_target_seconds,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'verification_mode', 'SERVER_TIMER'
    )
  )
  returning * into v_timer;

  return jsonb_build_object(
    'session', to_jsonb(v_timer),
    'workout', to_jsonb(v_workout),
    'resumed', false,
    'server_now', clock_timestamp()
  );
end;
$function$;

revoke all on function public.system_start_timed_workout_v1(bigint, jsonb) from public, anon;
grant execute on function public.system_start_timed_workout_v1(bigint, jsonb) to authenticated;

-- Timed workouts cannot be awarded through the old one-click route. The timer
-- completion RPC first changes the session to COMPLETING inside its transaction;
-- this function accepts that state only, so forged browser metadata is rejected.
create or replace function public.system_complete_workout(
  p_workout_id bigint,
  p_duration_seconds integer default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_workout public.workout_templates;
  v_session public.user_workout_sessions;
  v_profile public.profiles;
  v_damage integer;
  v_boss public.boss_quests;
  v_attr text;
  v_attr_delta integer := 0;
  v_recent bigint;
  v_mode text;
  v_timer_id uuid;
  v_timer public.workout_timer_sessions;
  v_elapsed_seconds integer := 0;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.system_workout_available(p_workout_id) then
    raise exception 'WORKOUT_LOCKED_OR_UNAVAILABLE';
  end if;

  select * into v_workout
  from public.workout_templates
  where id = p_workout_id
    and active = true;

  if not found then
    raise exception 'WORKOUT_NOT_FOUND';
  end if;

  if p_duration_seconds is not null and (p_duration_seconds < 0 or p_duration_seconds > 43200) then
    raise exception 'INVALID_WORKOUT_DURATION';
  end if;

  v_mode := public.system_workout_verification_mode_v1(v_workout.id);
  if v_mode = 'TIMER' then
    begin
      v_timer_id := nullif(trim(coalesce(p_metadata ->> 'timer_session_id', '')), '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'TIMER_SESSION_INVALID';
    end;

    if v_timer_id is null then
      raise exception 'TIMER_REQUIRED_FOR_WORKOUT';
    end if;

    select * into v_timer
    from public.workout_timer_sessions
    where id = v_timer_id
      and user_id = v_user
      and workout_id = v_workout.id
      and status = 'COMPLETING'
    for update;

    if not found then
      raise exception 'TIMER_SESSION_NOT_READY';
    end if;

    v_elapsed_seconds := greatest(
      0,
      floor(extract(epoch from clock_timestamp() - v_timer.started_at))::integer
    );

    if v_elapsed_seconds < v_timer.target_seconds then
      raise exception 'TIMER_NOT_COMPLETE';
    end if;
  end if;

  select id into v_recent
  from public.user_workout_sessions
  where user_id = v_user
    and workout_id = p_workout_id
    and status = 'COMPLETED'
    and completed_at > now() - interval '30 seconds'
  order by completed_at desc
  limit 1;

  if v_recent is not null then
    raise exception 'WORKOUT_DUPLICATE_WINDOW';
  end if;

  insert into public.user_workout_sessions(
    user_id,
    workout_id,
    workout_name_snapshot,
    status,
    started_at,
    completed_at,
    duration_seconds,
    notes,
    metadata
  )
  values(
    v_user,
    v_workout.id,
    v_workout.name,
    'COMPLETED',
    now(),
    now(),
    p_duration_seconds,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_session;

  select * into v_profile
  from public.system_award_xp(
    v_workout.xp_reward,
    'WORKOUT',
    v_workout.name,
    jsonb_build_object('workout_id', v_workout.id, 'session_id', v_session.id)
  );

  case upper(v_workout.category)
    when 'STRENGTH' then v_attr := 'STRENGTH'; v_attr_delta := 2;
    when 'LEGS' then v_attr := 'ENDURANCE'; v_attr_delta := 2;
    when 'SPEED' then v_attr := 'SPEED'; v_attr_delta := 2;
    when 'ENDURANCE' then v_attr := 'ENDURANCE'; v_attr_delta := 2;
    when 'CORE' then v_attr := 'STRENGTH'; v_attr_delta := 1;
    else
      if array_length(v_workout.focus, 1) > 0
        and upper(v_workout.focus[1]) in (
          'STRENGTH', 'SPEED', 'ENDURANCE', 'INTELLIGENCE', 'FOCUS',
          'DISCIPLINE', 'WEALTH', 'CHARISMA', 'CREATIVITY', 'RECOVERY'
        ) then
        v_attr := upper(v_workout.focus[1]);
        v_attr_delta := 1;
      end if;
  end case;

  if v_attr is not null and v_attr_delta > 0 then
    perform public.system_add_attribute(
      v_attr,
      v_attr_delta,
      'WORKOUT',
      v_workout.name,
      jsonb_build_object('workout_id', v_workout.id, 'session_id', v_session.id)
    );
  end if;

  v_damage := greatest(8, least(34, round(8 + v_workout.xp_reward::numeric / 8)::integer));
  begin
    select * into v_boss
    from public.system_damage_active_boss(
      v_damage,
      'WORKOUT',
      v_session.id::text,
      v_workout.name,
      jsonb_build_object('workout_id', v_workout.id)
    );
  exception
    when others then
      if sqlerrm <> 'NO_ACTIVE_BOSS' then
        raise;
      end if;
      v_boss := null;
  end;

  insert into public.journey_events(
    user_id,
    event_type,
    title,
    detail,
    source,
    source_id,
    xp_delta,
    metadata
  )
  values(
    v_user,
    'WORKOUT_COMPLETE',
    v_workout.name,
    'Workout completed and progression verified by backend.',
    'WORKOUT',
    v_session.id::text,
    v_workout.xp_reward,
    jsonb_build_object(
      'boss_damage', case when v_boss.id is null then 0 else v_damage end,
      'verification_mode', v_mode
    )
  );

  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'profile', to_jsonb(v_profile),
    'boss', case when v_boss.id is null then null else to_jsonb(v_boss) end,
    'boss_damage', case when v_boss.id is null then 0 else v_damage end,
    'attribute', v_attr,
    'attribute_delta', v_attr_delta
  );
end;
$function$;

revoke all on function public.system_complete_workout(bigint, integer, text, jsonb) from public, anon;
grant execute on function public.system_complete_workout(bigint, integer, text, jsonb) to authenticated;

create or replace function public.system_complete_timed_workout_v1(
  p_timer_session_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_timer public.workout_timer_sessions;
  v_elapsed_seconds integer := 0;
  v_result jsonb;
  v_workout_session_id bigint;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_timer
  from public.workout_timer_sessions
  where id = p_timer_session_id
    and user_id = v_user
  for update;

  if not found then
    raise exception 'TIMER_SESSION_NOT_FOUND';
  end if;

  if v_timer.status = 'COMPLETED' then
    raise exception 'TIMER_ALREADY_COMPLETED';
  end if;

  if v_timer.status = 'EXPIRED' then
    raise exception 'TIMER_EXPIRED';
  end if;

  if v_timer.status <> 'ACTIVE' then
    raise exception 'TIMER_SESSION_BUSY';
  end if;

  v_elapsed_seconds := greatest(
    0,
    floor(extract(epoch from clock_timestamp() - v_timer.started_at))::integer
  );

  if v_elapsed_seconds > v_timer.target_seconds * 2 then
    update public.workout_timer_sessions
    set
      status = 'EXPIRED',
      updated_at = clock_timestamp()
    where id = v_timer.id;

    raise exception 'TIMER_EXPIRED';
  end if;

  if v_elapsed_seconds < v_timer.target_seconds then
    raise exception 'TIMER_IN_PROGRESS';
  end if;

  update public.workout_timer_sessions
  set
    status = 'COMPLETING',
    updated_at = clock_timestamp()
  where id = v_timer.id;

  v_result := public.system_complete_workout(
    v_timer.workout_id,
    v_elapsed_seconds,
    null,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'verification_mode', 'SERVER_TIMER',
      'timer_session_id', v_timer.id,
      'server_elapsed_seconds', v_elapsed_seconds
    )
  );

  v_workout_session_id := nullif(v_result -> 'session' ->> 'id', '')::bigint;

  update public.workout_timer_sessions
  set
    status = 'COMPLETED',
    completed_at = clock_timestamp(),
    completed_workout_session_id = v_workout_session_id,
    updated_at = clock_timestamp()
  where id = v_timer.id
  returning * into v_timer;

  return v_result || jsonb_build_object(
    'timer_session', to_jsonb(v_timer),
    'server_now', clock_timestamp()
  );
end;
$function$;

revoke all on function public.system_complete_timed_workout_v1(uuid, jsonb) from public, anon;
grant execute on function public.system_complete_timed_workout_v1(uuid, jsonb) to authenticated;

