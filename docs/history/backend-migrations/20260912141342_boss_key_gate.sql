-- THE SYSTEM 2.8.0 — Boss access is a real inventory unlock.

insert into public.item_catalog (
  slug, name, item_type, rarity, power, required_level, bonus_text, icon, metadata, active
) values (
  'raid-entry-key',
  'RAID ENTRY KEY',
  'KEY',
  'RARE',
  0,
  5,
  'Opens the Boss Gate once the bearer has proved a 3-day Daily streak.',
  '🗝',
  jsonb_build_object('unlock', 'BOSS_GATE', 'minimum_streak', 3),
  true
)
on conflict (slug) do update set
  name = excluded.name,
  item_type = excluded.item_type,
  rarity = excluded.rarity,
  required_level = excluded.required_level,
  bonus_text = excluded.bonus_text,
  icon = excluded.icon,
  metadata = excluded.metadata,
  active = true;

create or replace function public.system_ensure_boss_access_key()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_key public.item_catalog;
  v_inventory public.user_inventory;
  v_eligible boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;

  select * into v_key from public.item_catalog where slug = 'raid-entry-key' and active = true;
  if not found then raise exception 'RAID_KEY_NOT_CONFIGURED'; end if;

  select * into v_inventory
  from public.user_inventory
  where user_id = v_user and catalog_item_id = v_key.id
  order by acquired_at asc
  limit 1;

  if found then
    return jsonb_build_object('has_key', true, 'eligible', true, 'key', to_jsonb(v_inventory));
  end if;

  v_eligible := coalesce(v_profile.level, 1) >= 5 and coalesce(v_profile.streak, 0) >= 3;
  if not v_eligible then
    return jsonb_build_object(
      'has_key', false,
      'eligible', false,
      'required_level', 5,
      'required_streak', 3
    );
  end if;

  insert into public.user_inventory (
    user_id, catalog_item_id, source_type, source_id, metadata
  ) values (
    v_user,
    v_key.id,
    'SYSTEM_UNLOCK',
    'BOSS_GATE',
    jsonb_build_object('earned_at_level', v_profile.level, 'earned_at_streak', v_profile.streak)
  ) returning * into v_inventory;

  insert into public.journey_events(user_id, event_type, title, detail, source, source_id, metadata)
  values (
    v_user,
    'KEY_EARNED',
    v_key.name,
    'BOSS GATE UNLOCKED',
    'INVENTORY',
    v_inventory.id::text,
    jsonb_build_object('required_level', 5, 'required_streak', 3)
  );

  return jsonb_build_object('has_key', true, 'eligible', true, 'awarded', true, 'key', to_jsonb(v_inventory));
end;
$function$;

revoke all on function public.system_ensure_boss_access_key() from public, anon;
grant execute on function public.system_ensure_boss_access_key() to authenticated;

create or replace function public.system_assign_boss()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_existing public.boss_quests;
  v_template public.boss_library;
  v_boss public.boss_quests;
  v_obj text;
  v_pos integer := 0;
  v_key_status jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  v_key_status := public.system_ensure_boss_access_key();
  if not coalesce((v_key_status->>'has_key')::boolean, false) then
    return jsonb_build_object('assigned', false, 'reason', 'RAID_KEY_REQUIRED', 'key_status', v_key_status);
  end if;

  select * into v_existing from public.boss_quests where user_id = v_user and status = 'ACTIVE' order by created_at desc limit 1;
  if found then return jsonb_build_object('assigned', false, 'reason', 'ACTIVE_BOSS_EXISTS', 'boss', to_jsonb(v_existing)); end if;

  select * into v_profile from public.profiles where id = v_user;
  select * into v_template from public.boss_library
   where active = true and min_level <= v_profile.level and (max_level is null or max_level >= v_profile.level)
     and (cardinality(class_affinity) = 0 or v_profile.class = any(class_affinity))
   order by case when v_profile.class = any(class_affinity) then 0 else 1 end, rank desc, random()
   limit 1;
  if not found then raise exception 'NO_BOSS_TEMPLATE_AVAILABLE'; end if;

  insert into public.boss_quests(user_id,title,rank,category,deadline,xp_reward,reward_name,reward_rarity,status,system_assigned,max_hp,hp,metadata)
   values(v_user,v_template.title,v_template.rank,v_template.category,now()+interval '7 days',v_template.xp_reward,v_template.reward_name,v_template.reward_rarity,'ACTIVE',true,v_template.max_hp,v_template.max_hp,jsonb_build_object('boss_library_id',v_template.id,'boss_slug',v_template.slug,'raid_key_required',true)) returning * into v_boss;
  for v_obj in select jsonb_array_elements_text(v_template.objective_templates) loop
    v_pos := v_pos + 1;
    insert into public.boss_quest_objectives(user_id,boss_quest_id,objective,position,is_complete) values(v_user,v_boss.id,v_obj,v_pos,false);
  end loop;
  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,metadata)
   values(v_user,'BOSS_ASSIGNED',v_boss.title,v_boss.rank||'-RANK SYSTEM BOSS','BOSS',v_boss.id::text,jsonb_build_object('system_assigned',true,'raid_key_required',true));
  return jsonb_build_object('assigned',true,'boss',to_jsonb(v_boss),'key_status',v_key_status);
end;
$function$;

