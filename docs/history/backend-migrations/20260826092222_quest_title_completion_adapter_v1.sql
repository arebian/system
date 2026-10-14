insert into public.quest_library(code,title,objective,system_message,category,quest_type,difficulty,class_affinity,attribute_reward,attribute_delta,xp_reward,failure_xp_penalty,duration_minutes,min_level,health_value,procrastination_tag,frequency,active,metadata)
values
('class_assassin_precision_window','PRECISION WINDOW','Spend 25 uninterrupted minutes on one objective.','Today the target is precision.','CLASS','CLASS','NORMAL',array['ASSASSIN'],'SPEED',1,35,0,25,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_assassin_shadow_movement','SHADOW MOVEMENT','Complete 15 minutes of balance, mobility or controlled footwork.','Move quietly. Move deliberately.','CLASS','CLASS','NORMAL',array['ASSASSIN'],'SPEED',1,30,0,15,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_tank_fortress','FORTRESS','Complete three controlled core-strength sets.','Build the structure that carries everything else.','CLASS','CLASS','NORMAL',array['TANK'],'STRENGTH',1,30,0,20,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_tank_iron_patience','IRON PATIENCE','Train using slow controlled repetitions.','Power also requires patience.','CLASS','CLASS','NORMAL',array['TANK'],'STRENGTH',1,35,0,20,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_mage_memory_forge','MEMORY FORGE','Learn 5 things and recall them later without checking.','Memory converts information into power.','CLASS','CLASS','NORMAL',array['MAGE'],'INTELLIGENCE',1,40,0,25,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_mage_deep_work_protocol','DEEP WORK PROTOCOL','Work on one meaningful task for 40 minutes with your phone away.','One task. One mind.','CLASS','CLASS','NORMAL',array['MAGE'],'INTELLIGENCE',1,45,0,40,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_ranger_open_territory','OPEN TERRITORY','Spend at least 20 minutes moving outdoors.','Expand the map.','CLASS','CLASS','NORMAL',array['RANGER'],'ENDURANCE',1,30,0,20,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_ranger_steady_pace','STEADY PACE','Complete continuous moderate movement without unnecessary stops.','You do not need to be fast. Keep going.','CLASS','CLASS','NORMAL',array['RANGER'],'ENDURANCE',1,40,0,25,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_commander_clear_field','CLEAR THE FIELD','Remove one source of disorder from your environment.','Order improves execution.','CLASS','CLASS','NORMAL',array['COMMANDER'],'DISCIPLINE',1,30,0,15,1,2,null,'ON_DEMAND',true,'{}'::jsonb),
('class_commander_tactical_hour','TACTICAL HOUR','Spend one uninterrupted hour on your highest-value responsibility.','Protect the objective.','CLASS','CLASS','NORMAL',array['COMMANDER'],'DISCIPLINE',1,50,0,60,1,2,null,'ON_DEMAND',true,'{}'::jsonb)
on conflict(code) do update set title=excluded.title,objective=excluded.objective,system_message=excluded.system_message,category=excluded.category,quest_type=excluded.quest_type,difficulty=excluded.difficulty,class_affinity=excluded.class_affinity,attribute_reward=excluded.attribute_reward,attribute_delta=excluded.attribute_delta,xp_reward=excluded.xp_reward,duration_minutes=excluded.duration_minutes,active=true;

create or replace function public.system_complete_quest_by_title(p_title text,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare
 v_user uuid:=auth.uid(); v_profile public.profiles; v_lib public.quest_library; v_uq public.user_quests; v_result jsonb; v_today date:=current_date;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_profile from public.profiles where id=v_user;
 if not found then raise exception 'PROFILE_NOT_READY'; end if;

 select * into v_lib from public.quest_library q
 where q.active=true and upper(q.title)=upper(trim(p_title)) and q.min_level<=coalesce(v_profile.level,1)
   and (q.class_affinity is null or cardinality(q.class_affinity)=0 or upper(v_profile.class)=any(q.class_affinity))
 order by case when upper(v_profile.class)=any(coalesce(q.class_affinity,array[]::text[])) then 0 else 1 end,
          case q.quest_type when 'MUST' then 0 when 'CLASS' then 1 when 'DAILY' then 2 else 3 end
 limit 1;
 if not found then raise exception 'QUEST_NOT_AVAILABLE'; end if;

 select * into v_uq from public.user_quests
 where user_id=v_user and quest_id=v_lib.id and assigned_for=v_today
 order by created_at desc limit 1;

 if found and v_uq.status='COMPLETED' then
   return jsonb_build_object('duplicate',true,'quest',to_jsonb(v_uq),'profile',to_jsonb(v_profile));
 end if;

 if not found then
   insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,status,source,expires_at,xp_reward,xp_penalty,attribute_reward,attribute_delta,consequence,metadata)
   values(v_user,v_lib.id,v_today,v_lib.quest_type,v_lib.title,v_lib.objective,v_lib.category,'ASSIGNED','LEGACY_UI_ADAPTER',((v_today+1)::timestamp at time zone 'UTC'),v_lib.xp_reward,v_lib.failure_xp_penalty,v_lib.attribute_reward,v_lib.attribute_delta,case when coalesce(v_lib.failure_xp_penalty,0)>0 then '-'||v_lib.failure_xp_penalty||' XP' else null end,jsonb_build_object('library_code',v_lib.code,'adapter','TITLE'))
   returning * into v_uq;
 end if;

 v_result:=public.system_complete_quest(v_uq.id,coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('completion_adapter','TITLE'));

 update public.profiles
 set momentum=coalesce(momentum,0)+case when v_lib.quest_type='MUST' then 2 else 1 end,
     streak=coalesce(streak,0)+case when v_lib.quest_type='MUST' then 0 else 1 end,
     updated_at=now()
 where id=v_user;

 select * into v_profile from public.profiles where id=v_user;
 return v_result||jsonb_build_object('profile',to_jsonb(v_profile),'library_code',v_lib.code,'quest_type',v_lib.quest_type);
end $$;
revoke all on function public.system_complete_quest_by_title(text,jsonb) from public,anon;
grant execute on function public.system_complete_quest_by_title(text,jsonb) to authenticated,service_role;
