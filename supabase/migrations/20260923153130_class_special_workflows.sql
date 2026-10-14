-- 2.9.3: real, class-specific practice sessions. All rewards are server-owned.
create table public.class_special_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class text not null check (class in ('COMMANDER','TANK','ASSASSIN','RANGER')),
  title text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','CANCELLED')),
  target_seconds integer not null check (target_seconds >= 0),
  xp_reward integer not null check (xp_reward between 0 and 100),
  attribute_reward text not null check (attribute_reward in ('CHARISMA','STRENGTH','FOCUS','ENDURANCE')),
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '24 hours',
  completed_at timestamptz,
  reward_day date,
  result jsonb not null default '{}'::jsonb,
  gps_session_id uuid references public.gps_sessions(id),
  storage_path text,
  check (status <> 'COMPLETED' or (completed_at is not null and reward_day is not null))
);
create unique index class_special_one_active on public.class_special_sessions(user_id) where status='ACTIVE';
create unique index class_special_one_daily_reward on public.class_special_sessions(user_id,reward_day) where status='COMPLETED';
create unique index class_special_one_gps_receipt on public.class_special_sessions(gps_session_id) where gps_session_id is not null;
create index class_special_history on public.class_special_sessions(user_id,started_at desc);
alter table public.class_special_sessions enable row level security;
revoke all on public.class_special_sessions from anon,authenticated;
grant select on public.class_special_sessions to authenticated;
create policy class_special_owner_read on public.class_special_sessions for select to authenticated
  using (user_id=(select auth.uid()));

-- Keep large private clips separate from the existing image proof bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('class-special-clips','class-special-clips',false,36700160,array['video/webm','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy class_special_clip_read on storage.objects for select to authenticated
  using (bucket_id='class-special-clips' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy class_special_clip_upload on storage.objects for insert to authenticated
  with check (bucket_id='class-special-clips' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.class_special_sessions s where s.user_id=(select auth.uid())
      and s.id::text=(storage.foldername(name))[2] and s.class='COMMANDER' and s.status='ACTIVE' and s.expires_at>now()));
create policy class_special_clip_delete on storage.objects for delete to authenticated
  using (bucket_id='class-special-clips' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.system_class_special_state_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_class text; v_policy jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select upper(class) into v_class from public.profiles where id=v_user;
  if v_class is null then raise exception 'PROFILE_NOT_READY'; end if;
  v_policy:=case v_class
    when 'COMMANDER' then jsonb_build_object('title','COMMAND PRESENCE','target_seconds',30,'xp_reward',35,'attribute_reward','CHARISMA')
    when 'TANK' then jsonb_build_object('title','IRON LEDGER','target_seconds',0,'xp_reward',45,'attribute_reward','STRENGTH')
    when 'ASSASSIN' then jsonb_build_object('title','SILENT TARGET','target_seconds',1500,'xp_reward',40,'attribute_reward','FOCUS')
    when 'RANGER' then jsonb_build_object('title','TRAIL MARKER','target_seconds',1200,'xp_reward',40,'attribute_reward','ENDURANCE')
    else jsonb_build_object('title','THE GRAND ARCHIVE','route','archive') end;
  return jsonb_build_object('class',v_class,'policy',v_policy,'server_now',clock_timestamp(),
    'session',(select to_jsonb(s) from public.class_special_sessions s where s.user_id=v_user and s.class=v_class and s.status='ACTIVE' and s.expires_at>clock_timestamp()),
    'completed_today',(select to_jsonb(s) from public.class_special_sessions s where s.user_id=v_user and s.status='COMPLETED' and s.reward_day=(clock_timestamp() at time zone 'UTC')::date),
    'recent',coalesce((select jsonb_agg(to_jsonb(h)) from (select id,class,title,completed_at,result,xp_reward,attribute_reward from public.class_special_sessions where user_id=v_user and class=v_class and status='COMPLETED' order by completed_at desc limit 5) h),'[]'::jsonb),
    'gps_candidate',(select jsonb_build_object('id',g.id,'distance_km',g.distance_km,'duration_seconds',g.duration_seconds)
      from public.gps_sessions g join public.class_special_sessions s on s.user_id=g.user_id
      and g.metadata->>'mission_source_id'=s.id::text where s.user_id=v_user and s.class=v_class and s.status='ACTIVE'
      and g.gps_verified and g.duration_seconds>=s.target_seconds and g.distance_km>=0.2 and g.started_at>=s.started_at
      order by g.ended_at desc limit 1));
end; $$;

create or replace function public.system_start_class_special_v1(p_class text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_class text; v_state jsonb; v_policy jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select upper(class) into v_class from public.profiles where id=v_user for update;
  if v_class is null then raise exception 'PROFILE_NOT_READY'; end if;
  if v_class is distinct from upper(p_class) then raise exception 'CLASS_CHANGED_REFRESH'; end if;
  if v_class='MAGE' then raise exception 'USE_THE_GRAND_ARCHIVE'; end if;
  v_state:=public.system_class_special_state_v1();
  if v_state->'completed_today'<>'null'::jsonb then return v_state; end if;
  update public.class_special_sessions set status='CANCELLED' where user_id=v_user and status='ACTIVE'
    and (class<>v_class or expires_at<=clock_timestamp());
  if v_state->'session'<>'null'::jsonb then return v_state; end if;
  v_policy:=v_state->'policy';
  insert into public.class_special_sessions(user_id,class,title,target_seconds,xp_reward,attribute_reward)
    values(v_user,v_class,v_policy->>'title',(v_policy->>'target_seconds')::integer,(v_policy->>'xp_reward')::integer,v_policy->>'attribute_reward');
  return public.system_class_special_state_v1();
end; $$;

create or replace function public.system_cancel_class_special_v1(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id=v_user for update;
  if not exists(select 1 from public.class_special_sessions where id=p_session_id and user_id=v_user) then raise exception 'SPECIAL_SESSION_NOT_FOUND'; end if;
  update public.class_special_sessions set status='CANCELLED' where id=p_session_id and user_id=v_user and status='ACTIVE';
  return public.system_class_special_state_v1();
end; $$;

create or replace function public.system_complete_class_special_v1(p_session_id uuid,p_result jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_class text; v_s public.class_special_sessions;
  v_elapsed numeric; v_day date:=(clock_timestamp() at time zone 'UTC')::date;
  v_result jsonb:='{}'::jsonb; v_gps public.gps_sessions; v_path text; v_object storage.objects;
  v_duration numeric; v_row jsonb; v_sets jsonb:='[]'::jsonb; v_reps integer; v_load numeric;
  v_note text:=trim(coalesce(p_result->>'reflection','')); v_receipt jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select upper(class) into v_class from public.profiles where id=v_user for update;
  if v_class is null then raise exception 'PROFILE_NOT_READY'; end if;
  select * into v_s from public.class_special_sessions where id=p_session_id and user_id=v_user for update;
  if not found then raise exception 'SPECIAL_SESSION_NOT_FOUND'; end if;
  if v_s.status='COMPLETED' then
    return jsonb_build_object('session',to_jsonb(v_s),'reward_awarded',false,'server_now',clock_timestamp());
  end if;
  if v_s.class<>v_class then raise exception 'CLASS_CHANGED_REFRESH'; end if;
  if v_s.status<>'ACTIVE' then raise exception 'SPECIAL_SESSION_CANCELLED'; end if;
  if v_s.expires_at<=clock_timestamp() then raise exception 'SPECIAL_SESSION_EXPIRED'; end if;
  if exists(select 1 from public.class_special_sessions where user_id=v_user and reward_day=v_day and status='COMPLETED') then raise exception 'SPECIAL_ALREADY_COMPLETED_TODAY'; end if;
  if jsonb_typeof(p_result) is distinct from 'object' or octet_length(p_result::text)>16384 then raise exception 'INVALID_SPECIAL_RESULT'; end if;
  v_elapsed:=extract(epoch from clock_timestamp()-v_s.started_at);
  if v_elapsed<v_s.target_seconds then raise exception 'SPECIAL_TIMER_IN_PROGRESS'; end if;
  if v_s.class in ('COMMANDER','TANK','ASSASSIN') and length(v_note) not between 20 and 2000 then raise exception 'REFLECTION_REQUIRES_20_TO_2000_CHARACTERS'; end if;

  if v_s.class='COMMANDER' then
    if coalesce(p_result->>'duration_seconds','') !~ '^\d+(\.\d+)?$' then raise exception 'VIDEO_DURATION_INVALID'; end if;
    v_duration:=(p_result->>'duration_seconds')::numeric;
    if v_duration<30 or v_duration>65 or v_duration>v_elapsed+1 then raise exception 'RECORD_FOR_30_TO_60_SECONDS'; end if;
    v_path:=p_result->>'storage_path';
    if v_path is null or split_part(v_path,'/',1)<>v_user::text or split_part(v_path,'/',2)<>v_s.id::text then raise exception 'VIDEO_OWNER_MISMATCH'; end if;
    select * into v_object from storage.objects where bucket_id='class-special-clips' and name=v_path;
    if not found or v_object.created_at<v_s.started_at then raise exception 'PRIVATE_VIDEO_NOT_UPLOADED'; end if;
    if coalesce(v_object.metadata->>'mimetype','') not in ('video/webm','video/mp4') or coalesce((v_object.metadata->>'size')::bigint,0) not between 1 and 36700160 then raise exception 'VIDEO_FILE_INVALID'; end if;
    v_result:=jsonb_build_object('reflection',v_note,'duration_seconds',v_duration,'verification','RECORDED_PRACTICE','eye_contact_assessed',false);
  elsif v_s.class='TANK' then
    if length(trim(coalesce(p_result->>'exercise',''))) not between 3 and 120 then raise exception 'EXERCISE_REQUIRED'; end if;
    if jsonb_typeof(p_result->'sets') is distinct from 'array' then raise exception 'RECORD_AT_LEAST_3_SETS'; end if;
    if jsonb_array_length(p_result->'sets') not between 3 and 12 then raise exception 'RECORD_3_TO_12_SETS'; end if;
    for v_row in select value from jsonb_array_elements(p_result->'sets') loop
      if coalesce(v_row->>'reps','') !~ '^\d{1,3}$' or coalesce(v_row->>'load_kg','') !~ '^\d{1,3}(\.\d{1,2})?$' then raise exception 'INVALID_SET_VALUES'; end if;
      v_reps:=(v_row->>'reps')::integer; v_load:=(v_row->>'load_kg')::numeric;
      if v_reps not between 1 and 100 or v_load not between 0 and 500 then raise exception 'INVALID_SET_VALUES'; end if;
      v_sets:=v_sets||jsonb_build_array(jsonb_build_object('reps',v_reps,'load_kg',v_load));
    end loop;
    v_result:=jsonb_build_object('exercise',trim(p_result->>'exercise'),'sets',v_sets,'reflection',v_note,'verification','SELF_REPORTED_SETS');
  elsif v_s.class='ASSASSIN' then
    v_result:=jsonb_build_object('reflection',v_note,'elapsed_seconds',floor(v_elapsed),'verification','SERVER_TIMER_AND_RESULT');
  elsif v_s.class='RANGER' then
    begin
      select * into v_gps from public.gps_sessions where id=(p_result->>'gps_session_id')::uuid and user_id=v_user;
    exception when invalid_text_representation then raise exception 'GPS_SESSION_REQUIRED'; end;
    if v_gps.id is null or not v_gps.gps_verified or v_gps.duration_seconds<v_s.target_seconds or v_gps.distance_km<0.2
      or v_gps.started_at<v_s.started_at or v_gps.ended_at is null
      or extract(epoch from v_gps.ended_at-v_gps.started_at)<v_s.target_seconds
      or v_gps.metadata->>'mission_source_id' is distinct from v_s.id::text
      or jsonb_array_length(v_gps.route)<2 then raise exception 'COMPLETE_THE_LINKED_20_MINUTE_GPS_ROUTE'; end if;
    v_result:=jsonb_build_object('distance_km',v_gps.distance_km,'duration_seconds',v_gps.duration_seconds,'verification','GPS_ROUTE');
  end if;

  v_receipt:=jsonb_build_object('class',v_s.class,'special_session_id',v_s.id,'verification',v_result->>'verification');
  perform public.system_award_xp(v_s.xp_reward,'CLASS_SPECIAL',v_s.title,v_receipt);
  perform public.system_add_attribute(v_s.attribute_reward,1,'CLASS_SPECIAL',v_s.title,v_receipt);
  update public.class_special_sessions set status='COMPLETED',completed_at=clock_timestamp(),reward_day=v_day,
    result=v_result,gps_session_id=v_gps.id,storage_path=v_path where id=v_s.id returning * into v_s;
  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
    values(v_user,'CLASS_SPECIAL_COMPLETE',v_s.title,'Class practice completed. '||replace(v_result->>'verification','_',' '),
      'CLASS_SPECIAL',v_s.id::text,v_s.xp_reward,v_receipt);
  return jsonb_build_object('session',to_jsonb(v_s),'reward_awarded',true,'server_now',clock_timestamp());
end; $$;

revoke all on function public.system_class_special_state_v1() from public,anon;
revoke all on function public.system_start_class_special_v1(text) from public,anon;
revoke all on function public.system_cancel_class_special_v1(uuid) from public,anon;
revoke all on function public.system_complete_class_special_v1(uuid,jsonb) from public,anon;
grant execute on function public.system_class_special_state_v1() to authenticated;
grant execute on function public.system_start_class_special_v1(text) to authenticated;
grant execute on function public.system_cancel_class_special_v1(uuid) to authenticated;
grant execute on function public.system_complete_class_special_v1(uuid,jsonb) to authenticated;

-- Exclude a previous class directive after switching classes.
CREATE OR REPLACE FUNCTION public.system_daily_command_brief_v1(p_assigned_for date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_for_date date := coalesce(p_assigned_for, current_date);
  v_active_must public.user_quests;
  v_active_class public.user_quests;
  v_class_library public.quest_library;
  v_credits integer := 0;
  v_must_payload jsonb;
  v_class_payload jsonb;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user;

  if not found then
    raise exception 'PROFILE_NOT_READY';
  end if;

  select * into v_active_must
  from public.user_quests uq
  where uq.user_id = v_user
    and uq.quest_type = 'MUST'
    and uq.assigned_for = v_for_date
    and uq.status = 'ACCEPTED'
    and (uq.expires_at is null or uq.expires_at >= now())
  order by uq.expires_at asc nulls last, uq.created_at asc
  limit 1;

  if found then
    v_must_payload := jsonb_build_object(
      'status', 'ACTIVE',
      'title', v_active_must.title_snapshot,
      'objective', v_active_must.objective_snapshot,
      'category', v_active_must.category,
      'xp', v_active_must.xp_reward,
      'penalty', v_active_must.xp_penalty,
      'expires_at', v_active_must.expires_at,
      'quest_id', v_active_must.id
    );
  else
    v_must_payload := jsonb_build_object(
      'status', 'NONE',
      'title', 'NO MUST DIRECTIVE ACTIVE',
      'objective', 'Open the Quest Board when you are ready to accept a 24-hour directive.',
      'xp', 0,
      'penalty', 0
    );
  end if;

  select * into v_active_class
  from public.user_quests uq
  where uq.user_id = v_user
    and uq.quest_type = 'CLASS'
    and exists(select 1 from public.quest_library current_quest where current_quest.id=uq.quest_id and upper(v_profile.class)=any(current_quest.class_affinity))
    and uq.assigned_for = v_for_date
    and uq.status in ('ASSIGNED', 'ACCEPTED', 'COMPLETED')
  order by
    case uq.status when 'ASSIGNED' then 0 when 'ACCEPTED' then 1 else 2 end,
    uq.created_at asc
  limit 1;

  if found then
    select * into v_class_library
    from public.quest_library q
    where q.id = v_active_class.quest_id;

    v_class_payload := jsonb_build_object(
      'status', case when v_active_class.status = 'COMPLETED' then 'COMPLETE' else 'READY' end,
      'code', coalesce(v_class_library.code, v_active_class.metadata->>'library_code', ''),
      'title', v_active_class.title_snapshot,
      'objective', v_active_class.objective_snapshot,
      'message', coalesce(v_class_library.system_message, 'Class alignment directive selected from the live rotation.'),
      'category', v_active_class.category,
      'xp', v_active_class.xp_reward,
      'attribute', v_active_class.attribute_reward,
      'attribute_delta', v_active_class.attribute_delta,
      'proof_type', coalesce(v_class_library.metadata->>'proof_type', 'HONOR'),
      'rotation_window_days', 7,
      'rotation_mode', 'ASSIGNED_TODAY'
    );
  else
    select * into v_class_library
    from public.quest_library q
    where q.active = true
      and q.quest_type = 'CLASS'
      and q.min_level <= coalesce(v_profile.level, 1)
      and upper(v_profile.class) = any(q.class_affinity)
      and not exists (
        select 1
        from public.user_quests uq
        where uq.user_id = v_user
          and uq.quest_id = q.id
          and uq.assigned_for >= v_for_date - 6
      )
    order by md5(v_user::text || ':' || v_for_date::text || ':' || q.id::text)
    limit 1;

    if not found then
      select * into v_class_library
      from public.quest_library q
      where q.active = true
        and q.quest_type = 'CLASS'
        and q.min_level <= coalesce(v_profile.level, 1)
        and upper(v_profile.class) = any(q.class_affinity)
      order by md5(v_user::text || ':' || v_for_date::text || ':' || q.id::text)
      limit 1;
    end if;

    if found then
      v_class_payload := jsonb_build_object(
        'status', 'READY',
        'code', v_class_library.code,
        'title', v_class_library.title,
        'objective', v_class_library.objective,
        'message', coalesce(v_class_library.system_message, 'Class alignment directive selected from the live rotation.'),
        'category', v_class_library.category,
        'xp', v_class_library.xp_reward,
        'attribute', v_class_library.attribute_reward,
        'attribute_delta', v_class_library.attribute_delta,
        'proof_type', coalesce(v_class_library.metadata->>'proof_type', 'HONOR'),
        'rotation_window_days', 7,
        'rotation_mode', 'UNUSED_7_DAY_ROTATION'
      );
    else
      v_class_payload := jsonb_build_object(
        'status', 'NONE',
        'title', 'CLASS DIRECTIVE UNAVAILABLE',
        'objective', 'The class catalogue is synchronizing. Retry without resetting progression.',
        'xp', 0,
        'rotation_window_days', 7
      );
    end if;
  end if;

  select coalesce(sum(greatest(0, credit.credits_awarded - credit.credits_spent)), 0)
  into v_credits
  from public.attribute_credit_ledger credit
  where credit.user_id = v_user;

  return jsonb_build_object(
    'status', 'READY',
    'assigned_for', v_for_date,
    'generated_at', now(),
    'must_directive', v_must_payload,
    'class_directive', v_class_payload,
    'progress', jsonb_build_object(
      'unspent_credits', v_credits,
      'level', v_profile.level,
      'streak', v_profile.streak,
      'class', v_profile.class
    ),
    'rotation', jsonb_build_object(
      'window_days', 7,
      'rule', 'NO_REPEAT_WHEN_A_COMPATIBLE_UNUSED_DIRECTIVE_EXISTS'
    )
  );
end;
$function$;

-- Do not resume an incompatible timer after a class change.
CREATE OR REPLACE FUNCTION public.system_start_timed_workout_v1(p_workout_id bigint, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

    if v_elapsed_seconds <= v_timer.target_seconds * 2 and public.system_workout_available(v_timer.workout_id) then
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
