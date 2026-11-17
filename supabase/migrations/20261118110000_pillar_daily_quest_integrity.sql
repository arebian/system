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
