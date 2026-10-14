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
  set status='COMPLETE',
      completed_at=now(),
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
    values(v_user,v_boss.reward_name,'BOSS','BOSS:'||v_boss.id::text,'UNCLAIMED',jsonb_build_object('rarity',v_boss.reward_rarity));
  end if;

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values(v_user,'BOSS_DEFEATED',v_boss.title,'Boss defeated and resolved by authoritative backend.','BOSS',v_boss.id::text,v_boss.xp_reward,jsonb_build_object('rank',v_boss.rank));

  return jsonb_build_object('resolved',true,'boss',to_jsonb(v_boss),'profile',to_jsonb(v_profile));
end;
$$;

grant execute on function public.system_resolve_active_boss() to authenticated;
