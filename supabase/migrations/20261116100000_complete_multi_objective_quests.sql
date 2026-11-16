-- Objective completion is individually recorded and rewarded by the backend.
-- Parent NO ZERO DAY completion is blocked until all three accepted objectives are complete.
create or replace function public.system_complete_quest_objective(
  p_objective_id uuid,
  p_completion_note text
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
  v_note text := trim(coalesce(p_completion_note,''));
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(v_note) < 12 or length(v_note) > 1200 then
    raise exception 'OBJECTIVE_COMPLETION_NOTE_REQUIRED';
  end if;

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

  update public.user_quest_objectives
  set status='COMPLETED',
      completed_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'completion_note',v_note,
        'completion_method','PLAYER_ATTESTATION',
        'completion_recorded_at',now()
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
      'pillar',v_objective.pillar
    )
  );

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values(
    v_user,'QUEST_OBJECTIVE_COMPLETE',v_objective.title_snapshot,v_objective.objective_snapshot,
    'QUEST_OBJECTIVE',v_objective.id::text,v_objective.xp_reward,
    jsonb_build_object('user_quest_id',v_objective.user_quest_id,'pillar',v_objective.pillar)
  );

  return jsonb_build_object(
    'duplicate',false,
    'objective',to_jsonb(v_objective),
    'profile',to_jsonb(v_profile)
  );
end;
$$;

create or replace function public.system_guard_parent_quest_objectives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_completed integer;
begin
  if new.status='COMPLETED' and old.status is distinct from 'COMPLETED' then
    select count(*),count(*) filter (where status='COMPLETED')
      into v_total,v_completed
    from public.user_quest_objectives
    where user_quest_id=new.id and user_id=new.user_id;

    if v_total > 0 and (v_total <> 3 or v_completed <> 3) then
      raise exception 'QUEST_OBJECTIVES_INCOMPLETE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_quests_require_completed_objectives on public.user_quests;
create trigger user_quests_require_completed_objectives
before update of status on public.user_quests
for each row execute function public.system_guard_parent_quest_objectives();

revoke all on function public.system_complete_quest_objective(uuid,text) from public,anon;
grant execute on function public.system_complete_quest_objective(uuid,text) to authenticated;
