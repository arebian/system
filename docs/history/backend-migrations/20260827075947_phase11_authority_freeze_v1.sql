create or replace function public.system_sync_profile_identity(
  p_name text,
  p_age integer default null,
  p_gender text default null,
  p_class text default 'COMMANDER',
  p_fingerprint text default null,
  p_profile_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='public','auth' as $$
declare v_user uuid:=auth.uid(); v_existing public.profiles; v_class text:=upper(coalesce(nullif(trim(p_class),''),'COMMANDER')); v_safe jsonb:=coalesce(p_profile_data,'{}'::jsonb)-'level'-'xp'-'streak'-'momentum'-'attributes'-'bossQuests'-'masteredSkills'-'rewards'-'customInventory'-'cloudAchievements'-'cloudTitles'-'equippedTitle';
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if v_class not in ('COMMANDER','TANK','RANGER','ASSASSIN','MAGE') then raise exception 'INVALID_CLASS'; end if;
 select * into v_existing from public.profiles where id=v_user for update;
 if not found then
   insert into public.profiles(id,name,age,gender,class,level,xp,streak,momentum,fingerprint,profile_data)
   values(v_user,left(coalesce(nullif(trim(p_name),''),'PLAYER'),80),p_age,p_gender,v_class,1,0,0,0,p_fingerprint,v_safe) returning * into v_existing;
   insert into public.attributes(user_id) values(v_user) on conflict(user_id) do nothing;
 else
   update public.profiles set name=left(coalesce(nullif(trim(p_name),''),name),80),age=p_age,gender=p_gender,fingerprint=coalesce(p_fingerprint,fingerprint),profile_data=v_safe,updated_at=now() where id=v_user returning * into v_existing;
 end if;
 return jsonb_build_object('profile',to_jsonb(v_existing));
end $$;

create or replace function public.system_complete_goal_by_title(p_title text) returns jsonb language plpgsql security definer set search_path='public','auth' as $$
declare v_user uuid:=auth.uid(); v_goal public.goals; v_profile public.profiles; v_reward text; v_attr text;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_goal from public.goals where user_id=v_user and upper(title)=upper(trim(p_title)) and status<>'COMPLETE' order by created_at desc limit 1 for update;
 if not found then raise exception 'GOAL_NOT_FOUND'; end if;
 if coalesce(v_goal.current_value,0)<coalesce(v_goal.target_value,0) then raise exception 'GOAL_TARGET_NOT_REACHED'; end if;
 update public.goals set status='COMPLETE',completed_at=coalesce(completed_at,now()) where id=v_goal.id returning * into v_goal;
 select * into v_profile from public.system_award_xp(coalesce(v_goal.xp_reward,300),'GOAL',v_goal.title,jsonb_build_object('goal_id',v_goal.id));
 v_attr:=upper(coalesce(v_goal.category,''));
 if v_attr in ('STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY') then perform public.system_add_attribute(v_attr,2,'GOAL',v_goal.title,jsonb_build_object('goal_id',v_goal.id)); end if;
 v_reward:=coalesce(nullif(v_goal.reward_name,''),coalesce(nullif(v_attr,''),'SYSTEM')||' MILESTONE REWARD');
 if not exists(select 1 from public.rewards where user_id=v_user and source='GOAL:'||v_goal.id::text) then insert into public.rewards(user_id,name,category,source,status,metadata) values(v_user,v_reward,coalesce(nullif(v_goal.category,''),'OTHER'),'GOAL:'||v_goal.id::text,'UNCLAIMED',jsonb_build_object('goal_title',v_goal.title)); end if;
 insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata) values(v_user,'GOAL_COMPLETE',v_goal.title,'Major goal completed by authoritative backend.','GOAL',v_goal.id::text,coalesce(v_goal.xp_reward,300),jsonb_build_object('reward',v_reward));
 return jsonb_build_object('goal',to_jsonb(v_goal),'profile',to_jsonb(v_profile),'reward_name',v_reward);
end $$;

insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,failure_xp_penalty,duration_minutes,min_level,health_value,frequency,active,metadata)
select 'event-15-minute-window','THE 15 MINUTE WINDOW','Choose one small unfinished task and finish it completely.','FOCUS','RARE','HARD',120,0,15,1,2,'RARE',true,jsonb_build_object('legacy_event',true) where not exists(select 1 from public.quest_library where code='event-15-minute-window');
insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,failure_xp_penalty,duration_minutes,min_level,health_value,frequency,active,metadata)
select 'event-zero-distraction','ZERO DISTRACTION','Work on one meaningful task without checking another app or site.','FOCUS','RARE','HARD',150,0,20,1,3,'RARE',true,jsonb_build_object('legacy_event',true) where not exists(select 1 from public.quest_library where code='event-zero-distraction');
insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,failure_xp_penalty,duration_minutes,min_level,health_value,frequency,active,metadata)
select 'event-rapid-reset','RAPID RESET','Clean and organize your immediate environment.','RECOVERY','RARE','NORMAL',100,0,10,1,2,'RARE',true,jsonb_build_object('legacy_event',true) where not exists(select 1 from public.quest_library where code='event-rapid-reset');
insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,failure_xp_penalty,duration_minutes,min_level,health_value,frequency,active,metadata)
select 'event-quick-march','QUICK MARCH','Complete an appropriate brisk movement session.','PHYSICAL','RARE','HARD',120,0,15,1,3,'RARE',true,jsonb_build_object('legacy_event',true) where not exists(select 1 from public.quest_library where code='event-quick-march');

revoke all on function public.system_sync_profile_identity(text,integer,text,text,text,jsonb) from public,anon;
grant execute on function public.system_sync_profile_identity(text,integer,text,text,text,jsonb) to authenticated,service_role;
revoke all on function public.system_complete_goal_by_title(text) from public,anon;
grant execute on function public.system_complete_goal_by_title(text) to authenticated,service_role;
revoke insert,update,truncate,references,trigger on public.profiles from authenticated;
revoke insert,update,truncate,references,trigger on public.attributes from authenticated;
grant select,delete on public.profiles to authenticated;
grant select,delete on public.attributes to authenticated;
