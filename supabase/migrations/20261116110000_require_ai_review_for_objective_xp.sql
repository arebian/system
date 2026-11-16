-- AI-reviewed evidence is required before an objective can award XP.
-- Remove the earlier attestation-only signature so it cannot bypass review.
drop function if exists public.system_complete_quest_objective(uuid,text);
alter table public.system_quest_reviews
  drop constraint if exists system_quest_reviews_target_type_check;
alter table public.system_quest_reviews
  add constraint system_quest_reviews_target_type_check
  check (target_type in ('QUEST','BOSS','OBJECTIVE'));

create index if not exists system_quest_reviews_objective_lookup_idx
  on public.system_quest_reviews(user_id,target_type,target_id,created_at desc);

create or replace function public.system_complete_quest_objective(
  p_objective_id uuid,
  p_review_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_objective public.user_quest_objectives;
  v_parent public.user_quests;
  v_profile public.profiles;
  v_review public.system_quest_reviews;
  v_note text;
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

  return jsonb_build_object(
    'duplicate',false,
    'objective',to_jsonb(v_objective),
    'review',jsonb_build_object('id',v_review.id,'decision',v_review.decision,'reason',v_review.reason),
    'profile',to_jsonb(v_profile)
  );
end;
$$;

revoke all on function public.system_complete_quest_objective(uuid,uuid) from public,anon;
grant execute on function public.system_complete_quest_objective(uuid,uuid) to authenticated;
