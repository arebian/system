-- THE SYSTEM 2.1.1 Must-slot identity repair

-- Close an active directive when the same logical Must slot was already
-- completed for that user/day by another quest title.
update public.user_quests active_q
set
  status = 'DECLINED',
  updated_at = now(),
  metadata = coalesce(active_q.metadata, '{}'::jsonb)
    || jsonb_build_object('closed_reason','SLOT_ALREADY_COMPLETED','closed_at',now())
where active_q.status in ('ASSIGNED','ACCEPTED')
  and nullif(active_q.metadata->>'legacy_key','') is not null
  and exists (
    select 1
    from public.user_quests done_q
    where done_q.user_id = active_q.user_id
      and done_q.assigned_for = active_q.assigned_for
      and done_q.status = 'COMPLETED'
      and nullif(done_q.metadata->>'legacy_key','') = nullif(active_q.metadata->>'legacy_key','')
      and done_q.id <> active_q.id
  );

-- Only one active quest may occupy a client Must slot per user/day.
create unique index if not exists user_quests_active_legacy_slot_uidx
  on public.user_quests(user_id, assigned_for, ((metadata->>'legacy_key')))
  where status in ('ASSIGNED','ACCEPTED')
    and nullif(metadata->>'legacy_key','') is not null;

create or replace function public.system_accept_quest_by_title_v2(
  p_title text,
  p_duration_seconds integer default 86400,
  p_metadata jsonb default '{}'::jsonb,
  p_assigned_for date default null
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
  v_duration integer;
  v_legacy_key text := nullif(trim(coalesce(p_metadata->>'legacy_key','')), '');
  v_lock_identity text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  v_duration := least(greatest(coalesce(p_duration_seconds, 86400), 60), 86400);

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
    hashtextextended(
      v_user::text || ':' || v_for_date::text || ':' || v_lock_identity,
      0
    )
  );

  -- If the frontend rotated this logical slot to a different title, retire
  -- the older active directive before accepting the new one. No penalty.
  if v_legacy_key is not null then
    update public.user_quests uq
    set
      status = 'DECLINED',
      updated_at = now(),
      metadata = coalesce(uq.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'closed_reason','SUPERSEDED_DIRECTIVE',
          'closed_at',now(),
          'superseded_by',v_lib.title
        )
    where uq.user_id = v_user
      and uq.assigned_for = v_for_date
      and uq.status in ('ASSIGNED','ACCEPTED')
      and nullif(uq.metadata->>'legacy_key','') = v_legacy_key
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
    return jsonb_build_object('duplicate', true, 'quest', to_jsonb(v_uq), 'server_now', now(), 'assigned_for', v_for_date);
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
      accepted_at = coalesce(accepted_at, now()),
      expires_at = case
        when status in ('ASSIGNED','DECLINED') or accepted_at is null or expires_at is null
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
  p_assigned_for date default null
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
  v_legacy_key text := nullif(trim(coalesce(p_metadata->>'legacy_key','')), '');
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
    hashtextextended(
      v_user::text || ':' || v_for_date::text || ':' || v_lock_identity,
      0
    )
  );

  if v_legacy_key is not null then
    update public.user_quests uq
    set
      status = 'DECLINED',
      updated_at = now(),
      metadata = coalesce(uq.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'closed_reason','SUPERSEDED_DIRECTIVE',
          'closed_at',now(),
          'superseded_by',v_lib.title
        )
    where uq.user_id = v_user
      and uq.assigned_for = v_for_date
      and uq.status in ('ASSIGNED','ACCEPTED')
      and nullif(uq.metadata->>'legacy_key','') = v_legacy_key
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
  elsif v_lib.quest_type = 'MUST' and v_uq.status in ('ASSIGNED','DECLINED') then
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
    momentum = coalesce(momentum, 0) + case when v_lib.quest_type = 'MUST' then 2 else 1 end,
    streak = coalesce(streak, 0) + case when v_lib.quest_type = 'MUST' then 0 else 1 end,
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
