create or replace function public.system_accept_quest_by_title(p_title text,p_duration_seconds integer default 86400,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_profile public.profiles; v_lib public.quest_library; v_uq public.user_quests; v_today date:=current_date; v_duration int;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 v_duration:=least(greatest(coalesce(p_duration_seconds,86400),60),86400);
 select * into v_profile from public.profiles where id=v_user;
 if not found then raise exception 'PROFILE_NOT_READY'; end if;
 select * into v_lib from public.quest_library q where q.active=true and upper(q.title)=upper(trim(p_title)) and q.quest_type='MUST' and q.min_level<=coalesce(v_profile.level,1) and (q.class_affinity is null or cardinality(q.class_affinity)=0 or upper(v_profile.class)=any(q.class_affinity)) limit 1;
 if not found then raise exception 'MUST_QUEST_NOT_AVAILABLE'; end if;
 select * into v_uq from public.user_quests where user_id=v_user and quest_id=v_lib.id and assigned_for=v_today order by created_at desc limit 1 for update;
 if found and v_uq.status='COMPLETED' then return jsonb_build_object('duplicate',true,'quest',to_jsonb(v_uq)); end if;
 if found and v_uq.status='FAILED' then raise exception 'QUEST_ALREADY_FAILED'; end if;
 if not found then
   insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,status,source,accepted_at,expires_at,xp_reward,xp_penalty,attribute_reward,attribute_delta,consequence,metadata)
   values(v_user,v_lib.id,v_today,v_lib.quest_type,v_lib.title,v_lib.objective,v_lib.category,'ACCEPTED','LEGACY_UI_ADAPTER',now(),now()+make_interval(secs=>v_duration),v_lib.xp_reward,v_lib.failure_xp_penalty,v_lib.attribute_reward,v_lib.attribute_delta,case when coalesce(v_lib.failure_xp_penalty,0)>0 then '-'||v_lib.failure_xp_penalty||' XP' else null end,jsonb_build_object('library_code',v_lib.code,'adapter','TITLE','accepted_by','SYSTEM_API')||coalesce(p_metadata,'{}'::jsonb)) returning * into v_uq;
 else
   update public.user_quests set status='ACCEPTED',accepted_at=coalesce(accepted_at,now()),expires_at=case when status='ASSIGNED' or accepted_at is null then now()+make_interval(secs=>v_duration) else expires_at end,metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),updated_at=now() where id=v_uq.id returning * into v_uq;
 end if;
 return jsonb_build_object('quest',to_jsonb(v_uq),'server_now',now());
end $$;

create or replace function public.system_apply_expired_quest_penalties()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_q record; v_count int:=0; v_total int:=0; v_applied boolean;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 for v_q in select * from public.user_quests where user_id=v_user and status='ACCEPTED' and expires_at is not null and expires_at<now() for update
 loop
   update public.user_quests set status='FAILED',failed_at=now(),updated_at=now() where id=v_q.id;
   v_applied:=false;
   if coalesce(v_q.xp_penalty,0)>0 then
     insert into public.quest_penalty_events(user_id,user_quest_id,xp_penalty,metadata) values(v_user,v_q.id,v_q.xp_penalty,jsonb_build_object('expired_at',v_q.expires_at,'quest_type',v_q.quest_type)) on conflict(user_quest_id) do nothing;
     if found then update public.profiles set xp=greatest(0,coalesce(xp,0)-v_q.xp_penalty),momentum=greatest(0,coalesce(momentum,0)-case when v_q.quest_type='MUST' then 2 else 1 end),updated_at=now() where id=v_user; v_total:=v_total+v_q.xp_penalty; v_applied:=true; end if;
   end if;
   insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata) values(v_user,'QUEST_FAILED',v_q.title_snapshot,'Quest expired before completion.','QUEST',v_q.id::text,-case when v_applied then coalesce(v_q.xp_penalty,0) else 0 end,jsonb_build_object('expires_at',v_q.expires_at,'penalty_applied',v_applied));
   v_count:=v_count+1;
 end loop;
 return jsonb_build_object('failed_quests',v_count,'xp_penalty_applied',v_total,'processed_at',now());
end $$;

revoke all on function public.system_accept_quest_by_title(text,integer,jsonb) from public,anon;
grant execute on function public.system_accept_quest_by_title(text,integer,jsonb) to authenticated,service_role;
revoke all on function public.system_apply_expired_quest_penalties() from public,anon;
grant execute on function public.system_apply_expired_quest_penalties() to authenticated,service_role;
