-- Pillar-based daily quest integrity and cement progression.
-- A pillar quest is tagged by the authoritative must-quest acceptance RPC.

-- Replace vague legacy instructions in the three daily pillar tracks with concrete completion criteria.
update public.quest_task_library set objective =
  'Select one responsibility that can be finished in 20 minutes. Write the exact end result, work on it for one 20-minute timer without switching, then record the completed output.'
where code='DISCIPLINE_CLOSE_LOOP';

update public.quest_task_library set objective =
  'Choose the highest-priority unfinished task. Set a 25-minute timer, silence notifications, keep one task open, and save or submit the result before stopping.'
where code='DISCIPLINE_FOCUS_BLOCK';

update public.quest_task_library set objective =
  'Write three specific actions for tomorrow. For each, assign a start time and first physical step. Put the list somewhere you will see it.'
where code='DISCIPLINE_PLAN_TOMORROW';

update public.quest_task_library set objective =
  'Complete 20 minutes of brisk walking or cycling at a pace that allows full-sentence conversation. Record the minutes and effort from 1 to 10.'
where code='PHYSICAL_ENDURANCE';

update public.quest_task_library set objective =
  'Complete 2 rounds: 10 bodyweight squats, 8 wall or incline push-ups, 12 glute bridges and a 20-second plank. Rest 60 seconds between rounds; stop if form breaks.'
where code='PHYSICAL_MOVE';

update public.quest_task_library set objective =
  'Complete 3 controlled rounds: 8 reverse lunges per side, 8 incline push-ups, 12 glute bridges and a 20-second side plank per side. Rest 60 seconds; use a stable support if needed.'
where code='PHYSICAL_STRENGTH';

update public.quest_task_library set objective =
  'Spend 5 minutes writing: (1) what am I feeling? (2) what triggered it? (3) what is one useful next action?'
where code='MENTAL_REFLECT';

update public.quest_task_library set objective =
  'Take a 10-minute screen-free break. Set a timer, walk or sit quietly, then write the first action you will take when you return.'
where code='MENTAL_RESET';

update public.quest_task_library set objective =
  'Write one recent setback in 3 parts: what happened, what was within your control, and one specific adjustment you will test next time.'
where code='MENTAL_RESILIENCE';

-- Expand each pillar to six actionable options so rejected missions can be replaced.
insert into public.quest_task_library(
  code,title,objective,pillar,difficulty,duration_minutes,min_level,xp_reward,proof_type,active
) values
  ('DISCIPLINE_START_BLOCK','START THE FIRST BLOCK','Choose one priority due today. Write the exact output you will finish, set a 20-minute timer, work without switching tasks, then record the output.','DISCIPLINE','NORMAL',20,1,15,'TIMER',true),
  ('DISCIPLINE_CLEAR_SPACE','RESET YOUR WORKSPACE','Spend 10 minutes clearing your main work surface. Put away unrelated items, open only the tools needed for your next task, and begin that task before leaving.','DISCIPLINE','EASY',10,1,10,'NOTE',true),
  ('DISCIPLINE_CLOSE_ADMIN','CLOSE ONE ADMIN TASK','Choose one pending message, bill, booking or form that takes 15 minutes or less. Complete and send/submit it; record what was closed.','DISCIPLINE','NORMAL',15,1,15,'NOTE',true),
  ('INTELLECT_ACTIVE_RECALL','ACTIVE RECALL DRILL','Study one topic for 12 minutes. Close the source and write five facts or steps from memory, then reopen it and correct the gaps.','INTELLECT','NORMAL',18,1,15,'NOTE',true),
  ('INTELLECT_SKILL_REPS','SKILL REPETITIONS','Choose one skill you are building. Complete three 5-minute practice rounds, each with one specific correction, then record what improved.','INTELLECT','NORMAL',15,1,15,'TIMER',true),
  ('INTELLECT_EXPLAIN_THREE','EXPLAIN THREE IDEAS','Choose one topic you studied. Explain three key ideas in your own words without copying the source; include one real-world example.','INTELLECT','NORMAL',15,1,15,'NOTE',true),
  ('PHYSICAL_BODYWEIGHT_BASE','BODYWEIGHT FOUNDATION','Complete 2 controlled rounds: 8 bodyweight squats, 6 wall or incline push-ups, 10 calf raises and a 20-second plank. Rest 60 seconds between rounds; stop if form breaks.','PHYSICAL','NORMAL',12,1,15,'NOTE',true),
  ('PHYSICAL_BRISK_WALK','BRISK WALK BLOCK','Walk continuously for 15 minutes at a pace that raises your breathing slightly while still allowing you to speak in full sentences. Record the duration.','PHYSICAL','EASY',15,1,12,'TIMER',true),
  ('PHYSICAL_MOBILITY_FLOW','MOBILITY SEQUENCE','Complete 2 slow rounds: 8 cat-cow reps, 8 hip circles per side, 10 shoulder circles and a 30-second calf stretch per side. Move only through comfortable ranges.','PHYSICAL','EASY',10,1,12,'NOTE',true),
  ('WEALTH_SKILL_BLOCK','INCOME SKILL BLOCK','Spend 20 uninterrupted minutes practising one skill that can improve your earning ability. Produce one visible output such as a sample, draft, exercise or portfolio update.','WEALTH','NORMAL',20,1,18,'TIMER',true),
  ('WEALTH_EXPENSE_AUDIT','REVIEW TODAY’S SPENDING','Record every expense from today, assign each one a category, total the amount, and identify one expense to plan for or reduce.','WEALTH','EASY',12,1,12,'NOTE',true),
  ('WEALTH_CREATE_OFFER','IMPROVE ONE OFFER','Choose one product or service you could sell. Write a clear one-sentence benefit, identify the intended buyer, and create or improve one sales asset.','WEALTH','NORMAL',20,1,18,'NOTE',true),
  ('SOCIAL_LISTENING_REP','LISTENING PRACTICE','Have one conversation. Ask two open questions, let the other person finish without interruption, and summarise one point they made before responding.','SOCIAL','NORMAL',10,1,15,'NOTE',true),
  ('SOCIAL_PROFESSIONAL_REACH','PROFESSIONAL OUTREACH','Send one thoughtful message to a relevant contact. Mention why you are reaching out and make one clear, respectful request or offer.','SOCIAL','NORMAL',10,1,15,'NOTE',true),
  ('SOCIAL_ACT_OF_HELP','PRACTICAL ACT OF HELP','Identify one person who would benefit from a small practical action. Offer or complete that action, then record what you did.','SOCIAL','EASY',10,1,12,'NOTE',true),
  ('MENTAL_BREATH_RESET','BREATHING RESET','Sit comfortably for five minutes. Breathe gently with a slightly longer exhale, without forcing or holding your breath; record your state before and after.','MENTAL','EASY',5,1,10,'TIMER',true),
  ('MENTAL_THOUGHT_CHECK','CHECK THE THOUGHT','Write one stressful thought. Separate the observable facts from your interpretation, list one alternative explanation, and choose one useful next action.','MENTAL','NORMAL',12,1,15,'NOTE',true),
  ('MENTAL_SCREEN_BREAK','SCREEN-FREE RESET','Take a 12-minute break away from all screens. Walk, stretch or sit quietly, then return and write the next action for your current task.','MENTAL','EASY',12,1,10,'TIMER',true),
  ('SPIRITUAL_QUIET_REFLECTION','QUIET REFLECTION','Spend 10 quiet minutes in prayer, meditation or personal reflection according to your own practice. Write one insight and one action it suggests.','SPIRITUAL','EASY',10,1,12,'TIMER',true),
  ('SPIRITUAL_SERVICE_ACTION','ACT OF SERVICE','Complete one specific helpful action for another person without expecting a reward. Record what you chose to do and why.','SPIRITUAL','NORMAL',15,1,15,'NOTE',true),
  ('SPIRITUAL_VALUE_IN_ACTION','PUT A VALUE INTO ACTION','Choose one personal value. Write one behaviour that demonstrates it, carry out that behaviour today, and record the result.','SPIRITUAL','NORMAL',12,1,15,'NOTE',true)
on conflict (code) do update set
  title=excluded.title,
  objective=excluded.objective,
  pillar=excluded.pillar,
  difficulty=excluded.difficulty,
  duration_minutes=excluded.duration_minutes,
  min_level=excluded.min_level,
  xp_reward=excluded.xp_reward,
  proof_type=excluded.proof_type,
  active=excluded.active,
  updated_at=now();

create table if not exists public.user_pillar_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar text not null check (pillar = any (array[
    'DISCIPLINE','PHYSICAL','INTELLECT','WEALTH','SOCIAL','MENTAL','SPIRITUAL'
  ])),
  cement integer not null default 0 check (cement >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pillar)
);

alter table public.user_pillar_progress enable row level security;
drop policy if exists "Users can read their own pillar progress" on public.user_pillar_progress;
create policy "Users can read their own pillar progress"
  on public.user_pillar_progress for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.user_pillar_progress to authenticated;

create or replace function public.system_guard_pillar_quest_objective()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_metadata jsonb;
  v_target_pillar text;
begin
  select q.metadata into v_metadata
  from public.user_quests q
  where q.id = new.user_quest_id and q.user_id = new.user_id;

  if coalesce(v_metadata->>'pillar_quest','false') = 'true' then
    v_target_pillar := upper(coalesce(v_metadata->>'target_pillar',''));
    if v_target_pillar not in (
      'DISCIPLINE','PHYSICAL','INTELLECT','WEALTH','SOCIAL','MENTAL','SPIRITUAL'
    ) then
      raise exception 'PILLAR_QUEST_TARGET_INVALID';
    end if;
    if upper(coalesce(new.pillar,'')) <> v_target_pillar then
      raise exception 'OBJECTIVE_PILLAR_MISMATCH';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists user_quest_objectives_match_parent_pillar on public.user_quest_objectives;
create trigger user_quest_objectives_match_parent_pillar
  before insert or update of user_quest_id, user_id, pillar
  on public.user_quest_objectives
  for each row execute function public.system_guard_pillar_quest_objective();

create or replace function public.system_guard_parent_quest_objectives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_total integer;
  v_completed integer;
  v_pillar_count integer;
  v_target_pillar text;
begin
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    if coalesce(new.metadata->>'pillar_quest','false') = 'true' then
      v_target_pillar := upper(coalesce(new.metadata->>'target_pillar',''));
      if v_target_pillar not in (
        'DISCIPLINE','PHYSICAL','INTELLECT','WEALTH','SOCIAL','MENTAL','SPIRITUAL'
      ) then
        raise exception 'PILLAR_QUEST_TARGET_INVALID';
      end if;

      select
        count(*) filter (where status in ('PROPOSED','ACCEPTED','COMPLETED')),
        count(*) filter (where status = 'COMPLETED'),
        count(distinct pillar) filter (where status in ('PROPOSED','ACCEPTED','COMPLETED'))
      into v_total, v_completed, v_pillar_count
      from public.user_quest_objectives
      where user_quest_id = new.id and user_id = new.user_id;

      if v_total <> 3 or v_completed <> 3 or v_pillar_count <> 1 then
        raise exception 'QUEST_OBJECTIVES_INCOMPLETE';
      end if;

      if exists (
        select 1 from public.user_quest_objectives o
        where o.user_quest_id = new.id
          and o.user_id = new.user_id
          and o.status = 'COMPLETED'
          and upper(o.pillar) <> v_target_pillar
      ) then
        raise exception 'OBJECTIVE_PILLAR_MISMATCH';
      end if;

      if coalesce(new.metadata->>'pillar_cement_awarded_at','') = '' then
        new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
          'pillar_cement_awarded_at', now(),
          'pillar_cement_amount', 1
        );
      end if;
    else
      select count(*), count(*) filter (where status='COMPLETED')
        into v_total, v_completed
      from public.user_quest_objectives
      where user_quest_id = new.id and user_id = new.user_id
        and status in ('ACCEPTED','COMPLETED');

      if upper(trim(coalesce(new.title_snapshot,''))) = 'NO ZERO DAY' then
        if v_total <> 3 or v_completed <> 3 then
          raise exception 'QUEST_OBJECTIVES_INCOMPLETE';
        end if;
      elsif v_total > 0 and (v_total <> 3 or v_completed <> 3) then
        raise exception 'QUEST_OBJECTIVES_INCOMPLETE';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.system_award_pillar_cement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pillar text;
begin
  if new.status = 'COMPLETED'
     and old.status is distinct from 'COMPLETED'
     and coalesce(new.metadata->>'pillar_quest','false') = 'true'
     and coalesce(old.metadata->>'pillar_cement_awarded_at','') = ''
     and coalesce(new.metadata->>'pillar_cement_awarded_at','') <> '' then
    v_pillar := upper(new.metadata->>'target_pillar');

    insert into public.user_pillar_progress as progress(user_id,pillar,cement)
    values(new.user_id,v_pillar,1)
    on conflict (user_id,pillar) do update
      set cement = progress.cement + 1,
          updated_at = now();

    insert into public.journey_events(
      user_id,event_type,title,detail,source,source_id,metadata
    ) values (
      new.user_id,
      'PILLAR_CEMENT_AWARDED',
      v_pillar || ' PILLAR',
      'One cement unit added after all three missions passed review.',
      'PILLAR_QUEST',
      new.id::text,
      jsonb_build_object('pillar',v_pillar,'cement',1,'user_quest_id',new.id)
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists user_quests_award_pillar_cement on public.user_quests;
create trigger user_quests_award_pillar_cement
  after update of status on public.user_quests
  for each row execute function public.system_award_pillar_cement();


-- Completing mission three closes the pillar quest in the same transaction.
create or replace function public.system_complete_quest_objective(p_objective_id uuid, p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_objective public.user_quest_objectives;
  v_parent public.user_quests;
  v_profile public.profiles;
  v_review public.system_quest_reviews;
  v_note text;
  v_completed integer := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_objective
  from public.user_quest_objectives
  where id=p_objective_id and user_id=v_user
  for update;
  if not found then raise exception 'OBJECTIVE_NOT_FOUND'; end if;
  if v_objective.status='COMPLETED' then
    return jsonb_build_object('duplicate',true,'objective',to_jsonb(v_objective));
  end if;
  if v_objective.status <> 'ACCEPTED' then raise exception 'OBJECTIVE_NOT_ACCEPTED'; end if;

  select * into v_parent
  from public.user_quests
  where id=v_objective.user_quest_id and user_id=v_user
  for update;
  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if v_parent.status not in ('ASSIGNED','ACCEPTED') then raise exception 'QUEST_NOT_OPEN'; end if;
  if v_parent.expires_at is not null and v_parent.expires_at < now() then raise exception 'QUEST_EXPIRED'; end if;

  select * into v_review
  from public.system_quest_reviews
  where id=p_review_id
    and user_id=v_user
    and target_type='OBJECTIVE'
    and target_id=v_objective.id::text
  for update;
  if not found then raise exception 'OBJECTIVE_REVIEW_NOT_FOUND'; end if;
  if v_review.decision <> 'APPROVE' then raise exception 'OBJECTIVE_REVIEW_NOT_APPROVED'; end if;
  if v_review.expires_at is not null and v_review.expires_at < now() then raise exception 'OBJECTIVE_REVIEW_EXPIRED'; end if;
  if v_review.consumed_at is not null then raise exception 'OBJECTIVE_REVIEW_ALREADY_USED'; end if;

  v_note := left(coalesce(nullif(v_review.proof->>'detail',''),v_review.proof->>'note','AI reviewed evidence'),1200);
  update public.system_quest_reviews set consumed_at=now()
  where id=v_review.id and consumed_at is null;

  update public.user_quest_objectives
  set status='COMPLETED',
      completed_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'completion_note',v_note,
        'completion_method','AI_REVIEWED_PLAYER_SUBMISSION',
        'review_id',v_review.id,
        'review_decision',v_review.decision,
        'review_reason',v_review.reason,
        'completed_at',now()
      ),
      updated_at=now()
  where id=v_objective.id
  returning * into v_objective;

  select * into v_profile from public.system_award_xp(
    v_objective.xp_reward,
    'QUEST_OBJECTIVE',
    v_objective.title_snapshot,
    jsonb_build_object(
      'objective_id',v_objective.id,
      'user_quest_id',v_objective.user_quest_id,
      'pillar',v_objective.pillar,
      'review_id',v_review.id
    )
  );

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values(
    v_user,'QUEST_OBJECTIVE_COMPLETE',v_objective.title_snapshot,v_objective.objective_snapshot,
    'QUEST_OBJECTIVE',v_objective.id::text,v_objective.xp_reward,
    jsonb_build_object('user_quest_id',v_objective.user_quest_id,'pillar',v_objective.pillar,'review_id',v_review.id)
  );

  if coalesce(v_parent.metadata->>'pillar_quest','false') = 'true' then
    select count(*) into v_completed
    from public.user_quest_objectives
    where user_quest_id=v_parent.id and user_id=v_user and status='COMPLETED';

    if v_completed = 3 then
      perform system_private.complete_quest_before_living_system(
        v_parent.id,
        jsonb_build_object(
          'proof_type','HONOR',
          'proof_verified_at',now(),
          'completion_source','THREE_APPROVED_PILLAR_MISSIONS',
          'pillar',upper(v_parent.metadata->>'target_pillar'),
          'completed_mission_count',3
        )
      );
      select * into v_profile from public.profiles where id=v_user;
    end if;
  end if;

  return jsonb_build_object(
    'duplicate',false,
    'objective',to_jsonb(v_objective),
    'review',jsonb_build_object('id',v_review.id,'decision',v_review.decision,'reason',v_review.reason),
    'parent_completed',coalesce(v_parent.metadata->>'pillar_quest','false') = 'true' and v_completed = 3,
    'profile',to_jsonb(v_profile)
  );
end;
$function$;
