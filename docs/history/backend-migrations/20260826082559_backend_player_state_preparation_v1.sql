create or replace function public.system_prepare_player_state()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_penalties jsonb; v_quests jsonb; v_boss jsonb; v_orch jsonb;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 begin v_penalties:=public.system_apply_expired_quest_penalties(); exception when others then v_penalties:=jsonb_build_object('error',sqlerrm); end;
 begin v_quests:=public.system_generate_daily_quests(current_date); exception when others then v_quests:=jsonb_build_object('error',sqlerrm); end;
 begin v_boss:=public.system_assign_boss(); exception when others then v_boss:=jsonb_build_object('error',sqlerrm); end;
 begin v_orch:=public.system_orchestrate_progression(); exception when others then v_orch:=jsonb_build_object('error',sqlerrm); end;
 return jsonb_build_object('penalties',v_penalties,'quests',v_quests,'boss',v_boss,'orchestration',v_orch,'prepared_at',now());
end $$;
revoke all on function public.system_prepare_player_state() from public,anon;
grant execute on function public.system_prepare_player_state() to authenticated,service_role;
