-- THE SYSTEM 2.1.1 quest identity repair

-- 1) Remove historical duplicate quest instances while preserving the most
-- authoritative row (COMPLETED > FAILED > ACCEPTED > ASSIGNED > other).
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, quest_id, assigned_for
      order by
        case status
          when 'COMPLETED' then 1
          when 'FAILED' then 2
          when 'ACCEPTED' then 3
          when 'ASSIGNED' then 4
          else 5
        end,
        coalesce(completed_at, failed_at, accepted_at, updated_at, created_at) desc,
        created_at desc,
        id desc
    ) as rn
  from public.user_quests
  where quest_id is not null
)
delete from public.user_quests uq
using ranked r
where uq.id = r.id
  and r.rn > 1;

-- 2) A user can have exactly one instance of a catalog quest per assigned day.
-- PostgreSQL still permits multiple rows when quest_id is NULL, which is fine
-- for any legacy/custom quest rows.
create unique index if not exists user_quests_user_quest_day_uidx
  on public.user_quests(user_id, quest_id, assigned_for);

-- 3) Close class-specific active quests that no longer match the player's
-- current class. This prevents old class directives surviving a class change.
update public.user_quests uq
set
  status = 'DECLINED',
  updated_at = now(),
  metadata = coalesce(uq.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'closed_reason', 'CLASS_CHANGED',
      'closed_at', now()
    )
from public.quest_library q,
     public.profiles p
where uq.quest_id = q.id
  and uq.user_id = p.id
  and uq.status in ('ASSIGNED','ACCEPTED')
  and q.class_affinity is not null
  and cardinality(q.class_affinity) > 0
  and not (upper(p.class) = any(q.class_affinity));

-- 4) Race-safe Must acceptance. The advisory transaction lock prevents two
-- concurrent browser/effect calls from both observing "not found".
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

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_user::text || ':' || v_lib.id::text || ':' || v_for_date::text,
      0
    )
  );

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
        when status = 'ASSIGNED' or accepted_at is null or expires_at is null
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

-- 5) Race-safe quest completion using the same identity lock.
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

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_user::text || ':' || v_lib.id::text || ':' || v_for_date::text,
      0
    )
  );

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
  elsif v_lib.quest_type = 'MUST' and v_uq.status = 'ASSIGNED' then
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

-- 6) Future class changes immediately retire incompatible active class quests.
create or replace function public.system_change_class(
  p_new_class text,
  p_reason text default 'CLASS_REASSIGNMENT',
  p_trial_status text default 'PASSED',
  p_metadata jsonb default '{}'::jsonb
)
returns profiles
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_new text := upper(trim(p_new_class));
  v_old text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_new not in ('ASSASSIN','TANK','MAGE','RANGER','COMMANDER') then raise exception 'INVALID_CLASS'; end if;

  select * into v_profile from public.profiles where id = v_user for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  v_old := v_profile.class;
  if v_old = v_new then return v_profile; end if;

  update public.profiles
  set class = v_new, current_class_since = now(), updated_at = now()
  where id = v_user
  returning * into v_profile;

  update public.user_quests uq
  set
    status = 'DECLINED',
    updated_at = now(),
    metadata = coalesce(uq.metadata, '{}'::jsonb)
      || jsonb_build_object('closed_reason', 'CLASS_CHANGED', 'closed_at', now(), 'from_class', v_old, 'to_class', v_new)
  from public.quest_library q
  where uq.user_id = v_user
    and uq.quest_id = q.id
    and uq.status in ('ASSIGNED','ACCEPTED')
    and q.class_affinity is not null
    and cardinality(q.class_affinity) > 0
    and not (v_new = any(q.class_affinity));

  insert into public.class_history(user_id,from_class,to_class,reason,trial_status,metadata)
  values(v_user,v_old,v_new,p_reason,p_trial_status,coalesce(p_metadata,'{}'::jsonb));

  insert into public.journey_events(user_id,event_type,title,detail,source,metadata)
  values(v_user,'CLASS_CHANGE',v_old||' → '||v_new,'Class reassignment recorded by backend.','SYSTEM',coalesce(p_metadata,'{}'::jsonb));

  return v_profile;
end;
$function$;
