-- Objective-linked timer verification. All timestamps and elapsed-time checks are server-authoritative.
create table if not exists public.user_quest_objective_timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  objective_id uuid not null references public.user_quest_objectives(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  elapsed_seconds integer,
  status text not null default 'RUNNING' check (status in ('RUNNING','COMPLETED','CANCELLED')),
  created_at timestamptz not null default now(),
  constraint objective_timer_elapsed_nonnegative check (elapsed_seconds is null or elapsed_seconds >= 0)
);
create index if not exists objective_timer_user_objective_idx
  on public.user_quest_objective_timer_sessions(user_id, objective_id, created_at desc);
create unique index if not exists objective_timer_one_running_per_objective
  on public.user_quest_objective_timer_sessions(objective_id)
  where status = 'RUNNING';
alter table public.user_quest_objective_timer_sessions enable row level security;
revoke all on public.user_quest_objective_timer_sessions from anon, authenticated;
grant select on public.user_quest_objective_timer_sessions to authenticated;
grant all on public.user_quest_objective_timer_sessions to service_role;
drop policy if exists objective_timer_select_own on public.user_quest_objective_timer_sessions;
create policy objective_timer_select_own on public.user_quest_objective_timer_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.system_start_quest_objective_timer(p_objective_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_objective public.user_quest_objectives;
  v_parent public.user_quests;
  v_session public.user_quest_objective_timer_sessions;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_objective from public.user_quest_objectives
    where id=p_objective_id and user_id=v_user for update;
  if not found then raise exception 'OBJECTIVE_NOT_FOUND'; end if;
  if v_objective.status <> 'ACCEPTED' then raise exception 'OBJECTIVE_NOT_ACCEPTED'; end if;
  if v_objective.proof_type <> 'TIMER' then raise exception 'OBJECTIVE_TIMER_NOT_REQUIRED'; end if;
  select * into v_parent from public.user_quests
    where id=v_objective.user_quest_id and user_id=v_user for update;
  if not found or v_parent.status not in ('ASSIGNED','ACCEPTED')
    or (v_parent.expires_at is not null and v_parent.expires_at <= now()) then
    raise exception 'QUEST_NOT_OPEN';
  end if;
  select * into v_session from public.user_quest_objective_timer_sessions
    where objective_id=p_objective_id and user_id=v_user and status='RUNNING'
    order by started_at desc limit 1;
  if found then return jsonb_build_object('session',to_jsonb(v_session),'resumed',true); end if;
  insert into public.user_quest_objective_timer_sessions(user_id,objective_id)
    values(v_user,p_objective_id) returning * into v_session;
  return jsonb_build_object('session',to_jsonb(v_session),'resumed',false);
end $$;

create or replace function public.system_finish_quest_objective_timer(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session public.user_quest_objective_timer_sessions;
  v_objective public.user_quest_objectives;
  v_parent public.user_quests;
  v_elapsed integer;
  v_required integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_session from public.user_quest_objective_timer_sessions
    where id=p_session_id and user_id=v_user for update;
  if not found then raise exception 'OBJECTIVE_TIMER_NOT_FOUND'; end if;
  if v_session.status='COMPLETED' then
    return jsonb_build_object('session',to_jsonb(v_session),'duplicate',true);
  end if;
  if v_session.status <> 'RUNNING' then raise exception 'OBJECTIVE_TIMER_NOT_RUNNING'; end if;
  select * into v_objective from public.user_quest_objectives
    where id=v_session.objective_id and user_id=v_user;
  if not found or v_objective.status <> 'ACCEPTED' or v_objective.proof_type <> 'TIMER' then
    raise exception 'OBJECTIVE_NOT_ACCEPTED';
  end if;
  select * into v_parent from public.user_quests
    where id=v_objective.user_quest_id and user_id=v_user;
  if not found or v_parent.status not in ('ASSIGNED','ACCEPTED')
    or (v_parent.expires_at is not null and v_parent.expires_at <= now()) then
    raise exception 'QUEST_NOT_OPEN';
  end if;
  v_elapsed := greatest(0,floor(extract(epoch from (now()-v_session.started_at)))::integer);
  v_required := v_objective.duration_minutes * 60;
  if v_elapsed < v_required then
    return jsonb_build_object('status','TOO_EARLY','elapsed_seconds',v_elapsed,'required_seconds',v_required);
  end if;
  update public.user_quest_objective_timer_sessions
    set finished_at=now(), elapsed_seconds=v_elapsed, status='COMPLETED'
    where id=v_session.id returning * into v_session;
  return jsonb_build_object('session',to_jsonb(v_session),'duplicate',false);
end $$;

revoke all on function public.system_start_quest_objective_timer(uuid) from public, anon;
revoke all on function public.system_finish_quest_objective_timer(uuid) from public, anon;
grant execute on function public.system_start_quest_objective_timer(uuid) to authenticated;
grant execute on function public.system_finish_quest_objective_timer(uuid) to authenticated;
