-- Parent NO ZERO DAY completion is blocked until all three accepted objectives are complete.
-- Objective XP is intentionally implemented only by the AI-review-gated RPC in the next migration.
-- Do not add an attestation-only completion path here.
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
    where user_quest_id=new.id and user_id=new.user_id
      and status in ('ACCEPTED','COMPLETED');

    if upper(trim(coalesce(new.title_snapshot,'')))='NO ZERO DAY' then
      if v_total <> 3 or v_completed <> 3 then
        raise exception 'QUEST_OBJECTIVES_INCOMPLETE';
      end if;
    elsif v_total > 0 and (v_total <> 3 or v_completed <> 3) then
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
