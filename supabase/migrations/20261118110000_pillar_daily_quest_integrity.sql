-- Pillar-based daily quest integrity and cement progression.
-- A pillar quest is tagged by the authoritative must-quest acceptance RPC.

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
        count(*) filter (where status in ('ACCEPTED','COMPLETED')),
        count(*) filter (where status = 'COMPLETED'),
        count(distinct pillar) filter (where status in ('ACCEPTED','COMPLETED'))
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
      update public.user_quests
      set status='COMPLETED', completed_at=now(), updated_at=now()
      where id=v_parent.id and user_id=v_user and status in ('ASSIGNED','ACCEPTED');
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
