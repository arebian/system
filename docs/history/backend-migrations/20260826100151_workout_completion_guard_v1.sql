create or replace function public.system_complete_workout(p_workout_id bigint,p_duration_seconds integer default null,p_notes text default null,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
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
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.system_workout_available(p_workout_id) then raise exception 'WORKOUT_LOCKED_OR_UNAVAILABLE'; end if;

  select * into v_workout from public.workout_templates where id=p_workout_id and active=true;
  if not found then raise exception 'WORKOUT_NOT_FOUND'; end if;

  if p_duration_seconds is not null and (p_duration_seconds < 0 or p_duration_seconds > 43200) then
    raise exception 'INVALID_WORKOUT_DURATION';
  end if;

  select id into v_recent
  from public.user_workout_sessions
  where user_id=v_user and workout_id=p_workout_id and status='COMPLETED' and completed_at > now() - interval '30 seconds'
  order by completed_at desc limit 1;

  if v_recent is not null then raise exception 'WORKOUT_DUPLICATE_WINDOW'; end if;

  insert into public.user_workout_sessions(user_id,workout_id,workout_name_snapshot,status,started_at,completed_at,duration_seconds,notes,metadata)
  values(v_user,v_workout.id,v_workout.name,'COMPLETED',now(),now(),p_duration_seconds,p_notes,coalesce(p_metadata,'{}'::jsonb))
  returning * into v_session;

  select * into v_profile from public.system_award_xp(v_workout.xp_reward,'WORKOUT',v_workout.name,jsonb_build_object('workout_id',v_workout.id,'session_id',v_session.id));

  case upper(v_workout.category)
    when 'STRENGTH' then v_attr:='STRENGTH'; v_attr_delta:=2;
    when 'LEGS' then v_attr:='ENDURANCE'; v_attr_delta:=2;
    when 'SPEED' then v_attr:='SPEED'; v_attr_delta:=2;
    when 'ENDURANCE' then v_attr:='ENDURANCE'; v_attr_delta:=2;
    when 'CORE' then v_attr:='STRENGTH'; v_attr_delta:=1;
    else
      if array_length(v_workout.focus,1)>0 and upper(v_workout.focus[1]) in ('STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY') then
        v_attr:=upper(v_workout.focus[1]); v_attr_delta:=1;
      end if;
  end case;

  if v_attr is not null and v_attr_delta>0 then
    perform public.system_add_attribute(v_attr,v_attr_delta,'WORKOUT',v_workout.name,jsonb_build_object('workout_id',v_workout.id,'session_id',v_session.id));
  end if;

  v_damage:=greatest(8,least(34,round(8+v_workout.xp_reward::numeric/8)::integer));
  begin
    select * into v_boss from public.system_damage_active_boss(v_damage,'WORKOUT',v_session.id::text,v_workout.name,jsonb_build_object('workout_id',v_workout.id));
  exception when others then
    if sqlerrm <> 'NO_ACTIVE_BOSS' then raise; end if;
    v_boss:=null;
  end;

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values(v_user,'WORKOUT_COMPLETE',v_workout.name,'Workout completed and progression verified by backend.','WORKOUT',v_session.id::text,v_workout.xp_reward,jsonb_build_object('boss_damage',case when v_boss.id is null then 0 else v_damage end));

  return jsonb_build_object('session',to_jsonb(v_session),'profile',to_jsonb(v_profile),'boss',case when v_boss.id is null then null else to_jsonb(v_boss) end,'boss_damage',case when v_boss.id is null then 0 else v_damage end,'attribute',v_attr,'attribute_delta',v_attr_delta);
end $$;
revoke all on function public.system_complete_workout(bigint,integer,text,jsonb) from public,anon;
grant execute on function public.system_complete_workout(bigint,integer,text,jsonb) to authenticated,service_role;
