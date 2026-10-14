-- Backend authority phase: skill mastery, achievements/titles, and server-assigned bosses.

-- 1) Proof verification state. Existing proof stays pending until a trusted verifier approves it.
alter table public.proof_records
  add column if not exists verification_status text not null default 'PENDING',
  add column if not exists verified_at timestamptz,
  add column if not exists verification_source text,
  add column if not exists verification_detail jsonb not null default '{}'::jsonb;

alter table public.proof_records drop constraint if exists proof_records_verification_status_check;
alter table public.proof_records
  add constraint proof_records_verification_status_check
  check (verification_status in ('PENDING','VERIFIED','REJECTED'));

create index if not exists proof_records_user_verification_idx
  on public.proof_records(user_id, verification_status, captured_at desc);

-- 2) Skill attempt ledger so client submissions are auditable and idempotent.
create table if not exists public.skill_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id bigint not null references public.skills(id) on delete cascade,
  proof_record_id bigint references public.proof_records(id) on delete set null,
  submitted_value numeric,
  submitted_unit text,
  status text not null default 'RECORDED',
  result jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.skill_attempts enable row level security;
drop policy if exists skill_attempts_select_own on public.skill_attempts;
create policy skill_attempts_select_own on public.skill_attempts for select to authenticated using (auth.uid() = user_id);

create index if not exists skill_attempts_user_skill_idx on public.skill_attempts(user_id, skill_id, created_at desc);

-- 3) Evidence-aware skill evaluator.
create or replace function public.system_skill_available(p_skill_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_skill public.skills;
  v_blocked integer;
  v_rank_level integer;
begin
  if v_user is null then return false; end if;
  select * into v_profile from public.profiles where id=v_user;
  if not found then return false; end if;
  select * into v_skill from public.skills where id=p_skill_id and is_active=true;
  if not found then return false; end if;
  if cardinality(v_skill.class_affinity) > 0 and not (v_profile.class = any(v_skill.class_affinity)) then return false; end if;
  if v_profile.level < coalesce(v_skill.unlock_level,1) then return false; end if;

  select count(*) into v_blocked
  from public.skill_prerequisites r
  left join public.user_skills us on us.user_id=v_user and us.skill_id=r.prerequisite_skill_id
  where r.skill_id=p_skill_id
    and case upper(r.minimum_status)
      when 'MASTERED' then coalesce(us.status,'LOCKED') <> 'MASTERED'
      when 'AVAILABLE' then coalesce(us.status,'LOCKED') not in ('AVAILABLE','IN_PROGRESS','MASTERED')
      else coalesce(us.status,'LOCKED')='LOCKED'
    end;
  return v_blocked=0;
end;
$$;

create or replace function public.system_evaluate_skill(p_skill_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_skill public.skills;
  v_us public.user_skills;
  v_target numeric;
  v_value numeric := 0;
  v_verified boolean := false;
  v_reason text := 'INSUFFICIENT_EVIDENCE';
  v_req jsonb;
  v_records integer;
  v_min_minutes numeric;
  v_learning_minutes numeric;
  v_gps_distance numeric;
  v_best_metric numeric;
  v_proof_count integer;
  v_mastered_now boolean := false;
  v_profile public.profiles;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.system_skill_available(p_skill_id) then raise exception 'SKILL_LOCKED_OR_UNAVAILABLE'; end if;
  select * into v_skill from public.skills where id=p_skill_id and is_active=true;
  if not found then raise exception 'SKILL_NOT_FOUND'; end if;

  insert into public.user_skills(user_id,skill_id,status,started_at,updated_at)
  values(v_user,p_skill_id,'IN_PROGRESS',now(),now())
  on conflict(user_id,skill_id) do update set
    status=case when public.user_skills.status='MASTERED' then 'MASTERED' else 'IN_PROGRESS' end,
    started_at=coalesce(public.user_skills.started_at,now()), updated_at=now();

  select * into v_us from public.user_skills where user_id=v_user and skill_id=p_skill_id for update;
  if v_us.status='MASTERED' then
    return jsonb_build_object('mastered',true,'already_mastered',true,'skill_id',p_skill_id,'status',v_us.status);
  end if;

  v_req := coalesce(v_skill.mastery_requirements,'{}'::jsonb);
  v_target := coalesce(v_skill.mastery_target,0);

  -- Learning / Mage evidence is derived from structured learning records, never a client-entered score.
  if v_skill.category in ('LEARNING','COGNITION','FOCUS','RESEARCH','SYNTHESIS','TEACHING','MASTERY','SYSTEMS','INTELLIGENCE')
     or (v_skill.class_affinity @> array['MAGE']::text[] and v_req <> '{}'::jsonb) then
    select count(*), coalesce(sum(duration_minutes),0)
      into v_records, v_learning_minutes
    from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null);

    v_value := case
      when coalesce(v_req->>'records','') <> '' then v_records
      when coalesce(v_req->>'min_hours','') <> '' then v_learning_minutes/60.0
      when v_skill.mastery_unit='minutes' then v_learning_minutes
      when v_skill.mastery_unit='hours' then v_learning_minutes/60.0
      else v_records end;

    v_verified := true;
    if coalesce(v_req->>'records','') <> '' and v_records < (v_req->>'records')::integer then v_verified:=false; end if;
    if coalesce(v_req->>'min_minutes','') <> '' and v_learning_minutes < (v_req->>'min_minutes')::numeric then v_verified:=false; end if;
    if coalesce(v_req->>'min_hours','') <> '' and v_learning_minutes < (v_req->>'min_hours')::numeric*60 then v_verified:=false; end if;
    if coalesce(v_req->>'min_minutes_each','') <> '' and exists(
      select 1 from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null) and duration_minutes < (v_req->>'min_minutes_each')::integer
    ) then v_verified:=false; end if;
    if coalesce(v_req->>'requires_summary','false')='true' and exists(
      select 1 from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null) and length(trim(learning_summary)) < 20
    ) then v_verified:=false; end if;
    if coalesce(v_req->>'requires_takeaways','') <> '' and exists(
      select 1 from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null)
      and jsonb_array_length(coalesce(key_takeaways,'[]'::jsonb)) < (v_req->>'requires_takeaways')::integer
    ) then v_verified:=false; end if;
    if coalesce(v_req->>'requires_application','false')='true' and exists(
      select 1 from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null) and coalesce(length(trim(application_plan)),0) < 10
    ) then v_verified:=false; end if;
    if v_target > 0 and v_value < v_target and coalesce(v_req->>'records','')='' and coalesce(v_req->>'min_hours','')='' and coalesce(v_req->>'min_minutes','')='' then v_verified:=false; end if;
    v_reason := case when v_verified then 'LEARNING_EVIDENCE_VERIFIED' else 'LEARNING_REQUIREMENTS_INCOMPLETE' end;

  -- Distance/time endurance skills can be proven by verified GPS.
  elsif lower(coalesce(v_skill.mastery_unit,'')) in ('km','minutes','minutes_max') or v_skill.category in ('ENDURANCE','RUNNING','EXPLORATION') then
    select coalesce(max(distance_km),0) into v_gps_distance
      from public.gps_sessions where user_id=v_user and gps_verified=true;
    if lower(coalesce(v_skill.mastery_unit,''))='km' or coalesce(v_req->>'distance_km','')<>'' then
      v_value := v_gps_distance;
      v_target := coalesce(nullif(v_req->>'distance_km','')::numeric, v_target);
      v_verified := v_target>0 and v_value>=v_target;
    elsif lower(coalesce(v_skill.mastery_unit,''))='minutes' then
      select coalesce(max(duration_seconds)/60.0,0) into v_value from public.gps_sessions where user_id=v_user and gps_verified=true;
      v_verified := v_target>0 and v_value>=v_target;
    elsif lower(coalesce(v_skill.mastery_unit,''))='minutes_max' then
      select coalesce(min(duration_seconds)/60.0,999999) into v_value from public.gps_sessions
       where user_id=v_user and gps_verified=true and distance_km>=5;
      v_verified := v_target>0 and v_value<=v_target;
    else
      v_value := v_gps_distance;
      v_verified := coalesce(v_req->>'distance_km','')<>'' and v_value >= (v_req->>'distance_km')::numeric;
    end if;
    v_reason := case when v_verified then 'GPS_EVIDENCE_VERIFIED' else 'GPS_REQUIREMENTS_INCOMPLETE' end;

  else
    -- Physical reps/holds and subjective skills require an independently VERIFIED proof record.
    select count(*) into v_proof_count from public.proof_records
      where user_id=v_user and verification_status='VERIFIED'
        and related_event_type='SKILL' and related_event_id=p_skill_id::text;
    v_verified := v_proof_count > 0;
    select coalesce(max(submitted_value),0) into v_value from public.skill_attempts
      where user_id=v_user and skill_id=p_skill_id
        and (proof_record_id is null or exists(select 1 from public.proof_records pr where pr.id=proof_record_id and pr.verification_status='VERIFIED'));
    if v_target>0 then v_verified := v_verified and v_value>=v_target; end if;
    v_reason := case when v_verified then 'VERIFIED_PROOF_ACCEPTED' else 'VERIFIED_PROOF_REQUIRED' end;
  end if;

  update public.user_skills set
    progress_value=v_value,
    progress_unit=v_skill.mastery_unit,
    best_value=greatest(coalesce(best_value,0),coalesce(v_value,0)),
    status=case when v_verified then 'MASTERED' else 'IN_PROGRESS' end,
    mastered_at=case when v_verified then coalesce(mastered_at,now()) else mastered_at end,
    updated_at=now()
  where user_id=v_user and skill_id=p_skill_id
  returning * into v_us;

  if v_verified then
    select * into v_profile from public.system_award_xp(v_skill.xp_reward,'SKILL',v_skill.name,jsonb_build_object('skill_id',v_skill.id));
    insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
      values(v_user,'SKILL_MASTERED',v_skill.name,v_reason,'SKILL',v_skill.id::text,v_skill.xp_reward,jsonb_build_object('value',v_value,'unit',v_skill.mastery_unit));
    v_mastered_now := true;
  end if;

  return jsonb_build_object('mastered',v_verified,'mastered_now',v_mastered_now,'reason',v_reason,'skill_id',p_skill_id,'value',v_value,'target',v_target,'unit',v_skill.mastery_unit,'status',v_us.status);
end;
$$;

create or replace function public.system_submit_skill_attempt(
  p_skill_id bigint,
  p_value numeric default null,
  p_unit text default null,
  p_proof_record_id bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid := auth.uid();
  v_skill public.skills;
  v_proof public.proof_records;
  v_attempt public.skill_attempts;
  v_result jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.system_skill_available(p_skill_id) then raise exception 'SKILL_LOCKED_OR_UNAVAILABLE'; end if;
  select * into v_skill from public.skills where id=p_skill_id and is_active=true;
  if p_value is not null and p_value < 0 then raise exception 'INVALID_SKILL_VALUE'; end if;
  if p_proof_record_id is not null then
    select * into v_proof from public.proof_records where id=p_proof_record_id and user_id=v_user;
    if not found then raise exception 'PROOF_NOT_FOUND'; end if;
    update public.proof_records set related_event_type='SKILL',related_event_id=p_skill_id::text where id=p_proof_record_id;
  end if;
  insert into public.skill_attempts(user_id,skill_id,proof_record_id,submitted_value,submitted_unit,metadata)
    values(v_user,p_skill_id,p_proof_record_id,p_value,p_unit,coalesce(p_metadata,'{}'::jsonb)) returning * into v_attempt;
  update public.user_skills set attempts=attempts+1,updated_at=now() where user_id=v_user and skill_id=p_skill_id;
  if not found then
    insert into public.user_skills(user_id,skill_id,status,started_at,attempts,updated_at)
      values(v_user,p_skill_id,'IN_PROGRESS',now(),1,now());
  end if;
  v_result := public.system_evaluate_skill(p_skill_id);
  update public.skill_attempts set status=case when coalesce((v_result->>'mastered')::boolean,false) then 'MASTERED' else 'RECORDED' end,result=v_result where id=v_attempt.id;
  return jsonb_build_object('attempt_id',v_attempt.id,'evaluation',v_result);
end;
$$;

-- 4) Automatic achievement evaluation based only on backend facts.
create or replace function public.system_evaluate_achievements()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid := auth.uid();
  a public.achievements;
  v_type text;
  v_target numeric;
  v_progress numeric;
  v_unlock boolean;
  v_new integer := 0;
  v_profile public.profiles;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_profile from public.profiles where id=v_user;
  for a in select * from public.achievements where active=true loop
    v_type := a.criteria->>'type';
    v_target := coalesce((a.criteria->>'target')::numeric,1);
    v_progress := 0;
    if v_type='quest_count' then
      select count(*) into v_progress from public.user_quests where user_id=v_user and status='COMPLETED';
    elsif v_type='streak' then v_progress := coalesce(v_profile.streak,0);
    elsif v_type='boss_rank' then
      select count(*) into v_progress from public.boss_quests where user_id=v_user and status='COMPLETE' and rank=a.criteria->>'rank';
    elsif v_type='mastered_skills' then
      select count(*) into v_progress from public.user_skills where user_id=v_user and status='MASTERED';
    elsif v_type='performance_metric' then
      select coalesce(max(value),0) into v_progress from public.performance_logs where user_id=v_user and upper(metric)=upper(a.criteria->>'metric');
      if upper(coalesce(a.criteria->>'metric',''))='RUN DISTANCE' then
        select greatest(v_progress,coalesce(max(distance_km),0)) into v_progress from public.gps_sessions where user_id=v_user and gps_verified=true;
      end if;
    elsif v_type='wealth_logs' then select count(*) into v_progress from public.wealth_logs where user_id=v_user;
    elsif v_type='completed_goals' then select count(*) into v_progress from public.goals where user_id=v_user and status='COMPLETED';
    elsif v_type='proof_count' then select count(*) into v_progress from public.proof_records where user_id=v_user;
    elsif v_type='level' then v_progress := v_profile.level;
    end if;
    v_unlock := v_progress >= v_target;
    insert into public.user_achievements(user_id,achievement_id,progress,target,unlocked,unlocked_at,updated_at)
      values(v_user,a.id,v_progress,v_target,v_unlock,case when v_unlock then now() else null end,now())
      on conflict(user_id,achievement_id) do update set
        progress=excluded.progress,target=excluded.target,
        unlocked=public.user_achievements.unlocked or excluded.unlocked,
        unlocked_at=case when public.user_achievements.unlocked then public.user_achievements.unlocked_at when excluded.unlocked then now() else null end,
        updated_at=now();
    if v_unlock and not exists(select 1 from public.journey_events where user_id=v_user and event_type='ACHIEVEMENT_UNLOCKED' and source_id=a.id::text) then
      perform public.system_award_xp(a.xp_reward,'ACHIEVEMENT',a.name,jsonb_build_object('achievement_id',a.id));
      insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
        values(v_user,'ACHIEVEMENT_UNLOCKED',a.name,a.category,'ACHIEVEMENT',a.id::text,a.xp_reward,jsonb_build_object('rarity',a.rarity));
      v_new := v_new+1;
    end if;
  end loop;
  return jsonb_build_object('new_unlocks',v_new);
end;
$$;

create or replace function public.system_evaluate_titles()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid := auth.uid();
  t public.title_catalog;
  v_profile public.profiles;
  v_ok boolean;
  v_new integer:=0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_profile from public.profiles where id=v_user;
  for t in select * from public.title_catalog where active=true loop
    v_ok := v_profile.level >= t.minimum_level and (t.class_affinity is null or t.class_affinity=v_profile.class);
    if t.slug='first-blood' then v_ok := v_ok and exists(select 1 from public.user_quests where user_id=v_user and status='COMPLETED');
    elsif t.slug='scholar' then v_ok := v_ok and exists(select 1 from public.learning_records where user_id=v_user);
    elsif t.slug='early-riser' then
      v_ok := v_ok and exists(select 1 from public.proof_records where user_id=v_user and (upper(title) like '%WAKE%' or metadata->>'routine_type'='WAKE') and verification_status='VERIFIED');
    elsif t.category='ASCENSION' then v_ok := v_ok and v_profile.level>=101;
    end if;
    if v_ok then
      insert into public.user_titles(user_id,title_id,source,metadata)
        values(v_user,t.id,'SYSTEM',jsonb_build_object('reason','BACKEND_CRITERIA'))
        on conflict(user_id,title_id) do nothing;
      if found then
        insert into public.journey_events(user_id,event_type,title,detail,source,source_id,metadata)
          values(v_user,'TITLE_UNLOCKED',t.name,t.category,'TITLE',t.id::text,jsonb_build_object('rarity',t.rarity));
        v_new:=v_new+1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('new_unlocks',v_new);
end;
$$;

-- 5) Server-owned Boss library and assignment.
create table if not exists public.boss_library (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  rank text not null check(rank in ('E','D','C','B','A','S')),
  category text not null,
  class_affinity text[] not null default '{}',
  min_level integer not null default 1,
  max_level integer,
  max_hp integer not null check(max_hp>0),
  xp_reward integer not null default 0 check(xp_reward>=0),
  reward_name text,
  reward_rarity text,
  objective_templates jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.boss_library enable row level security;
drop policy if exists boss_library_read_authenticated on public.boss_library;
create policy boss_library_read_authenticated on public.boss_library for select to authenticated using(active=true);

insert into public.boss_library(slug,title,rank,category,class_affinity,min_level,max_level,max_hp,xp_reward,reward_name,reward_rarity,objective_templates)
values
('assassin-shadow-trial','THE SHADOW TRIAL','E','PRECISION',array['ASSASSIN'],1,15,120,120,'SHADOW SIGIL','RARE','["Complete 2 precision or speed actions","Complete 1 discipline quest"]'),
('tank-iron-gate','THE IRON GATE','E','RESILIENCE',array['TANK'],1,15,140,120,'IRON CREST','RARE','["Complete 2 strength workouts","Complete 1 recovery action"]'),
('mage-archive-keeper','THE ARCHIVE KEEPER','E','KNOWLEDGE',array['MAGE'],1,15,110,120,'ARCANE PAGE','RARE','["Complete 2 learning records","Master or progress 1 Mage skill"]'),
('ranger-distance-wraith','THE DISTANCE WRAITH','E','ENDURANCE',array['RANGER'],1,15,130,120,'TRAIL MARK','RARE','["Record verified movement","Complete 1 endurance action"]'),
('commander-fractured-order','THE FRACTURED ORDER','E','DISCIPLINE',array['COMMANDER'],1,15,125,120,'COMMAND SEAL','RARE','["Complete 2 discipline quests","Complete 1 planning or wealth action"]'),
('system-c-rank-warden','THE C-RANK WARDEN','C','SYSTEM',array[]::text[],16,45,300,320,'WARDEN KEY','EPIC','["Complete 3 active quests","Complete 2 class-aligned actions","Reduce Boss HP to zero"]'),
('system-a-rank-sovereign','THE A-RANK SOVEREIGN','A','SYSTEM',array[]::text[],46,80,560,650,'SOVEREIGN RELIC','LEGENDARY','["Complete 5 active quests","Master or advance 2 skills","Complete 3 verified actions","Reduce Boss HP to zero"]'),
('system-s-rank-ascendant','THE ASCENDANT','S','ASCENSION',array[]::text[],81,null,900,1200,'ASCENDANT CORE','MYTHIC','["Complete 7 active quests","Master 3 skills","Complete 5 verified actions","Reduce Boss HP to zero"]')
on conflict(slug) do update set title=excluded.title,rank=excluded.rank,category=excluded.category,class_affinity=excluded.class_affinity,min_level=excluded.min_level,max_level=excluded.max_level,max_hp=excluded.max_hp,xp_reward=excluded.xp_reward,reward_name=excluded.reward_name,reward_rarity=excluded.reward_rarity,objective_templates=excluded.objective_templates,active=true;

create or replace function public.system_assign_boss()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid:=auth.uid();
  v_profile public.profiles;
  v_existing public.boss_quests;
  v_template public.boss_library;
  v_boss public.boss_quests;
  v_obj text;
  v_pos integer:=0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_existing from public.boss_quests where user_id=v_user and status='ACTIVE' order by created_at desc limit 1;
  if found then return jsonb_build_object('assigned',false,'reason','ACTIVE_BOSS_EXISTS','boss',to_jsonb(v_existing)); end if;
  select * into v_profile from public.profiles where id=v_user;
  select * into v_template from public.boss_library
   where active=true and min_level<=v_profile.level and (max_level is null or max_level>=v_profile.level)
     and (cardinality(class_affinity)=0 or v_profile.class=any(class_affinity))
   order by case when v_profile.class=any(class_affinity) then 0 else 1 end, rank desc, random()
   limit 1;
  if not found then raise exception 'NO_BOSS_TEMPLATE_AVAILABLE'; end if;
  insert into public.boss_quests(user_id,title,rank,category,deadline,xp_reward,reward_name,reward_rarity,status,system_assigned,max_hp,hp,metadata)
   values(v_user,v_template.title,v_template.rank,v_template.category,now()+interval '7 days',v_template.xp_reward,v_template.reward_name,v_template.reward_rarity,'ACTIVE',true,v_template.max_hp,v_template.max_hp,jsonb_build_object('boss_library_id',v_template.id,'boss_slug',v_template.slug)) returning * into v_boss;
  for v_obj in select jsonb_array_elements_text(v_template.objective_templates) loop
    v_pos:=v_pos+1;
    insert into public.boss_quest_objectives(user_id,boss_quest_id,objective,position,is_complete) values(v_user,v_boss.id,v_obj,v_pos,false);
  end loop;
  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,metadata)
   values(v_user,'BOSS_ASSIGNED',v_boss.title,v_boss.rank||'-RANK SYSTEM BOSS','BOSS',v_boss.id::text,jsonb_build_object('system_assigned',true));
  return jsonb_build_object('assigned',true,'boss',to_jsonb(v_boss));
end;
$$;

-- 6) Safe grants: PUBLIC/anon get nothing; authenticated may only call validated high-level evaluators/actions.
revoke all on function public.system_skill_available(bigint) from public, anon;
revoke all on function public.system_evaluate_skill(bigint) from public, anon;
revoke all on function public.system_submit_skill_attempt(bigint,numeric,text,bigint,jsonb) from public, anon;
revoke all on function public.system_evaluate_achievements() from public, anon;
revoke all on function public.system_evaluate_titles() from public, anon;
revoke all on function public.system_assign_boss() from public, anon;
grant execute on function public.system_skill_available(bigint) to authenticated, service_role;
grant execute on function public.system_evaluate_skill(bigint) to authenticated, service_role;
grant execute on function public.system_submit_skill_attempt(bigint,numeric,text,bigint,jsonb) to authenticated, service_role;
grant execute on function public.system_evaluate_achievements() to authenticated, service_role;
grant execute on function public.system_evaluate_titles() to authenticated, service_role;
grant execute on function public.system_assign_boss() to authenticated, service_role;

grant select on public.boss_library to authenticated;
revoke insert,update,delete on public.boss_library from authenticated, anon;
revoke insert,update,delete on public.skill_attempts from authenticated, anon;

