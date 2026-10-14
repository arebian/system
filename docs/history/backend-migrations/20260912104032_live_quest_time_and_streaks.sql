-- THE SYSTEM 2.7.0
-- Server-owned Must windows and daily streak reconciliation.

-- Repair historic Must rows before enforcing the invariant. The original
-- accept adapter could reset expires_at after a DECLINED directive while
-- retaining the old accepted_at, which produced windows such as 29 hours.
update public.user_quests
set
  expires_at = accepted_at + interval '24 hours',
  updated_at = now()
where upper(coalesce(quest_type, '')) = 'MUST'
  and accepted_at is not null
  and expires_at is not null
  and expires_at <> accepted_at + interval '24 hours';

alter table public.user_quests
  drop constraint if exists user_quests_must_exactly_24h_check;

alter table public.user_quests
  add constraint user_quests_must_exactly_24h_check
  check (
    upper(coalesce(quest_type, '')) <> 'MUST'
    or accepted_at is null
    or expires_at is null
    or expires_at = accepted_at + interval '24 hours'
  );

create index if not exists user_quests_daily_streak_lookup_idx
  on public.user_quests (user_id, assigned_for desc)
  where upper(coalesce(quest_type, '')) = 'DAILY'
    and status = 'COMPLETED';

create or replace function public.system_recalculate_daily_streak()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_anchor date;
  v_cursor date;
  v_streak integer := 0;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- The routine timezone is already saved server-side. Falling back to UTC
  -- keeps the calculation deterministic if a player has not configured one.
  select nullif(btrim(timezone), '')
  into v_timezone
  from public.player_routines
  where user_id = v_user
  limit 1;

  v_timezone := coalesce(v_timezone, 'UTC');

  begin
    v_today := (now() at time zone v_timezone)::date;
  exception
    when invalid_parameter_value then
      v_timezone := 'UTC';
      v_today := (now() at time zone v_timezone)::date;
  end;

  -- A daily streak is one verified DAILY quest per calendar day. Completing
  -- several quests on the same day cannot inflate it. Until today's daily is
  -- complete, yesterday remains the last eligible streak day.
  if exists (
    select 1
    from public.user_quests
    where user_id = v_user
      and upper(coalesce(quest_type, '')) = 'DAILY'
      and status = 'COMPLETED'
      and assigned_for = v_today
  ) then
    v_anchor := v_today;
  else
    v_anchor := v_today - 1;
  end if;

  v_cursor := v_anchor;

  while exists (
    select 1
    from public.user_quests
    where user_id = v_user
      and upper(coalesce(quest_type, '')) = 'DAILY'
      and status = 'COMPLETED'
      and assigned_for = v_cursor
  ) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  update public.profiles
  set
    streak = v_streak,
    updated_at = now()
  where id = v_user;

  return jsonb_build_object(
    'streak', v_streak,
    'timezone', v_timezone,
    'anchor_day', v_anchor,
    'server_now', now()
  );
end;
$function$;

revoke all on function public.system_recalculate_daily_streak() from public, anon;
grant execute on function public.system_recalculate_daily_streak() to authenticated;

create or replace function public.system_complete_quest(
  p_user_quest_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_quest public.user_quests;
  v_profile public.profiles;
  v_streak jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_quest
  from public.user_quests
  where id = p_user_quest_id and user_id = v_user
  for update;

  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if v_quest.status = 'COMPLETED' then raise exception 'QUEST_ALREADY_COMPLETED'; end if;
  if v_quest.status = 'FAILED' then raise exception 'QUEST_ALREADY_FAILED'; end if;
  if v_quest.expires_at is not null and v_quest.expires_at < now() then raise exception 'QUEST_EXPIRED'; end if;

  update public.user_quests
  set
    status = 'COMPLETED',
    completed_at = now(),
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where id = v_quest.id
  returning * into v_quest;

  select * into v_profile from public.system_award_xp(
    v_quest.xp_reward,
    'QUEST',
    v_quest.title_snapshot,
    jsonb_build_object('user_quest_id', v_quest.id, 'quest_type', v_quest.quest_type)
  );

  if v_quest.attribute_reward is not null and v_quest.attribute_delta <> 0 then
    perform public.system_add_attribute(
      v_quest.attribute_reward,
      v_quest.attribute_delta,
      'QUEST',
      v_quest.title_snapshot,
      jsonb_build_object('user_quest_id', v_quest.id)
    );
  end if;

  insert into public.journey_events(
    user_id, event_type, title, detail, source, source_id, xp_delta, metadata
  ) values (
    v_user,
    'QUEST_COMPLETE',
    v_quest.title_snapshot,
    v_quest.objective_snapshot,
    'QUEST',
    v_quest.id::text,
    v_quest.xp_reward,
    coalesce(p_metadata, '{}'::jsonb)
  );

  v_streak := public.system_recalculate_daily_streak();
  select * into v_profile from public.profiles where id = v_user;

  return jsonb_build_object(
    'quest', to_jsonb(v_quest),
    'profile', to_jsonb(v_profile),
    'streak', v_streak
  );
end;
$function$;

create or replace function public.system_accept_quest_by_title_v2(
  p_title text,
  p_duration_seconds integer default 86400,
  p_metadata jsonb default '{}'::jsonb,
  p_assigned_for date default null::date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_lib public.quest_library;
  v_uq public.user_quests;
  v_for_date date := coalesce(p_assigned_for, current_date);
  v_duration integer := 86400;
  v_legacy_key text := nullif(trim(coalesce(p_metadata->>'legacy_key', '')), '');
  v_lock_identity text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;

  select * into v_lib
  from public.quest_library q
  where q.active = true
    and upper(q.title) = upper(trim(p_title))
    and q.quest_type = 'MUST'
    and q.min_level <= coalesce(v_profile.level, 1)
    and (
      q.class_affinity is null
      or cardinality(q.class_affinity) = 0
      or upper(v_profile.class) = any(q.class_affinity)
    )
  limit 1;

  if not found then raise exception 'MUST_QUEST_NOT_AVAILABLE'; end if;

  v_lock_identity := coalesce(v_legacy_key, v_lib.id::text);
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || v_for_date::text || ':' || v_lock_identity, 0)
  );

  if v_legacy_key is not null then
    update public.user_quests uq
    set
      status = 'DECLINED',
      updated_at = now(),
      metadata = coalesce(uq.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'closed_reason', 'SUPERSEDED_DIRECTIVE',
          'closed_at', now(),
          'superseded_by', v_lib.title
        )
    where uq.user_id = v_user
      and uq.assigned_for = v_for_date
      and uq.status in ('ASSIGNED', 'ACCEPTED')
      and nullif(uq.metadata->>'legacy_key', '') = v_legacy_key
      and uq.quest_id is distinct from v_lib.id;
  end if;

  select * into v_uq
  from public.user_quests
  where user_id = v_user
    and quest_id = v_lib.id
    and assigned_for = v_for_date
  limit 1
  for update;

  if found and v_uq.status = 'COMPLETED' then
    return jsonb_build_object(
      'duplicate', true,
      'quest', to_jsonb(v_uq),
      'server_now', now(),
      'assigned_for', v_for_date
    );
  end if;

  if found and v_uq.status = 'FAILED' then
    raise exception 'QUEST_ALREADY_FAILED';
  end if;

  if not found then
    insert into public.user_quests(
      user_id, quest_id, assigned_for, quest_type, title_snapshot,
      objective_snapshot, category, status, source, accepted_at, expires_at,
      xp_reward, xp_penalty, attribute_reward, attribute_delta,
      consequence, metadata
    ) values (
      v_user, v_lib.id, v_for_date, v_lib.quest_type, v_lib.title,
      v_lib.objective, v_lib.category, 'ACCEPTED', 'PLATFORM_V2', now(),
      now() + make_interval(secs => v_duration),
      v_lib.xp_reward, v_lib.failure_xp_penalty, v_lib.attribute_reward,
      v_lib.attribute_delta,
      case when coalesce(v_lib.failure_xp_penalty, 0) > 0
        then '-' || v_lib.failure_xp_penalty || ' XP'
        else null end,
      jsonb_build_object(
        'library_code', v_lib.code,
        'adapter', 'TITLE_V2',
        'accepted_by', 'SYSTEM_API',
        'assigned_for', v_for_date
      ) || coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_uq;
  else
    update public.user_quests
    set
      status = 'ACCEPTED',
      accepted_at = case
        when status in ('ASSIGNED', 'DECLINED')
          or accepted_at is null
          or expires_at is null
          then now()
        else accepted_at
      end,
      expires_at = case
        when status in ('ASSIGNED', 'DECLINED')
          or accepted_at is null
          or expires_at is null
          then now() + make_interval(secs => v_duration)
        else expires_at
      end,
      metadata = coalesce(metadata, '{}'::jsonb)
        || coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('assigned_for', v_for_date, 'adapter', 'TITLE_V2'),
      updated_at = now()
    where id = v_uq.id
    returning * into v_uq;
  end if;

  return jsonb_build_object(
    'quest', to_jsonb(v_uq),
    'server_now', now(),
    'assigned_for', v_for_date
  );
end;
$function$;

create or replace function public.system_complete_quest_by_title_v2(
  p_title text,
  p_metadata jsonb default '{}'::jsonb,
  p_assigned_for date default null::date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_lib public.quest_library;
  v_uq public.user_quests;
  v_result jsonb;
  v_orchestration jsonb;
  v_for_date date := coalesce(p_assigned_for, current_date);
  v_legacy_key text := nullif(trim(coalesce(p_metadata->>'legacy_key', '')), '');
  v_lock_identity text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;

  select * into v_lib
  from public.quest_library q
  where q.active = true
    and upper(q.title) = upper(trim(p_title))
    and q.min_level <= coalesce(v_profile.level, 1)
    and (
      q.class_affinity is null
      or cardinality(q.class_affinity) = 0
      or upper(v_profile.class) = any(q.class_affinity)
    )
  order by
    case when upper(v_profile.class) = any(coalesce(q.class_affinity, array[]::text[])) then 0 else 1 end,
    case q.quest_type when 'MUST' then 0 when 'CLASS' then 1 when 'DAILY' then 2 else 3 end
  limit 1;

  if not found then raise exception 'QUEST_NOT_AVAILABLE'; end if;

  v_lock_identity := coalesce(v_legacy_key, v_lib.id::text);
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || v_for_date::text || ':' || v_lock_identity, 0)
  );

  if v_legacy_key is not null then
    update public.user_quests uq
    set
      status = 'DECLINED',
      updated_at = now(),
      metadata = coalesce(uq.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'closed_reason', 'SUPERSEDED_DIRECTIVE',
          'closed_at', now(),
          'superseded_by', v_lib.title
        )
    where uq.user_id = v_user
      and uq.assigned_for = v_for_date
      and uq.status in ('ASSIGNED', 'ACCEPTED')
      and nullif(uq.metadata->>'legacy_key', '') = v_legacy_key
      and uq.quest_id is distinct from v_lib.id;
  end if;

  select * into v_uq
  from public.user_quests
  where user_id = v_user
    and quest_id = v_lib.id
    and assigned_for = v_for_date
  limit 1
  for update;

  if found and v_uq.status = 'COMPLETED' then
    perform public.system_recalculate_daily_streak();
    select * into v_profile from public.profiles where id = v_user;
    return jsonb_build_object(
      'duplicate', true,
      'quest', to_jsonb(v_uq),
      'profile', to_jsonb(v_profile),
      'assigned_for', v_for_date
    );
  end if;

  if found and v_uq.status = 'FAILED' then
    raise exception 'QUEST_ALREADY_FAILED';
  end if;

  if not found then
    insert into public.user_quests(
      user_id, quest_id, assigned_for, quest_type, title_snapshot,
      objective_snapshot, category, status, source, accepted_at, expires_at,
      xp_reward, xp_penalty, attribute_reward, attribute_delta,
      consequence, metadata
    ) values (
      v_user, v_lib.id, v_for_date, v_lib.quest_type, v_lib.title,
      v_lib.objective, v_lib.category,
      case when v_lib.quest_type = 'MUST' then 'ACCEPTED' else 'ASSIGNED' end,
      'PLATFORM_V2',
      case when v_lib.quest_type = 'MUST' then now() else null end,
      now() + interval '24 hours',
      v_lib.xp_reward, v_lib.failure_xp_penalty, v_lib.attribute_reward,
      v_lib.attribute_delta,
      case when coalesce(v_lib.failure_xp_penalty, 0) > 0
        then '-' || v_lib.failure_xp_penalty || ' XP'
        else null end,
      jsonb_build_object(
        'library_code', v_lib.code,
        'adapter', 'TITLE_V2',
        'assigned_for', v_for_date
      ) || coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_uq;
  elsif v_lib.quest_type = 'MUST' and v_uq.status in ('ASSIGNED', 'DECLINED') then
    update public.user_quests
    set
      status = 'ACCEPTED',
      accepted_at = now(),
      expires_at = now() + interval '24 hours',
      metadata = coalesce(metadata, '{}'::jsonb)
        || coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('assigned_for', v_for_date, 'adapter', 'TITLE_V2'),
      updated_at = now()
    where id = v_uq.id
    returning * into v_uq;
  end if;

  v_result := public.system_complete_quest(
    v_uq.id,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('completion_adapter', 'TITLE_V2', 'assigned_for', v_for_date)
  );

  update public.profiles
  set
    momentum = coalesce(momentum, 0)
      + case when v_lib.quest_type = 'MUST' then 2 else 1 end,
    updated_at = now()
  where id = v_user;

  begin
    v_orchestration := public.system_orchestrate_progression();
  exception when others then
    v_orchestration := jsonb_build_object('error', sqlerrm);
  end;

  select * into v_profile from public.profiles where id = v_user;

  return v_result || jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'library_code', v_lib.code,
    'quest_type', v_lib.quest_type,
    'assigned_for', v_for_date,
    'orchestration', v_orchestration
  );
end;
$function$;

-- Keep the still-supported legacy title adapter from recreating the old
-- inflated streak or non-24-hour Must behavior.
create or replace function public.system_complete_quest_by_title(
  p_title text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_lib public.quest_library;
  v_uq public.user_quests;
  v_result jsonb;
  v_today date := current_date;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;

  select * into v_lib from public.quest_library q
  where q.active = true
    and upper(q.title) = upper(trim(p_title))
    and q.min_level <= coalesce(v_profile.level, 1)
    and (
      q.class_affinity is null
      or cardinality(q.class_affinity) = 0
      or upper(v_profile.class) = any(q.class_affinity)
    )
  order by
    case when upper(v_profile.class) = any(coalesce(q.class_affinity, array[]::text[])) then 0 else 1 end,
    case q.quest_type when 'MUST' then 0 when 'CLASS' then 1 when 'DAILY' then 2 else 3 end
  limit 1;

  if not found then raise exception 'QUEST_NOT_AVAILABLE'; end if;

  select * into v_uq from public.user_quests
  where user_id = v_user
    and quest_id = v_lib.id
    and assigned_for = v_today
  order by created_at desc
  limit 1
  for update;

  if found and v_uq.status = 'COMPLETED' then
    perform public.system_recalculate_daily_streak();
    select * into v_profile from public.profiles where id = v_user;
    return jsonb_build_object(
      'duplicate', true,
      'quest', to_jsonb(v_uq),
      'profile', to_jsonb(v_profile)
    );
  end if;

  if not found then
    insert into public.user_quests(
      user_id, quest_id, assigned_for, quest_type, title_snapshot,
      objective_snapshot, category, status, source, accepted_at, expires_at,
      xp_reward, xp_penalty, attribute_reward, attribute_delta,
      consequence, metadata
    ) values (
      v_user, v_lib.id, v_today, v_lib.quest_type, v_lib.title,
      v_lib.objective, v_lib.category,
      case when v_lib.quest_type = 'MUST' then 'ACCEPTED' else 'ASSIGNED' end,
      'LEGACY_UI_ADAPTER',
      case when v_lib.quest_type = 'MUST' then now() else null end,
      case when v_lib.quest_type = 'MUST'
        then now() + interval '24 hours'
        else ((v_today + 1)::timestamp at time zone 'UTC') end,
      v_lib.xp_reward, v_lib.failure_xp_penalty, v_lib.attribute_reward,
      v_lib.attribute_delta,
      case when coalesce(v_lib.failure_xp_penalty, 0) > 0
        then '-' || v_lib.failure_xp_penalty || ' XP'
        else null end,
      jsonb_build_object('library_code', v_lib.code, 'adapter', 'TITLE')
    )
    returning * into v_uq;
  elsif v_lib.quest_type = 'MUST' and v_uq.status in ('ASSIGNED', 'DECLINED') then
    update public.user_quests
    set
      status = 'ACCEPTED',
      accepted_at = now(),
      expires_at = now() + interval '24 hours',
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb)
        || coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('adapter', 'TITLE')
    where id = v_uq.id
    returning * into v_uq;
  end if;

  v_result := public.system_complete_quest(
    v_uq.id,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('completion_adapter', 'TITLE')
  );

  update public.profiles
  set
    momentum = coalesce(momentum, 0)
      + case when v_lib.quest_type = 'MUST' then 2 else 1 end,
    updated_at = now()
  where id = v_user;

  select * into v_profile from public.profiles where id = v_user;
  return v_result || jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'library_code', v_lib.code,
    'quest_type', v_lib.quest_type
  );
end;
$function$;

create or replace function public.system_prepare_player_state()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_penalties jsonb;
  v_quests jsonb;
  v_boss jsonb;
  v_streak jsonb;
  v_orch jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  begin v_penalties := public.system_apply_expired_quest_penalties(); exception when others then v_penalties := jsonb_build_object('error', sqlerrm); end;
  begin v_quests := public.system_generate_daily_quests(current_date); exception when others then v_quests := jsonb_build_object('error', sqlerrm); end;
  begin v_boss := public.system_assign_boss(); exception when others then v_boss := jsonb_build_object('error', sqlerrm); end;
  begin v_streak := public.system_recalculate_daily_streak(); exception when others then v_streak := jsonb_build_object('error', sqlerrm); end;
  begin v_orch := public.system_orchestrate_progression(); exception when others then v_orch := jsonb_build_object('error', sqlerrm); end;
  return jsonb_build_object(
    'penalties', v_penalties,
    'quests', v_quests,
    'boss', v_boss,
    'streak', v_streak,
    'orchestration', v_orch,
    'prepared_at', now()
  );
end;
$function$;

