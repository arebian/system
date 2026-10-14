begin;

-- Central attribute award helper. Keeps arithmetic out of future frontends.
create or replace function public.system_add_attribute(
  p_attribute text,
  p_delta integer,
  p_source text default 'SYSTEM',
  p_title text default 'ATTRIBUTE AWARD',
  p_metadata jsonb default '{}'::jsonb
)
returns public.attributes
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_before integer;
  v_after integer;
  v_attrs public.attributes;
  v_attr text := upper(trim(p_attribute));
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_delta = 0 then raise exception 'ATTRIBUTE_DELTA_ZERO'; end if;
  if v_attr not in ('STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY') then
    raise exception 'INVALID_ATTRIBUTE';
  end if;

  insert into public.attributes(user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  select * into v_attrs from public.attributes where user_id=v_user for update;

  v_before := case v_attr
    when 'STRENGTH' then v_attrs.strength
    when 'SPEED' then v_attrs.speed
    when 'ENDURANCE' then v_attrs.endurance
    when 'INTELLIGENCE' then v_attrs.intelligence
    when 'FOCUS' then v_attrs.focus
    when 'DISCIPLINE' then v_attrs.discipline
    when 'WEALTH' then v_attrs.wealth
    when 'CHARISMA' then v_attrs.charisma
    when 'CREATIVITY' then v_attrs.creativity
    when 'RECOVERY' then v_attrs.recovery
  end;
  v_after := greatest(0, v_before + p_delta);

  execute format('update public.attributes set %I=$1, updated_at=now() where user_id=$2 returning *', lower(v_attr))
    into v_attrs using v_after, v_user;

  insert into public.progression_events(
    user_id,event_type,source,title,xp_delta,level_before,level_after,attribute_name,attribute_delta,metadata
  )
  select v_user,'ATTRIBUTE_CHANGE',p_source,p_title,0,p.level,p.level,v_attr,(v_after-v_before),coalesce(p_metadata,'{}'::jsonb)
  from public.profiles p where p.id=v_user;

  return v_attrs;
end;
$$;

-- Backend owns workout unlock checks.
create or replace function public.system_workout_available(p_workout_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_workout public.workout_templates;
  v_blocked integer;
begin
  if v_user is null then return false; end if;
  select * into v_profile from public.profiles where id=v_user;
  select * into v_workout from public.workout_templates where id=p_workout_id and active=true;
  if not found then return false; end if;
  if cardinality(v_workout.class_affinity) > 0 and not (v_profile.class = any(v_workout.class_affinity)) then return false; end if;

  select count(*) into v_blocked
  from public.workout_skill_requirements r
  left join public.user_skills us
    on us.user_id=v_user and us.skill_id=r.skill_id
  where r.workout_id=p_workout_id
    and case upper(r.minimum_status)
      when 'MASTERED' then coalesce(us.status,'LOCKED') <> 'MASTERED'
      when 'AVAILABLE' then coalesce(us.status,'LOCKED') not in ('AVAILABLE','IN_PROGRESS','MASTERED')
      else coalesce(us.status,'LOCKED')='LOCKED'
    end;

  return v_blocked=0;
end;
$$;

create or replace function public.system_complete_workout(
  p_workout_id bigint,
  p_duration_seconds integer default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_workout public.workout_templates;
  v_session public.user_workout_sessions;
  v_profile public.profiles;
  v_damage integer;
  v_boss public.boss_quests;
  v_attr text;
  v_attr_delta integer := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.system_workout_available(p_workout_id) then raise exception 'WORKOUT_LOCKED_OR_UNAVAILABLE'; end if;

  select * into v_workout from public.workout_templates where id=p_workout_id and active=true;

  insert into public.user_workout_sessions(
    user_id,workout_id,workout_name_snapshot,status,started_at,completed_at,duration_seconds,notes,metadata
  ) values (
    v_user,v_workout.id,v_workout.name,'COMPLETED',now(),now(),p_duration_seconds,p_notes,coalesce(p_metadata,'{}'::jsonb)
  ) returning * into v_session;

  select * into v_profile from public.system_award_xp(
    v_workout.xp_reward,
    'WORKOUT',
    v_workout.name,
    jsonb_build_object('workout_id',v_workout.id,'session_id',v_session.id)
  );

  -- Primary attribute reward derived from category/focus, server side.
  case upper(v_workout.category)
    when 'STRENGTH' then v_attr:='STRENGTH'; v_attr_delta:=2;
    when 'LEGS' then v_attr:='ENDURANCE'; v_attr_delta:=2;
    when 'SPEED' then v_attr:='SPEED'; v_attr_delta:=2;
    when 'ENDURANCE' then v_attr:='ENDURANCE'; v_attr_delta:=2;
    when 'CORE' then v_attr:='STRENGTH'; v_attr_delta:=1;
    else
      if array_length(v_workout.focus,1) > 0 and upper(v_workout.focus[1]) in ('STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY') then
        v_attr:=upper(v_workout.focus[1]); v_attr_delta:=1;
      end if;
  end case;

  if v_attr is not null and v_attr_delta > 0 then
    perform public.system_add_attribute(
      v_attr,v_attr_delta,'WORKOUT',v_workout.name,
      jsonb_build_object('workout_id',v_workout.id,'session_id',v_session.id)
    );
  end if;

  v_damage := greatest(8, least(34, round(8 + v_workout.xp_reward::numeric/8)::integer));
  begin
    select * into v_boss from public.system_damage_active_boss(
      v_damage,'WORKOUT',v_session.id::text,v_workout.name,
      jsonb_build_object('workout_id',v_workout.id)
    );
  exception when others then
    if sqlerrm <> 'NO_ACTIVE_BOSS' then raise; end if;
    v_boss := null;
  end;

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values (
    v_user,'WORKOUT_COMPLETE',v_workout.name,
    'Workout completed and progression verified by backend.',
    'WORKOUT',v_session.id::text,v_workout.xp_reward,
    jsonb_build_object('boss_damage',case when v_boss.id is null then 0 else v_damage end)
  );

  return jsonb_build_object(
    'session',to_jsonb(v_session),
    'profile',to_jsonb(v_profile),
    'boss',case when v_boss.id is null then null else to_jsonb(v_boss) end,
    'boss_damage',case when v_boss.id is null then 0 else v_damage end,
    'attribute',v_attr,
    'attribute_delta',v_attr_delta
  );
end;
$$;

-- User quest completion is atomic: status, XP, attributes and journey event.
create or replace function public.system_complete_quest(
  p_user_quest_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_quest public.user_quests;
  v_profile public.profiles;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_quest
  from public.user_quests
  where id=p_user_quest_id and user_id=v_user
  for update;

  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if v_quest.status='COMPLETED' then raise exception 'QUEST_ALREADY_COMPLETED'; end if;
  if v_quest.status='FAILED' then raise exception 'QUEST_ALREADY_FAILED'; end if;
  if v_quest.expires_at is not null and v_quest.expires_at < now() then raise exception 'QUEST_EXPIRED'; end if;

  update public.user_quests
  set status='COMPLETED', completed_at=now(), updated_at=now(), metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb)
  where id=v_quest.id
  returning * into v_quest;

  select * into v_profile from public.system_award_xp(
    v_quest.xp_reward,'QUEST',v_quest.title_snapshot,
    jsonb_build_object('user_quest_id',v_quest.id,'quest_type',v_quest.quest_type)
  );

  if v_quest.attribute_reward is not null and v_quest.attribute_delta <> 0 then
    perform public.system_add_attribute(
      v_quest.attribute_reward,v_quest.attribute_delta,'QUEST',v_quest.title_snapshot,
      jsonb_build_object('user_quest_id',v_quest.id)
    );
  end if;

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values (v_user,'QUEST_COMPLETE',v_quest.title_snapshot,v_quest.objective_snapshot,'QUEST',v_quest.id::text,v_quest.xp_reward,coalesce(p_metadata,'{}'::jsonb));

  return jsonb_build_object('quest',to_jsonb(v_quest),'profile',to_jsonb(v_profile));
end;
$$;

-- Backend starts GPS missions and stores target contract.
create or replace function public.system_start_gps_session(
  p_activity_type text,
  p_target_distance_km numeric default null,
  p_target_duration_seconds integer default null,
  p_quest_id uuid default null,
  p_workout_session_id bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.gps_sessions
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_session public.gps_sessions;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_target_distance_km is null and p_target_duration_seconds is null then raise exception 'GPS_TARGET_REQUIRED'; end if;
  if p_target_distance_km is not null and p_target_distance_km <= 0 then raise exception 'INVALID_DISTANCE_TARGET'; end if;
  if p_target_duration_seconds is not null and p_target_duration_seconds <= 0 then raise exception 'INVALID_DURATION_TARGET'; end if;

  insert into public.gps_sessions(
    user_id,quest_id,workout_session_id,activity_type,status,target_distance_km,target_duration_seconds,metadata
  ) values (
    v_user,p_quest_id,p_workout_session_id,upper(coalesce(p_activity_type,'MOVEMENT')),'STARTED',p_target_distance_km,p_target_duration_seconds,coalesce(p_metadata,'{}'::jsonb)
  ) returning * into v_session;

  return v_session;
end;
$$;

create or replace function public.system_finish_gps_session(
  p_session_id uuid,
  p_distance_km numeric,
  p_duration_seconds integer,
  p_route jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_session public.gps_sessions;
  v_verified boolean;
  v_pace numeric;
  v_damage integer := 0;
  v_boss public.boss_quests;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_session from public.gps_sessions
  where id=p_session_id and user_id=v_user for update;
  if not found then raise exception 'GPS_SESSION_NOT_FOUND'; end if;
  if v_session.status='COMPLETED' then raise exception 'GPS_SESSION_ALREADY_COMPLETED'; end if;

  v_verified :=
    (v_session.target_distance_km is null or p_distance_km >= v_session.target_distance_km)
    and
    (v_session.target_duration_seconds is null or p_duration_seconds >= v_session.target_duration_seconds);

  v_pace := case when p_distance_km > 0 then p_duration_seconds::numeric/p_distance_km else null end;

  update public.gps_sessions
  set status=case when v_verified then 'COMPLETED' else 'ENDED_EARLY' end,
      distance_km=greatest(0,coalesce(p_distance_km,0)),
      duration_seconds=greatest(0,coalesce(p_duration_seconds,0)),
      pace_seconds_per_km=v_pace,
      route=coalesce(p_route,'[]'::jsonb),
      gps_verified=v_verified,
      ended_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb)
  where id=v_session.id
  returning * into v_session;

  if v_verified then
    v_damage := greatest(8, least(40, round(8 + coalesce(p_distance_km,0)*5 + coalesce(p_duration_seconds,0)::numeric/900)::integer));
    begin
      select * into v_boss from public.system_damage_active_boss(
        v_damage,'GPS',v_session.id::text,v_session.activity_type,
        jsonb_build_object('distance_km',v_session.distance_km,'duration_seconds',v_session.duration_seconds)
      );
    exception when others then
      if sqlerrm <> 'NO_ACTIVE_BOSS' then raise; end if;
      v_boss := null;
    end;

    if v_session.quest_id is not null then
      begin
        perform public.system_complete_quest(v_session.quest_id, jsonb_build_object('gps_session_id',v_session.id));
      exception when others then
        if sqlerrm not in ('QUEST_ALREADY_COMPLETED','QUEST_ALREADY_FAILED','QUEST_EXPIRED') then raise; end if;
      end;
    end if;
  end if;

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,metadata)
  values (
    v_user,
    case when v_verified then 'GPS_VERIFIED' else 'GPS_ENDED_EARLY' end,
    v_session.activity_type,
    round(v_session.distance_km,2)::text||' KM • '||v_session.duration_seconds::text||' SEC',
    'GPS',v_session.id::text,
    jsonb_build_object('verified',v_verified,'boss_damage',case when v_boss.id is null then 0 else v_damage end)
  );

  return jsonb_build_object(
    'session',to_jsonb(v_session),
    'verified',v_verified,
    'boss',case when v_boss.id is null then null else to_jsonb(v_boss) end,
    'boss_damage',case when v_boss.id is null then 0 else v_damage end
  );
end;
$$;

-- Class reassignment is server controlled. UI can later wrap this in a trial.
create or replace function public.system_change_class(
  p_new_class text,
  p_reason text default 'CLASS_REASSIGNMENT',
  p_trial_status text default 'PASSED',
  p_metadata jsonb default '{}'::jsonb
)
returns public.profiles
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_new text := upper(trim(p_new_class));
  v_old text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_new not in ('ASSASSIN','TANK','MAGE','RANGER','COMMANDER') then raise exception 'INVALID_CLASS'; end if;

  select * into v_profile from public.profiles where id=v_user for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  v_old := v_profile.class;
  if v_old=v_new then return v_profile; end if;

  update public.profiles set class=v_new,current_class_since=now(),updated_at=now() where id=v_user returning * into v_profile;
  insert into public.class_history(user_id,from_class,to_class,reason,trial_status,metadata)
  values(v_user,v_old,v_new,p_reason,p_trial_status,coalesce(p_metadata,'{}'::jsonb));

  insert into public.journey_events(user_id,event_type,title,detail,source,metadata)
  values(v_user,'CLASS_CHANGE',v_old||' → '||v_new,'Class reassignment recorded by backend.','SYSTEM',coalesce(p_metadata,'{}'::jsonb));

  return v_profile;
end;
$$;

commit;
