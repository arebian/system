-- Remove anonymous access from all authoritative system RPCs currently in public.
revoke execute on function public.system_award_xp(integer,text,text,jsonb) from anon;
revoke execute on function public.system_add_attribute(text,integer,text,text,jsonb) from anon;
revoke execute on function public.system_damage_active_boss(integer,text,text,text,jsonb) from anon;
revoke execute on function public.system_complete_workout(bigint,integer,text,jsonb) from anon;
revoke execute on function public.system_complete_quest(uuid,jsonb) from anon;
revoke execute on function public.system_start_gps_session(text,numeric,integer,uuid,bigint,jsonb) from anon;
revoke execute on function public.system_finish_gps_session(uuid,numeric,integer,jsonb,jsonb) from anon;
revoke execute on function public.system_weekly_snapshot(date) from anon;
revoke execute on function public.system_change_class(text,text,text,jsonb) from anon;
revoke execute on function public.system_workout_available(bigint) from anon;
revoke execute on function public.system_resolve_active_boss() from anon;
revoke execute on function public.system_intelligence_create_thread(text,jsonb) from anon;
revoke execute on function public.system_intelligence_add_message(uuid,text,text,jsonb) from anon;
revoke execute on function public.system_intelligence_context() from anon;

-- Low-level progression primitives are internal-only. Validated high-level functions can still call them as owner.
revoke execute on function public.system_award_xp(integer,text,text,jsonb) from authenticated;
revoke execute on function public.system_add_attribute(text,integer,text,text,jsonb) from authenticated;
revoke execute on function public.system_damage_active_boss(integer,text,text,text,jsonb) from authenticated;

grant execute on function public.system_award_xp(integer,text,text,jsonb) to service_role;
grant execute on function public.system_add_attribute(text,integer,text,text,jsonb) to service_role;
grant execute on function public.system_damage_active_boss(integer,text,text,text,jsonb) to service_role;

-- Signed-in clients can only write USER messages. They cannot impersonate System Intelligence.
create or replace function public.system_intelligence_add_message(
  p_thread_id uuid,
  p_role text,
  p_content text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.system_intelligence_messages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_message public.system_intelligence_messages;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if lower(trim(p_role)) <> 'user' then raise exception 'CLIENT_ROLE_NOT_ALLOWED'; end if;
  if nullif(trim(p_content),'') is null then raise exception 'EMPTY_MESSAGE'; end if;

  if not exists (
    select 1 from public.system_intelligence_threads
    where id=p_thread_id and user_id=v_user and status='ACTIVE'
  ) then raise exception 'THREAD_NOT_FOUND'; end if;

  insert into public.system_intelligence_messages(thread_id,user_id,role,content,metadata)
  values(p_thread_id,v_user,'user',trim(p_content),coalesce(p_metadata,'{}'::jsonb))
  returning * into v_message;

  update public.system_intelligence_threads
  set updated_at=now()
  where id=p_thread_id and user_id=v_user;

  return v_message;
end;
$$;

-- Server-only writer for assistant/system output. This is the hidden backend channel.
create or replace function public.system_intelligence_add_server_message(
  p_user_id uuid,
  p_thread_id uuid,
  p_role text,
  p_content text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.system_intelligence_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(p_role));
  v_message public.system_intelligence_messages;
begin
  if v_role not in ('assistant','system') then raise exception 'INVALID_SERVER_ROLE'; end if;
  if nullif(trim(p_content),'') is null then raise exception 'EMPTY_MESSAGE'; end if;

  if not exists (
    select 1 from public.system_intelligence_threads
    where id=p_thread_id and user_id=p_user_id and status='ACTIVE'
  ) then raise exception 'THREAD_NOT_FOUND'; end if;

  insert into public.system_intelligence_messages(thread_id,user_id,role,content,metadata)
  values(p_thread_id,p_user_id,v_role,trim(p_content),coalesce(p_metadata,'{}'::jsonb))
  returning * into v_message;

  update public.system_intelligence_threads
  set updated_at=now()
  where id=p_thread_id and user_id=p_user_id;

  return v_message;
end;
$$;

revoke all on function public.system_intelligence_add_server_message(uuid,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.system_intelligence_add_server_message(uuid,uuid,text,text,jsonb) to service_role;

