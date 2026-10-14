create or replace function public.system_orchestrate_progression()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_ach jsonb; v_titles jsonb; v_boss jsonb; v_has_boss boolean; v_boss_hp integer; v_open int;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select exists(select 1 from public.boss_quests where user_id=v_user and status='ACTIVE'),
        coalesce((select hp from public.boss_quests where user_id=v_user and status='ACTIVE' order by created_at desc limit 1),1)
 into v_has_boss,v_boss_hp;
 if v_has_boss and v_boss_hp<=0 then
   select count(*) into v_open from public.boss_quest_objectives o join public.boss_quests b on b.id=o.boss_quest_id where b.user_id=v_user and b.status='ACTIVE' and o.is_complete=false;
   if v_open=0 then
     begin v_boss:=public.system_resolve_active_boss(); exception when others then v_boss:=jsonb_build_object('resolved',false,'reason',sqlerrm); end;
   else v_boss:=jsonb_build_object('resolved',false,'reason','OBJECTIVES_REMAIN'); end if;
 else v_boss:=jsonb_build_object('resolved',false,'reason',case when v_has_boss then 'BOSS_HP_REMAINS' else 'NO_ACTIVE_BOSS' end); end if;
 v_ach:=public.system_evaluate_achievements();
 v_titles:=public.system_evaluate_titles();
 return jsonb_build_object('boss',v_boss,'achievements',v_ach,'titles',v_titles);
end $$;
revoke all on function public.system_orchestrate_progression() from public,anon;
grant execute on function public.system_orchestrate_progression() to authenticated,service_role;
