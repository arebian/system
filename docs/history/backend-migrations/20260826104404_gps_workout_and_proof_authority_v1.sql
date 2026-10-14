create or replace function public.system_finish_gps_session(p_session_id uuid,p_distance_km numeric,p_duration_seconds integer,p_route jsonb default '[]'::jsonb,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_session public.gps_sessions; v_verified boolean; v_pace numeric; v_damage integer:=0; v_boss public.boss_quests; v_proof_id bigint;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_session from public.gps_sessions where id=p_session_id and user_id=v_user for update;
 if not found then raise exception 'GPS_SESSION_NOT_FOUND'; end if;
 if v_session.status='COMPLETED' then raise exception 'GPS_SESSION_ALREADY_COMPLETED'; end if;
 v_verified:=(v_session.target_distance_km is null or p_distance_km>=v_session.target_distance_km) and (v_session.target_duration_seconds is null or p_duration_seconds>=v_session.target_duration_seconds);
 v_pace:=case when p_distance_km>0 then p_duration_seconds::numeric/p_distance_km else null end;
 update public.gps_sessions set status=case when v_verified then 'COMPLETED' else 'ENDED_EARLY' end,distance_km=greatest(0,coalesce(p_distance_km,0)),duration_seconds=greatest(0,coalesce(p_duration_seconds,0)),pace_seconds_per_km=v_pace,route=coalesce(p_route,'[]'::jsonb),gps_verified=v_verified,ended_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb) where id=v_session.id returning * into v_session;
 if v_verified then
   v_damage:=greatest(8,least(40,round(8+coalesce(p_distance_km,0)*5+coalesce(p_duration_seconds,0)::numeric/900)::integer));
   begin select * into v_boss from public.system_damage_active_boss(v_damage,'GPS',v_session.id::text,v_session.activity_type,jsonb_build_object('distance_km',v_session.distance_km,'duration_seconds',v_session.duration_seconds)); exception when others then if sqlerrm<>'NO_ACTIVE_BOSS' then raise; end if; v_boss:=null; end;
   if v_session.quest_id is not null then begin perform public.system_complete_quest(v_session.quest_id,jsonb_build_object('gps_session_id',v_session.id)); exception when others then if sqlerrm not in ('QUEST_ALREADY_COMPLETED','QUEST_ALREADY_FAILED','QUEST_EXPIRED') then raise; end if; end; end if;
   insert into public.proof_records(user_id,title,proof_type,related_event_type,related_event_id,metadata,verification_status,verified_at,verification_source,verification_detail)
   values(v_user,v_session.activity_type||' GPS PROOF','GPS','GPS',v_session.id::text,jsonb_build_object('distance_km',v_session.distance_km,'duration_seconds',v_session.duration_seconds),'VERIFIED',now(),'BACKEND_AUTO',jsonb_build_object('reason','GPS_SESSION_VERIFIED')) returning id into v_proof_id;
 end if;
 insert into public.journey_events(user_id,event_type,title,detail,source,source_id,metadata) values(v_user,case when v_verified then 'GPS_VERIFIED' else 'GPS_ENDED_EARLY' end,v_session.activity_type,round(v_session.distance_km,2)::text||' KM • '||v_session.duration_seconds::text||' SEC','GPS',v_session.id::text,jsonb_build_object('verified',v_verified,'boss_damage',case when v_boss.id is null then 0 else v_damage end,'proof_id',v_proof_id));
 return jsonb_build_object('session',to_jsonb(v_session),'verified',v_verified,'boss',case when v_boss.id is null then null else to_jsonb(v_boss) end,'boss_damage',case when v_boss.id is null then 0 else v_damage end,'proof_id',v_proof_id);
end $$;

create or replace function public.system_finish_gps_workout(p_session_id uuid,p_workout_id bigint,p_distance_km numeric,p_duration_seconds integer,p_route jsonb default '[]'::jsonb,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_gps public.gps_sessions; v_workout public.workout_templates; v_ws public.user_workout_sessions; v_profile public.profiles; v_verified boolean; v_pace numeric; v_attr text; v_attr_delta integer:=0; v_damage integer:=0; v_boss public.boss_quests; v_proof_id bigint;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.system_workout_available(p_workout_id) then raise exception 'WORKOUT_LOCKED_OR_UNAVAILABLE'; end if;
 select * into v_gps from public.gps_sessions where id=p_session_id and user_id=v_user for update;
 if not found then raise exception 'GPS_SESSION_NOT_FOUND'; end if;
 if v_gps.status='COMPLETED' then raise exception 'GPS_SESSION_ALREADY_COMPLETED'; end if;
 select * into v_workout from public.workout_templates where id=p_workout_id and active=true;
 if not found then raise exception 'WORKOUT_NOT_FOUND'; end if;
 v_verified:=(v_gps.target_distance_km is null or p_distance_km>=v_gps.target_distance_km) and (v_gps.target_duration_seconds is null or p_duration_seconds>=v_gps.target_duration_seconds);
 v_pace:=case when p_distance_km>0 then p_duration_seconds::numeric/p_distance_km else null end;
 update public.gps_sessions set status=case when v_verified then 'COMPLETED' else 'ENDED_EARLY' end,distance_km=greatest(0,coalesce(p_distance_km,0)),duration_seconds=greatest(0,coalesce(p_duration_seconds,0)),pace_seconds_per_km=v_pace,route=coalesce(p_route,'[]'::jsonb),gps_verified=v_verified,ended_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('workout_id',p_workout_id) where id=v_gps.id returning * into v_gps;
 if not v_verified then return jsonb_build_object('verified',false,'session',to_jsonb(v_gps),'reason','TARGET_NOT_REACHED'); end if;
 if exists(select 1 from public.user_workout_sessions where user_id=v_user and workout_id=p_workout_id and metadata->>'gps_session_id'=v_gps.id::text) then raise exception 'GPS_WORKOUT_ALREADY_REWARDED'; end if;
 insert into public.user_workout_sessions(user_id,workout_id,workout_name_snapshot,status,started_at,completed_at,duration_seconds,metadata) values(v_user,v_workout.id,v_workout.name,'COMPLETED',v_gps.started_at,now(),p_duration_seconds,jsonb_build_object('gps_session_id',v_gps.id)||coalesce(p_metadata,'{}'::jsonb)) returning * into v_ws;
 select * into v_profile from public.system_award_xp(v_workout.xp_reward,'WORKOUT',v_workout.name,jsonb_build_object('workout_id',v_workout.id,'session_id',v_ws.id,'gps_session_id',v_gps.id));
 case upper(v_workout.category) when 'STRENGTH' then v_attr:='STRENGTH';v_attr_delta:=2; when 'LEGS' then v_attr:='ENDURANCE';v_attr_delta:=2; when 'SPEED' then v_attr:='SPEED';v_attr_delta:=2; when 'ENDURANCE' then v_attr:='ENDURANCE';v_attr_delta:=2; when 'CORE' then v_attr:='STRENGTH';v_attr_delta:=1; else if array_length(v_workout.focus,1)>0 and upper(v_workout.focus[1]) in ('STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY') then v_attr:=upper(v_workout.focus[1]);v_attr_delta:=1; end if; end case;
 if v_attr is not null and v_attr_delta>0 then perform public.system_add_attribute(v_attr,v_attr_delta,'WORKOUT',v_workout.name,jsonb_build_object('workout_id',v_workout.id,'session_id',v_ws.id,'gps_session_id',v_gps.id)); end if;
 v_damage:=greatest(8,least(40,round(8+coalesce(p_distance_km,0)*5+coalesce(p_duration_seconds,0)::numeric/900)::integer));
 begin select * into v_boss from public.system_damage_active_boss(v_damage,'GPS_WORKOUT',v_gps.id::text,v_workout.name,jsonb_build_object('workout_id',v_workout.id,'session_id',v_ws.id)); exception when others then if sqlerrm<>'NO_ACTIVE_BOSS' then raise; end if; v_boss:=null; end;
 insert into public.proof_records(user_id,title,proof_type,related_event_type,related_event_id,metadata,verification_status,verified_at,verification_source,verification_detail) values(v_user,v_workout.name||' GPS PROOF','GPS','GPS',v_gps.id::text,jsonb_build_object('workout_id',v_workout.id,'distance_km',v_gps.distance_km,'duration_seconds',v_gps.duration_seconds),'VERIFIED',now(),'BACKEND_AUTO',jsonb_build_object('reason','GPS_WORKOUT_VERIFIED')) returning id into v_proof_id;
 insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata) values(v_user,'WORKOUT_COMPLETE',v_workout.name,'GPS workout completed and verified by backend.','WORKOUT',v_ws.id::text,v_workout.xp_reward,jsonb_build_object('gps_session_id',v_gps.id,'proof_id',v_proof_id,'boss_damage',case when v_boss.id is null then 0 else v_damage end));
 return jsonb_build_object('verified',true,'session',to_jsonb(v_gps),'workout_session',to_jsonb(v_ws),'profile',to_jsonb(v_profile),'attribute',v_attr,'attribute_delta',v_attr_delta,'boss',case when v_boss.id is null then null else to_jsonb(v_boss) end,'boss_damage',case when v_boss.id is null then 0 else v_damage end,'proof_id',v_proof_id);
end $$;
revoke all on function public.system_finish_gps_workout(uuid,bigint,numeric,integer,jsonb,jsonb) from public,anon;
grant execute on function public.system_finish_gps_workout(uuid,bigint,numeric,integer,jsonb,jsonb) to authenticated,service_role;
