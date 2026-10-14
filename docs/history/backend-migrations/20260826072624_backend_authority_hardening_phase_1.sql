-- Harden the authoritative progression layer without breaking the current stable client.
-- Phase 1 makes command functions SECURITY DEFINER and adds server-side Boss resolution.

alter function public.system_award_xp(integer,text,text,jsonb) security definer;
alter function public.system_add_attribute(text,integer,text,text,jsonb) security definer;
alter function public.system_damage_active_boss(integer,text,text,text,jsonb) security definer;
alter function public.system_complete_workout(bigint,integer,text,jsonb) security definer;
alter function public.system_complete_quest(uuid,jsonb) security definer;
alter function public.system_start_gps_session(text,numeric,integer,uuid,bigint,jsonb) security definer;
alter function public.system_finish_gps_session(uuid,numeric,integer,jsonb,jsonb) security definer;
alter function public.system_weekly_snapshot(date) security definer;
alter function public.system_change_class(text,text,text,jsonb) security definer;
alter function public.system_workout_available(bigint) security definer;

create or replace function public.system_resolve_active_boss()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_boss public.boss_quests;
  v_open_objectives integer;
  v_profile public.profiles;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_boss
  from public.boss_quests
  where user_id=v_user and status='ACTIVE'
  order by created_at desc
  limit 1
  for update;

  if not found then raise exception 'NO_ACTIVE_BOSS'; end if;

  select count(*) into v_open_objectives
  from public.boss_quest_objectives
  where boss_quest_id=v_boss.id
    and user_id=v_user
    and is_complete=false;

  if v_boss.hp > 0 then
    return jsonb_build_object('resolved',false,'reason','BOSS_HP_REMAINS','boss',to_jsonb(v_boss));
  end if;

  if v_open_objectives > 0 then
    return jsonb_build_object('resolved',false,'reason','OBJECTIVES_REMAIN','boss',to_jsonb(v_boss));
  end if;

  update public.boss_quests
  set status='COMPLETE', completed_at=now(), updated_at=coalesce((metadata->>'updated_at')::timestamptz, now()),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('resolved_by','BACKEND','resolved_at',now())
  where id=v_boss.id
  returning * into v_boss;

  if v_boss.xp_reward > 0 then
    select * into v_profile from public.system_award_xp(
      v_boss.xp_reward,'BOSS',v_boss.title,jsonb_build_object('boss_quest_id',v_boss.id)
    );
  else
    select * into v_profile from public.profiles where id=v_user;
  end if;

  if v_boss.reward_name is not null then
    insert into public.rewards(user_id,name,category,source,status,metadata)
    values(v_user,v_boss.reward_name,'BOSS','BOSS:'||v_boss.id::text,'UNCLAIMED',jsonb_build_object('rarity',v_boss.reward_rarity))
    on conflict do nothing;
  end if;

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values(v_user,'BOSS_DEFEATED',v_boss.title,'Boss defeated and resolved by authoritative backend.','BOSS',v_boss.id::text,v_boss.xp_reward,jsonb_build_object('rank',v_boss.rank));

  return jsonb_build_object('resolved',true,'boss',to_jsonb(v_boss),'profile',to_jsonb(v_profile));
end;
$$;

-- Existing stable client can still execute current functions during migration.
-- Strict API-only grants will be applied after the stable client no longer writes progression directly.
grant execute on function public.system_resolve_active_boss() to authenticated;

