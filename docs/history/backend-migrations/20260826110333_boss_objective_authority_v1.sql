create or replace function public.system_set_boss_objective(p_objective_id bigint,p_complete boolean)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_obj public.boss_quest_objectives; v_boss public.boss_quests;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_obj from public.boss_quest_objectives where id=p_objective_id and user_id=v_user for update;
 if not found then raise exception 'BOSS_OBJECTIVE_NOT_FOUND'; end if;
 select * into v_boss from public.boss_quests where id=v_obj.boss_quest_id and user_id=v_user and status='ACTIVE';
 if not found then raise exception 'ACTIVE_BOSS_NOT_FOUND'; end if;
 update public.boss_quest_objectives set is_complete=coalesce(p_complete,false),completed_at=case when coalesce(p_complete,false) then coalesce(completed_at,now()) else null end where id=v_obj.id returning * into v_obj;
 insert into public.journey_events(user_id,event_type,title,detail,source,source_id,metadata)
 values(v_user,case when v_obj.is_complete then 'BOSS_OBJECTIVE_COMPLETE' else 'BOSS_OBJECTIVE_REOPENED' end,v_boss.title,v_obj.objective,'BOSS_OBJECTIVE',v_obj.id::text,jsonb_build_object('boss_quest_id',v_boss.id,'complete',v_obj.is_complete));
 return jsonb_build_object('objective',to_jsonb(v_obj),'boss',to_jsonb(v_boss));
end $$;
revoke all on function public.system_set_boss_objective(bigint,boolean) from public,anon;
grant execute on function public.system_set_boss_objective(bigint,boolean) to authenticated,service_role;
