create or replace function public.system_resolve_active_boss()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare
  v_user uuid:=auth.uid(); v_boss public.boss_quests; v_open_objectives integer; v_profile public.profiles; v_trophy_id bigint; v_rarity text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_boss from public.boss_quests where user_id=v_user and status='ACTIVE' order by created_at desc limit 1 for update;
  if not found then raise exception 'NO_ACTIVE_BOSS'; end if;
  select count(*) into v_open_objectives from public.boss_quest_objectives where boss_quest_id=v_boss.id and user_id=v_user and is_complete=false;
  if v_boss.hp>0 then return jsonb_build_object('resolved',false,'reason','BOSS_HP_REMAINS','boss',to_jsonb(v_boss)); end if;
  if v_open_objectives>0 then return jsonb_build_object('resolved',false,'reason','OBJECTIVES_REMAIN','boss',to_jsonb(v_boss)); end if;
  update public.boss_quests set status='COMPLETE',completed_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('resolved_by','BACKEND','resolved_at',now()) where id=v_boss.id returning * into v_boss;
  if v_boss.xp_reward>0 then select * into v_profile from public.system_award_xp(v_boss.xp_reward,'BOSS',v_boss.title,jsonb_build_object('boss_quest_id',v_boss.id)); else select * into v_profile from public.profiles where id=v_user; end if;
  if v_boss.reward_name is not null and not exists(select 1 from public.rewards where user_id=v_user and source='BOSS:'||v_boss.id::text) then
    insert into public.rewards(user_id,name,category,source,status,metadata) values(v_user,v_boss.reward_name,'BOSS','BOSS:'||v_boss.id::text,'UNCLAIMED',jsonb_build_object('rarity',v_boss.reward_rarity));
  end if;
  v_rarity:=coalesce(v_boss.reward_rarity,case v_boss.rank when 'S' then 'LEGENDARY' when 'A' then 'EPIC' when 'B' then 'RARE' else 'UNCOMMON' end);
  if not exists(select 1 from public.user_inventory where user_id=v_user and source_type='BOSS_TROPHY' and source_id=v_boss.id::text) then
    insert into public.user_inventory(user_id,catalog_item_id,custom_name,custom_type,rarity,bonus_text,notes,source_type,source_id,equipped,showcase,acquired_at,metadata)
    values(v_user,null,v_boss.rank||'-RANK BOSS TROPHY','TROPHY',v_rarity,'VICTORY: '||v_boss.title,'Earned by defeating a System-assigned Boss Quest.','BOSS_TROPHY',v_boss.id::text,false,true,now(),jsonb_build_object('boss_title',v_boss.title,'rank',v_boss.rank)) returning id into v_trophy_id;
  end if;
  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values(v_user,'BOSS_DEFEATED',v_boss.title,'Boss defeated and resolved by authoritative backend.','BOSS',v_boss.id::text,v_boss.xp_reward,jsonb_build_object('rank',v_boss.rank,'trophy_id',v_trophy_id));
  return jsonb_build_object('resolved',true,'boss',to_jsonb(v_boss),'profile',to_jsonb(v_profile),'trophy_id',v_trophy_id,'reward_name',v_boss.reward_name);
end $$;
revoke all on function public.system_resolve_active_boss() from public,anon;
grant execute on function public.system_resolve_active_boss() to authenticated,service_role;
