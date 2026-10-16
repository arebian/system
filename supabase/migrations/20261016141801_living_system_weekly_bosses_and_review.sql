-- THE SYSTEM: meaning-based proof receipts and weekly preparation bosses.
-- Additive release. Run only after reconciling the recovered production ledger.
begin;

create schema if not exists system_private;
revoke all on schema system_private from public, anon, authenticated;

create table public.system_quest_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('QUEST','BOSS')),
  target_id text not null,
  assigned_for date,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  proof jsonb not null check (jsonb_typeof(proof)='object'),
  decision text not null check (decision in ('APPROVE','CLARIFY','INCOMPLETE')),
  reason text not null,
  question text not null default '',
  missing jsonb not null default '[]'::jsonb,
  model text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 minutes',
  consumed_at timestamptz,
  result jsonb
);
create index system_quest_reviews_owner_idx on public.system_quest_reviews(user_id,created_at desc);
alter table public.system_quest_reviews enable row level security;
revoke all on public.system_quest_reviews from public,anon,authenticated;
grant select on public.system_quest_reviews to authenticated;
grant all on public.system_quest_reviews to service_role;
create policy reviews_read_own on public.system_quest_reviews for select to authenticated using ((select auth.uid())=user_id);

create table public.system_weekly_boss_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan jsonb not null check (jsonb_typeof(plan)='object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '2 hours',
  boss_id bigint references public.boss_quests(id) on delete set null
);
create index system_weekly_boss_plans_owner_idx on public.system_weekly_boss_plans(user_id,created_at desc);
create index system_weekly_boss_plans_boss_idx on public.system_weekly_boss_plans(boss_id) where boss_id is not null;
alter table public.system_weekly_boss_plans enable row level security;
revoke all on public.system_weekly_boss_plans from public,anon,authenticated;
grant select on public.system_weekly_boss_plans to authenticated;
grant all on public.system_weekly_boss_plans to service_role;
create policy weekly_plans_read_own on public.system_weekly_boss_plans for select to authenticated using ((select auth.uid())=user_id);

create table system_private.review_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  attempts integer not null,
  primary key(user_id,window_start)
);
alter table system_private.review_rate_limits enable row level security;
revoke all on system_private.review_rate_limits from public,anon,authenticated;

create function public.system_begin_proof_review_v1() returns boolean
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into system_private.review_rate_limits(user_id,window_start,attempts)
  values(auth.uid(),date_trunc('hour',now()),1)
  on conflict(user_id,window_start) do update set attempts=system_private.review_rate_limits.attempts+1
  returning attempts into v_count;
  return v_count<=20;
end $$;
revoke all on function public.system_begin_proof_review_v1() from public,anon;
grant execute on function public.system_begin_proof_review_v1() to authenticated;

create function public.system_quest_review_context_v1(p_title text,p_assigned_for date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_profile public.profiles; v_lib public.quest_library;
  v_quest public.user_quests; v_date date; v_today date; v_policy text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_profile from public.profiles where id=v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;
  v_today:=(now() at time zone coalesce((select timezone from public.player_routines where user_id=v_user),'UTC'))::date;
  v_date:=coalesce(p_assigned_for,v_today);
  if v_date<v_today-1 or v_date>v_today then raise exception 'QUEST_DATE_INVALID'; end if;
  select * into v_lib from public.quest_library q
  where q.active and upper(q.title)=upper(trim(p_title)) and q.min_level<=v_profile.level
    and (q.class_affinity is null or cardinality(q.class_affinity)=0 or v_profile.class=any(q.class_affinity))
  order by case when v_profile.class=any(coalesce(q.class_affinity,array[]::text[])) then 0 else 1 end,
    case q.quest_type when 'MUST' then 0 when 'CLASS' then 1 when 'DAILY' then 2 else 3 end limit 1;
  if not found then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  select * into v_quest from public.user_quests where user_id=v_user and quest_id=v_lib.id and assigned_for=v_date
    order by created_at desc limit 1;
  if not found and v_date<>v_today then raise exception 'QUEST_DATE_INVALID'; end if;
  if v_quest.status in ('FAILED','DECLINED') or (v_quest.expires_at<now() and v_quest.status<>'COMPLETED') then raise exception 'QUEST_NOT_ACTIVE'; end if;
  v_policy:=upper(coalesce(v_lib.metadata->>'proof_type',
    case when upper(v_lib.title)='NO-SNOOZE PROTOCOL' then 'TIME'
      when v_lib.category='PHYSICAL' or upper(v_lib.title) in
      ('SHADOW MOVEMENT','HOLD THE LINE','FORTRESS','IRON PATIENCE','KEEP MOVING','OPEN TERRITORY','STEADY PACE','STRUCTURAL CHECK','IRON FOUNDATION','RECOVERY ARMOR','FOOTWORK PROTOCOL','QUICK BODY','MOBILITY STRIKE','BODY / MIND RESET','COGNITIVE MOBILITY') then 'PERFORMANCE'
      when v_lib.category='LEARNING' or upper(v_lib.title) in ('COGNITIVE STRIKE','MEMORY FORGE') then 'LEARNING'
      when upper(v_lib.title)='CLEAR THE FIELD' then 'PHOTO'
      when upper(v_lib.title) in ('SILENT EXECUTION','FIRST ORDER','TACTICAL HOUR','NO ZERO DAY','CLOSE THE LOOP','ORDER BEFORE REST','FOCUS BLOCK','IMPORTANT FIRST','MENTAL LOCK') then 'RESULT'
      else 'HONOR' end));
  return jsonb_build_object('kind','QUEST','target_id',v_lib.id::text,'title',v_lib.title,
    'objective',coalesce(v_quest.objective_snapshot,v_lib.objective),'assigned_for',v_date,
    'proof_policy',v_policy,'recall_required',case when v_policy='LEARNING' then 3 else 0 end,'player_class',v_profile.class,'status',coalesce(v_quest.status,'ASSIGNED'));
end $$;
revoke all on function public.system_quest_review_context_v1(text,date) from public,anon;
grant execute on function public.system_quest_review_context_v1(text,date) to authenticated;

-- Preserve the proven XP/credit/streak implementation behind a receipt guard.
alter function public.system_complete_quest(uuid,jsonb) rename to complete_quest_before_living_system;
alter function public.complete_quest_before_living_system(uuid,jsonb) set schema system_private;
revoke all on function system_private.complete_quest_before_living_system(uuid,jsonb) from public,anon,authenticated;

create function public.system_complete_quest(p_user_quest_id uuid,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_quest public.user_quests; v_review public.system_quest_reviews;
  v_proof jsonb; v_result jsonb; v_profile public.profiles; v_verified_activity boolean:=false;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_quest from public.user_quests where id=p_user_quest_id and user_id=v_user for update;
  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if v_quest.status='COMPLETED' then return jsonb_build_object('duplicate',true,'quest',to_jsonb(v_quest)); end if;
  -- A genuine on-time wake check-in keeps its existing non-AI path.
  if p_metadata->>'proof_type'='TIME' and p_metadata->>'context'='DAILY_WAKE' and v_quest.quest_type='DAILY'
    and upper(v_quest.title_snapshot)='NO-SNOOZE PROTOCOL' then
    select exists(select 1 from public.routine_checkins r where r.user_id=v_user and r.checkin_type='WAKE'
      and r.status='ON_TIME' and (r.occurred_at at time zone r.timezone)::date=v_quest.assigned_for
      and r.created_at>now()-interval '24 hours') into v_verified_activity;
  end if;
  -- GPS completion is accepted only for the exact linked session and quest.
  if not v_verified_activity and nullif(p_metadata->>'gps_session_id','') is not null then
    select exists(select 1 from public.gps_sessions g where g.id::text=p_metadata->>'gps_session_id'
      and g.user_id=v_user and g.quest_id=v_quest.id and g.gps_verified=true) into v_verified_activity;
  end if;
  if not v_verified_activity and (upper(v_quest.title_snapshot)='NO-SNOOZE PROTOCOL'
    or exists(select 1 from public.quest_library q where q.id=v_quest.quest_id and upper(q.metadata->>'proof_type') in ('TIME','GPS'))) then
    raise exception 'QUEST_SERVER_ACTIVITY_REQUIRED';
  end if;
  if not v_verified_activity then
    if nullif(p_metadata->>'proof_review_id','') is null then raise exception 'APPROVED_REVIEW_REQUIRED'; end if;
    select * into v_review from public.system_quest_reviews where id::text=p_metadata->>'proof_review_id' and user_id=v_user for update;
    if not found or v_review.decision<>'APPROVE' or v_review.consumed_at is not null or v_review.expires_at<now()
      or v_review.target_type<>'QUEST' or v_review.target_id<>v_quest.quest_id::text
      or v_review.assigned_for is distinct from v_quest.assigned_for
      or v_review.snapshot->>'objective' is distinct from v_quest.objective_snapshot then raise exception 'REVIEW_NOT_VALID_FOR_QUEST'; end if;
    select * into v_profile from public.profiles where id=v_user;
    if v_review.snapshot->>'player_class' is distinct from v_profile.class then raise exception 'REVIEW_CONTEXT_CHANGED'; end if;
    v_proof:=jsonb_build_object('type',upper(coalesce(p_metadata->>'proof_type','HONOR')),
      'detail',coalesce(p_metadata->>'proof_detail',''),'note',coalesce(p_metadata->>'proof_note',''),
      'takeaways',coalesce(p_metadata->'proof_takeaways','[]'::jsonb),'imagePath',coalesce(p_metadata->>'proof_image_path',''),
      'honorConfirmed',coalesce((p_metadata->>'proof_honor_confirmed')::boolean,false));
    if v_review.proof<>v_proof then raise exception 'REVIEW_PROOF_CHANGED'; end if;
  end if;
  v_result:=system_private.complete_quest_before_living_system(p_user_quest_id,
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('proof_verified_at',now(),'verification_source',case when v_verified_activity then 'SERVER_ACTIVITY' else 'SERVER_REVIEW' end));
  if v_review.id is not null then
    update public.system_quest_reviews set consumed_at=now(),result=v_result where id=v_review.id;
  end if;
  return v_result;
end $$;
revoke all on function public.system_complete_quest(uuid,jsonb) from public,anon;
grant execute on function public.system_complete_quest(uuid,jsonb) to authenticated;

create function public.system_weekly_boss_status_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_active public.boss_quests; v_latest public.boss_quests; v_key jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  v_key:=public.system_ensure_boss_access_key();
  update public.boss_quests set status='FAILED',metadata=metadata||jsonb_build_object('closed_reason','WEEKLY_WINDOW_ENDED')
    where user_id=v_user and status='ACTIVE' and metadata->>'kind'='WEEKLY_PREPARATION' and deadline<now();
  select * into v_active from public.boss_quests where user_id=v_user and status='ACTIVE' order by created_at desc limit 1;
  select * into v_latest from public.boss_quests where user_id=v_user and metadata->>'kind'='WEEKLY_PREPARATION' order by created_at desc limit 1;
  return jsonb_build_object('server_now',now(),'has_key',coalesce((v_key->>'has_key')::boolean,false),
    'active',case when v_active.id is null then null else to_jsonb(v_active)||jsonb_build_object('objectives',
      coalesce((select jsonb_agg(to_jsonb(o) order by position) from public.boss_quest_objectives o where o.boss_quest_id=v_active.id),'[]'::jsonb)) end,
    'latest',case when v_latest.id is null then null else to_jsonb(v_latest) end,
    'next_available_at',case when v_latest.id is null then now() else v_latest.created_at+interval '7 days' end,
    'can_assign',v_active.id is null and coalesce((v_key->>'has_key')::boolean,false)
      and (v_latest.id is null or v_latest.created_at+interval '7 days'<=now()));
end $$;
revoke all on function public.system_weekly_boss_status_v1() from public,anon;
grant execute on function public.system_weekly_boss_status_v1() to authenticated;

-- Bootstrap can inspect the gate, but cannot silently create another boss.
create or replace function public.system_assign_boss() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_status jsonb;
begin
  v_status:=public.system_weekly_boss_status_v1();
  return jsonb_build_object('assigned',false,'reason',case
    when v_status->'active' <> 'null'::jsonb then 'ACTIVE_BOSS_EXISTS'
    when not (v_status->>'has_key')::boolean then 'RAID_KEY_REQUIRED'
    when not (v_status->>'can_assign')::boolean then 'WEEKLY_COOLDOWN'
    else 'WEEKLY_PLAN_REQUIRED' end,'boss',v_status->'active');
end $$;

create function public.system_accept_weekly_boss_v1(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_draft public.system_weekly_boss_plans; v_profile public.profiles;
  v_boss public.boss_quests; v_key jsonb; v_step jsonb; v_pos integer:=0; v_plan jsonb; v_xp integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Serialize every acceptance for this player, including different drafts.
  select * into v_profile from public.profiles where id=v_user for update;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;
  select * into v_draft from public.system_weekly_boss_plans where id=p_plan_id and user_id=v_user for update;
  if not found then raise exception 'WEEKLY_PLAN_NOT_FOUND'; end if;
  if v_draft.boss_id is not null then
    select * into v_boss from public.boss_quests where id=v_draft.boss_id;
    return jsonb_build_object('duplicate',true,'boss',to_jsonb(v_boss));
  end if;
  if v_draft.expires_at<now() then raise exception 'WEEKLY_PLAN_EXPIRED'; end if;
  v_key:=public.system_ensure_boss_access_key();
  if not coalesce((v_key->>'has_key')::boolean,false) then raise exception 'RAID_KEY_REQUIRED'; end if;
  if exists(select 1 from public.boss_quests where user_id=v_user and status='ACTIVE') then raise exception 'ACTIVE_BOSS_EXISTS'; end if;
  if exists(select 1 from public.boss_quests where user_id=v_user and metadata->>'kind'='WEEKLY_PREPARATION' and created_at>now()-interval '7 days') then raise exception 'WEEKLY_COOLDOWN'; end if;
  v_plan:=v_draft.plan;
  if v_plan->>'kind'<>'WEEKLY_PREPARATION' or (v_plan->>'coverage_days')::integer not between 5 and 7
    or jsonb_array_length(v_plan->'steps') not between 3 and 8 then raise exception 'WEEKLY_PLAN_INVALID'; end if;
  v_xp:=least(1200,250+(v_profile.level/10)*100);
  v_plan:=jsonb_set(v_plan,'{reward,xp}',to_jsonb(v_xp));
  insert into public.boss_quests(user_id,title,rank,category,status,xp_reward,reward_rarity,deadline,max_hp,hp,system_assigned,metadata)
  values(v_user,left(v_plan->>'title',120),case when v_profile.level>=81 then 'S' when v_profile.level>=61 then 'A' when v_profile.level>=41 then 'B' else 'C' end,
    'DISCIPLINE','ACTIVE',v_xp,'RARE',now()+interval '7 days',100,100,true,
    jsonb_build_object('kind','WEEKLY_PREPARATION','weekly_plan',v_plan,'draft_id',p_plan_id)) returning * into v_boss;
  for v_step in select value from jsonb_array_elements(v_plan->'steps') loop
    v_pos:=v_pos+1;
    insert into public.boss_quest_objectives(user_id,boss_quest_id,objective,position)
      values(v_user,v_boss.id,left(v_step->>'title',240),v_pos);
  end loop;
  update public.system_weekly_boss_plans set boss_id=v_boss.id where id=p_plan_id;
  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,metadata)
    values(v_user,'BOSS_ASSIGNED',v_boss.title,v_plan->>'objective','BOSS',v_boss.id::text,jsonb_build_object('kind','WEEKLY_PREPARATION'));
  return jsonb_build_object('boss',to_jsonb(v_boss));
end $$;
revoke all on function public.system_accept_weekly_boss_v1(uuid) from public,anon;
grant execute on function public.system_accept_weekly_boss_v1(uuid) to authenticated;

create function public.system_retire_weekly_boss_v1(p_boss_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_boss public.boss_quests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.boss_quests set status='ABANDONED',metadata=metadata||jsonb_build_object('closed_reason','PLAYER_RETIRED','retired_at',now())
    where id=p_boss_id and user_id=auth.uid() and status='ACTIVE' and metadata->>'kind'='WEEKLY_PREPARATION' returning * into v_boss;
  if not found then raise exception 'WEEKLY_BOSS_NOT_ACTIVE'; end if;
  return jsonb_build_object('boss',to_jsonb(v_boss),'penalty',0);
end $$;
revoke all on function public.system_retire_weekly_boss_v1(bigint) from public,anon;
grant execute on function public.system_retire_weekly_boss_v1(bigint) to authenticated;

-- Ordinary training damage and checkboxes cannot resolve a weekly output boss.
alter function public.system_resolve_active_boss() rename to resolve_boss_before_living_system;
alter function public.resolve_boss_before_living_system() set schema system_private;
revoke all on function system_private.resolve_boss_before_living_system() from public,anon,authenticated;
create function public.system_resolve_active_boss() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists(select 1 from public.boss_quests where user_id=auth.uid() and status='ACTIVE' and metadata->>'kind'='WEEKLY_PREPARATION') then
    return jsonb_build_object('resolved',false,'reason','WEEKLY_RESULT_REVIEW_REQUIRED');
  end if;
  return system_private.resolve_boss_before_living_system();
end $$;
revoke all on function public.system_resolve_active_boss() from public,anon;
grant execute on function public.system_resolve_active_boss() to authenticated;

create function public.system_complete_weekly_boss_v1(p_boss_id bigint,p_review_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_boss public.boss_quests; v_review public.system_quest_reviews;
  v_result jsonb; v_reward jsonb; v_attribute text; v_delta text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Same lock order as acceptance; two concurrent claims cannot double-award.
  perform 1 from public.profiles where id=v_user for update;
  select * into v_boss from public.boss_quests where id=p_boss_id and user_id=v_user for update;
  if not found or v_boss.metadata->>'kind' is distinct from 'WEEKLY_PREPARATION' then raise exception 'WEEKLY_BOSS_NOT_FOUND'; end if;
  if v_boss.status='COMPLETE' then return jsonb_build_object('duplicate',true,'boss',to_jsonb(v_boss)); end if;
  if v_boss.status<>'ACTIVE' or v_boss.deadline<now() then raise exception 'WEEKLY_BOSS_NOT_ACTIVE'; end if;
  if exists(select 1 from public.boss_quest_objectives where boss_quest_id=p_boss_id and not is_complete) then raise exception 'WEEKLY_CHECKPOINTS_REMAIN'; end if;
  select * into v_review from public.system_quest_reviews where id=p_review_id and user_id=v_user for update;
  if not found or v_review.target_type<>'BOSS' or v_review.target_id<>p_boss_id::text or v_review.decision<>'APPROVE'
    or v_review.expires_at<now() or v_review.consumed_at is not null
    or v_review.snapshot->>'objective' is distinct from v_boss.metadata->'weekly_plan'->>'objective' then raise exception 'WEEKLY_REVIEW_REQUIRED'; end if;
  update public.boss_quests set hp=0 where id=p_boss_id;
  v_result:=system_private.resolve_boss_before_living_system();
  if not coalesce((v_result->>'resolved')::boolean,false) then raise exception 'WEEKLY_RESOLUTION_FAILED'; end if;
  -- The server-created plan supplies fixed, task-related rewards; never the browser or model.
  v_reward:=v_boss.metadata->'weekly_plan'->'reward'->'attributes';
  for v_attribute,v_delta in select key,value from jsonb_each_text(v_reward) loop
    if v_attribute not in ('DISCIPLINE','FOCUS','RECOVERY') or v_delta::integer not between 1 and 4 then raise exception 'WEEKLY_REWARD_INVALID'; end if;
    perform public.system_add_attribute(v_attribute,v_delta::integer,'WEEKLY_BOSS',v_boss.title,jsonb_build_object('boss_id',p_boss_id));
  end loop;
  update public.system_quest_reviews set consumed_at=now(),result=v_result where id=p_review_id;
  perform public.system_orchestrate_progression();
  return v_result||jsonb_build_object('attributes_awarded',v_reward);
end $$;
revoke all on function public.system_complete_weekly_boss_v1(bigint,uuid) from public,anon;
grant execute on function public.system_complete_weekly_boss_v1(bigint,uuid) to authenticated;

-- Equipment bonuses are a reversible loadout, separate from earned attributes.
update public.item_catalog set metadata=metadata||jsonb_build_object('equipment_bonuses',case slug
  when 'runners-edge' then '{"SPEED":5}'::jsonb
  when 'iron-key' then '{"STRENGTH":8}'::jsonb
  when 'focus-crystal' then '{"FOCUS":10}'::jsonb
  when 'vanguard-emblem' then '{"DISCIPLINE":10}'::jsonb
  when 'ascendant-core' then '{"STRENGTH":15,"SPEED":15,"ENDURANCE":15,"INTELLIGENCE":15,"FOCUS":15,"DISCIPLINE":15,"WEALTH":15,"CHARISMA":15,"CREATIVITY":15,"RECOVERY":15}'::jsonb
  end)
where slug in ('runners-edge','iron-key','focus-crystal','vanguard-emblem','ascendant-core');

create function public.system_equipment_loadout_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_level integer; v_base jsonb; v_bonus jsonb:='{}'; v_effective jsonb:='{}';
  v_name text; v_value integer; v_items jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select level into v_level from public.profiles where id=v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;
  select to_jsonb(a)-'id'-'user_id'-'created_at'-'updated_at' into v_base from public.attributes a where user_id=v_user;
  v_base:=coalesce(v_base,'{}');
  for v_name in select unnest(array['STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY']) loop
    -- Duplicate copies never stack. Custom item descriptions are never parsed.
    select coalesce(sum((c.metadata->'equipment_bonuses'->>v_name)::integer),0)::integer into v_value
    from public.item_catalog c where c.active and c.required_level<=v_level
      and c.metadata ? 'equipment_bonuses'
      and exists(select 1 from public.user_inventory i where i.user_id=v_user and i.catalog_item_id=c.id and i.equipped);
    v_bonus:=v_bonus||jsonb_build_object(v_name,v_value);
    v_effective:=v_effective||jsonb_build_object(v_name,coalesce((v_base->>lower(v_name))::integer,0)+v_value);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'catalog_item_id',c.id,'slug',c.slug,'name',c.name,
    'type',c.item_type,'rarity',c.rarity,'power',c.power,'level',c.required_level,'bonus',c.bonus_text,'icon',c.icon,
    'bonuses',coalesce(c.metadata->'equipment_bonuses','{}'::jsonb),'equipped',i.equipped,'showcase',i.showcase) order by c.required_level,c.id),'[]'::jsonb)
    into v_items from public.item_catalog c join lateral
      (select * from public.user_inventory u where u.user_id=v_user and u.catalog_item_id=c.id order by u.equipped desc,u.id limit 1) i on true
    where c.active and c.required_level<=v_level;
  return jsonb_build_object('bonuses',v_bonus,'effective_attributes',v_effective,'items',v_items);
end $$;
revoke all on function public.system_equipment_loadout_v1() from public,anon;
grant execute on function public.system_equipment_loadout_v1() to authenticated;

create function public.system_sync_equipment_unlocks_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_level integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select level into v_level from public.profiles where id=v_user for update;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;
  insert into public.user_inventory(user_id,catalog_item_id,rarity,source_type,source_id,metadata)
    select v_user,c.id,c.rarity,'SYSTEM_LEVEL',c.slug,jsonb_build_object('authoritative_stats',true)
    from public.item_catalog c where c.active and c.required_level<=v_level and c.metadata ? 'equipment_bonuses'
      and not exists(select 1 from public.user_inventory i where i.user_id=v_user and i.catalog_item_id=c.id);
  return public.system_equipment_loadout_v1();
end $$;
revoke all on function public.system_sync_equipment_unlocks_v1() from public,anon;
grant execute on function public.system_sync_equipment_unlocks_v1() to authenticated;

create or replace function public.system_set_inventory_state(p_inventory_id bigint,p_equipped boolean default null,p_showcase boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_item public.user_inventory; v_catalog public.item_catalog; v_level integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select level into v_level from public.profiles where id=v_user for update;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;
  select * into v_item from public.user_inventory where id=p_inventory_id and user_id=v_user for update;
  if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  if p_equipped=true and v_item.catalog_item_id is not null then
    select * into v_catalog from public.item_catalog where id=v_item.catalog_item_id;
    if not v_catalog.active or v_catalog.required_level>v_level then raise exception 'ITEM_LEVEL_REQUIRED'; end if;
  end if;
  update public.user_inventory set equipped=coalesce(p_equipped,equipped),showcase=coalesce(p_showcase,showcase)
    where id=v_item.id returning * into v_item;
  -- Keep any legacy duplicate copies in the same state without granting a
  -- second bonus or allowing an invisible equipped duplicate after unequip.
  if v_item.catalog_item_id is not null and p_equipped is not null then
    update public.user_inventory set equipped=p_equipped where user_id=v_user and catalog_item_id=v_item.catalog_item_id;
  end if;
  return jsonb_build_object('item',to_jsonb(v_item),'equipment',public.system_equipment_loadout_v1());
end $$;
revoke all on function public.system_set_inventory_state(bigint,boolean,boolean) from public,anon;
grant execute on function public.system_set_inventory_state(bigint,boolean,boolean) to authenticated;

commit;
