-- Remove default PUBLIC execution first.
revoke all on function public.system_award_xp(integer,text,text,jsonb) from public;
revoke all on function public.system_add_attribute(text,integer,text,text,jsonb) from public;
revoke all on function public.system_damage_active_boss(integer,text,text,text,jsonb) from public;
revoke all on function public.system_complete_workout(bigint,integer,text,jsonb) from public;
revoke all on function public.system_complete_quest(uuid,jsonb) from public;
revoke all on function public.system_start_gps_session(text,numeric,integer,uuid,bigint,jsonb) from public;
revoke all on function public.system_finish_gps_session(uuid,numeric,integer,jsonb,jsonb) from public;
revoke all on function public.system_weekly_snapshot(date) from public;
revoke all on function public.system_change_class(text,text,text,jsonb) from public;
revoke all on function public.system_workout_available(bigint) from public;
revoke all on function public.system_resolve_active_boss() from public;
revoke all on function public.system_intelligence_create_thread(text,jsonb) from public;
revoke all on function public.system_intelligence_add_message(uuid,text,text,jsonb) from public;
revoke all on function public.system_intelligence_context() from public;
revoke all on function public.system_intelligence_add_server_message(uuid,uuid,text,text,jsonb) from public;

-- Dangerous primitives: server role only.
grant execute on function public.system_award_xp(integer,text,text,jsonb) to service_role;
grant execute on function public.system_add_attribute(text,integer,text,text,jsonb) to service_role;
grant execute on function public.system_damage_active_boss(integer,text,text,text,jsonb) to service_role;
grant execute on function public.system_intelligence_add_server_message(uuid,uuid,text,text,jsonb) to service_role;

-- Validated user commands / reads.
grant execute on function public.system_complete_workout(bigint,integer,text,jsonb) to authenticated;
grant execute on function public.system_complete_quest(uuid,jsonb) to authenticated;
grant execute on function public.system_start_gps_session(text,numeric,integer,uuid,bigint,jsonb) to authenticated;
grant execute on function public.system_finish_gps_session(uuid,numeric,integer,jsonb,jsonb) to authenticated;
grant execute on function public.system_weekly_snapshot(date) to authenticated;
grant execute on function public.system_change_class(text,text,text,jsonb) to authenticated;
grant execute on function public.system_workout_available(bigint) to authenticated;
grant execute on function public.system_resolve_active_boss() to authenticated;
grant execute on function public.system_intelligence_create_thread(text,jsonb) to authenticated;
grant execute on function public.system_intelligence_add_message(uuid,text,text,jsonb) to authenticated;
grant execute on function public.system_intelligence_context() to authenticated;

