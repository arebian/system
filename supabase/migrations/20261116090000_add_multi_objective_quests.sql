-- THE SYSTEM: multi-objective quest foundation.
-- Additive only: preserves user_quests, quest_library, classes and existing progression.
-- Apply only through the normal migration/release workflow after review.

create table if not exists public.quest_task_library (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  objective text not null,
  pillar text not null check (pillar in ('DISCIPLINE','PHYSICAL','INTELLECT','WEALTH','SOCIAL','MENTAL','SPIRITUAL')),
  difficulty text not null default 'NORMAL' check (difficulty in ('EASY','NORMAL','HARD','ELITE')),
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 240),
  min_level integer not null default 1 check (min_level >= 1),
  xp_reward integer not null default 0 check (xp_reward between 0 and 100),
  proof_type text not null default 'HONOR' check (proof_type in ('HONOR','NOTE','TIMER','PHOTO','METRIC')),
  safety_notes text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quest_task_library_pillar_idx
  on public.quest_task_library(pillar, active, min_level);

alter table public.quest_task_library enable row level security;
revoke all on public.quest_task_library from anon, authenticated;
grant select on public.quest_task_library to authenticated;
grant all on public.quest_task_library to service_role;

drop policy if exists quest_task_library_authenticated_read on public.quest_task_library;
create policy quest_task_library_authenticated_read
  on public.quest_task_library for select to authenticated using (active = true);

insert into public.quest_task_library
  (code,title,objective,pillar,difficulty,duration_minutes,min_level,xp_reward,proof_type,safety_notes)
values
('DISCIPLINE_PLAN_TOMORROW','PLAN TOMORROW','Write the three most important actions for tomorrow and choose when you will do them.','DISCIPLINE','EASY',5,1,10,'NOTE',null),
('DISCIPLINE_CLOSE_LOOP','CLOSE ONE LOOP','Finish one small responsibility you have been postponing. Define what finished means before starting.','DISCIPLINE','NORMAL',20,1,15,'NOTE',null),
('DISCIPLINE_FOCUS_BLOCK','PROTECTED FOCUS BLOCK','Complete one uninterrupted 25-minute work block on a priority task.','DISCIPLINE','NORMAL',25,2,20,'TIMER',null),
('PHYSICAL_MOVE','MOVE YOUR BODY','Complete 10 minutes of comfortable movement suited to your current ability.','PHYSICAL','EASY',10,1,10,'HONOR','Stop if you feel pain, dizziness or unusual shortness of breath. Adapt to your ability.'),
('PHYSICAL_STRENGTH','STRENGTH SESSION','Complete a short, familiar strength routine with controlled technique.','PHYSICAL','NORMAL',20,2,20,'METRIC','Use exercises appropriate to your ability; do not train through pain.'),
('PHYSICAL_ENDURANCE','ENDURANCE BLOCK','Complete 20 minutes of brisk walking, cycling or another manageable aerobic activity.','PHYSICAL','NORMAL',20,3,20,'TIMER','Adjust intensity to your fitness and health; stop if unwell.'),
('INTELLECT_READ','READ AND RECALL','Read for 15 minutes, then write three points you remember without looking.','INTELLECT','EASY',20,1,10,'NOTE',null),
('INTELLECT_LEARN','SKILL PRACTICE','Spend 20 focused minutes practising one useful skill and record what improved.','INTELLECT','NORMAL',20,2,15,'NOTE',null),
('INTELLECT_SYNTHESIZE','TEACH BACK','Explain one thing you learned today in your own words, in writing or aloud.','INTELLECT','NORMAL',15,3,20,'NOTE',null),
('WEALTH_TRACK','MONEY CHECK-IN','Record today's spending and review one upcoming financial commitment.','WEALTH','EASY',10,1,10,'NOTE','Do not share account numbers, passwords or sensitive financial credentials.'),
('WEALTH_BUILD','BUILD AN ASSET','Spend 25 minutes on a practical income, career or business-building action.','WEALTH','NORMAL',25,2,20,'TIMER',null),
('WEALTH_RESEARCH','OPPORTUNITY RESEARCH','Research one realistic opportunity and write its costs, risks and next step.','WEALTH','NORMAL',20,3,20,'NOTE','Avoid committing money based only on unverified claims.'),
('SOCIAL_REACH_OUT','MEANINGFUL CONNECTION','Reach out to someone with a thoughtful message or check-in.','SOCIAL','EASY',5,1,10,'HONOR',null),
('SOCIAL_COMMUNICATE','PRACTISE COMMUNICATION','Have one intentional conversation and practise listening without interrupting.','SOCIAL','NORMAL',15,2,15,'HONOR',null),
('SOCIAL_COURAGE','COURAGEOUS ASK','Make one respectful request, introduce yourself or ask a useful question you have been avoiding.','SOCIAL','NORMAL',10,3,20,'HONOR',null),
('MENTAL_REFLECT','MENTAL CHECK-IN','Take five quiet minutes to name what you are feeling and one helpful next action.','MENTAL','EASY',5,1,10,'NOTE',null),
('MENTAL_RESET','RESET YOUR ATTENTION','Take a short screen-free break, then return to one chosen task.','MENTAL','EASY',10,1,10,'TIMER',null),
('MENTAL_RESILIENCE','REVIEW A SETBACK','Write what happened, what was in your control and one adjustment for next time.','MENTAL','NORMAL',15,2,15,'NOTE',null),
('SPIRITUAL_REFLECT','VALUES REFLECTION','Spend 10 minutes reflecting on a value you want your actions to represent.','SPIRITUAL','EASY',10,1,10,'NOTE',null),
('SPIRITUAL_PURPOSE','PURPOSEFUL ACTION','Do one small action today that aligns with a value or commitment that matters to you.','SPIRITUAL','NORMAL',15,2,15,'HONOR',null),
('SPIRITUAL_GRATITUDE','GRATITUDE PRACTICE','Record three specific things you are grateful for and why they matter.','SPIRITUAL','EASY',5,1,10,'NOTE',null)
on conflict (code) do update set
  title=excluded.title,
  objective=excluded.objective,
  pillar=excluded.pillar,
  difficulty=excluded.difficulty,
  duration_minutes=excluded.duration_minutes,
  min_level=excluded.min_level,
  xp_reward=excluded.xp_reward,
  proof_type=excluded.proof_type,
  safety_notes=excluded.safety_notes,
  updated_at=now();

create table if not exists public.user_quest_objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_quest_id uuid not null references public.user_quests(id) on delete cascade,
  task_id uuid references public.quest_task_library(id) on delete set null,
  title_snapshot text not null,
  objective_snapshot text not null,
  pillar text not null check (pillar in ('DISCIPLINE','PHYSICAL','INTELLECT','WEALTH','SOCIAL','MENTAL','SPIRITUAL')),
  difficulty text not null check (difficulty in ('EASY','NORMAL','HARD','ELITE')),
  duration_minutes integer not null check (duration_minutes > 0),
  xp_reward integer not null default 0 check (xp_reward between 0 and 100),
  proof_type text not null default 'HONOR',
  status text not null default 'PROPOSED' check (status in ('PROPOSED','ACCEPTED','REJECTED','COMPLETED')),
  recommendation_reason text,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_quest_objectives_parent_idx
  on public.user_quest_objectives(user_quest_id, created_at);
create index if not exists user_quest_objectives_user_status_idx
  on public.user_quest_objectives(user_id, status);

alter table public.user_quest_objectives enable row level security;
revoke all on public.user_quest_objectives from anon;
grant select on public.user_quest_objectives to authenticated;
grant all on public.user_quest_objectives to service_role;

drop policy if exists user_quest_objectives_select_own on public.user_quest_objectives;
create policy user_quest_objectives_select_own
  on public.user_quest_objectives for select to authenticated
  using ((select auth.uid()) = user_id);

-- AI recommendations are submitted as task-library IDs, never arbitrary task text or XP.
-- The player must explicitly accept/reject each proposal before it can become active.
create or replace function public.system_propose_quest_objectives(
  p_user_quest_id uuid,
  p_task_ids uuid[],
  p_reasons text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_parent public.user_quests;
  v_task public.quest_task_library;
  v_id uuid;
  v_count integer := 0;
  v_result jsonb := '[]'::jsonb;
  v_profile_data jsonb;
  v_identity jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(array_length(p_task_ids,1),0) < 1 or array_length(p_task_ids,1) > 3 then
    raise exception 'OBJECTIVE_COUNT_MUST_BE_1_TO_3';
  end if;
  if (select count(distinct x) from unnest(p_task_ids) x) <> array_length(p_task_ids,1) then
    raise exception 'DUPLICATE_OBJECTIVE';
  end if;

  select * into v_parent from public.user_quests
  where id=p_user_quest_id and user_id=v_user for update;
  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if v_parent.status not in ('ASSIGNED','ACCEPTED') then raise exception 'QUEST_NOT_OPEN'; end if;

  select profile_data into v_profile_data from public.profiles where id=v_user;
  v_identity := coalesce(v_profile_data->'identity','{}'::jsonb);

  if exists (
    select 1 from public.user_quest_objectives
    where user_quest_id=p_user_quest_id and status='COMPLETED'
  ) then raise exception 'OBJECTIVES_ALREADY_STARTED'; end if;

  delete from public.user_quest_objectives
  where user_quest_id=p_user_quest_id and status in ('PROPOSED','REJECTED');

  foreach v_id in array p_task_ids loop
    select * into v_task from public.quest_task_library
    where id=v_id and active=true and min_level <= (
      select level from public.profiles where id=v_user
    );
    if not found then raise exception 'TASK_NOT_AVAILABLE'; end if;

    insert into public.user_quest_objectives(
      user_id,user_quest_id,task_id,title_snapshot,objective_snapshot,pillar,
      difficulty,duration_minutes,xp_reward,proof_type,status,recommendation_reason
    ) values (
      v_user,p_user_quest_id,v_task.id,v_task.title,v_task.objective,v_task.pillar,
      v_task.difficulty,v_task.duration_minutes,v_task.xp_reward,v_task.proof_type,
      'PROPOSED',coalesce(p_reasons[v_count+1],'Recommended for your identity and current progression.')
    ) returning to_jsonb(user_quest_objectives) into v_result;
    v_count := v_count + 1;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at,o.id),'[]'::jsonb)
  into v_result from public.user_quest_objectives o
  where o.user_quest_id=p_user_quest_id and o.status='PROPOSED';

  return jsonb_build_object('status','PROPOSED','objectives',v_result);
end;
$$;

create or replace function public.system_decide_quest_objective(
  p_objective_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_objective public.user_quest_objectives;
  v_parent public.user_quests;
  v_next text := upper(trim(coalesce(p_decision,'')));
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_next not in ('ACCEPT','REJECT') then raise exception 'INVALID_OBJECTIVE_DECISION'; end if;

  select * into v_objective from public.user_quest_objectives
  where id=p_objective_id and user_id=v_user for update;
  if not found then raise exception 'OBJECTIVE_NOT_FOUND'; end if;
  if v_objective.status <> 'PROPOSED' then raise exception 'OBJECTIVE_NOT_PROPOSED'; end if;

  select * into v_parent from public.user_quests
  where id=v_objective.user_quest_id and user_id=v_user for update;
  if not found or v_parent.status not in ('ASSIGNED','ACCEPTED') then raise exception 'PARENT_QUEST_NOT_OPEN'; end if;

  update public.user_quest_objectives
  set status=case when v_next='ACCEPT' then 'ACCEPTED' else 'REJECTED' end,
      updated_at=now()
  where id=v_objective.id
  returning * into v_objective;

  return jsonb_build_object('status',v_objective.status,'objective',to_jsonb(v_objective));
end;
$$;

revoke all on function public.system_propose_quest_objectives(uuid,uuid[],text[]) from public, anon;
revoke all on function public.system_decide_quest_objective(uuid,text) from public, anon;
grant execute on function public.system_propose_quest_objectives(uuid,uuid[],text[]) to authenticated;
grant execute on function public.system_decide_quest_objective(uuid,text) to authenticated;
