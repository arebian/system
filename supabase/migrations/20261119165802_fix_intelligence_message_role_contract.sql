create or replace function public.system_intelligence_add_message(
  p_thread_id uuid,
  p_role text,
  p_content text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.system_intelligence_messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_role text := lower(trim(p_role));
  v_content text := trim(p_content);
  v_message public.system_intelligence_messages;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_role <> 'user' then
    raise exception 'CLIENT_ROLE_NOT_ALLOWED';
  end if;

  if nullif(v_content, '') is null then
    raise exception 'EMPTY_MESSAGE';
  end if;

  if length(v_content) > 8000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  if not exists (
    select 1
    from public.system_intelligence_threads
    where id = p_thread_id
      and user_id = v_user
      and status = 'ACTIVE'
  ) then
    raise exception 'THREAD_NOT_FOUND';
  end if;

  insert into public.system_intelligence_messages(
    thread_id, user_id, role, content, metadata
  )
  values (
    p_thread_id, v_user, 'USER', v_content, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_message;

  update public.system_intelligence_threads
  set updated_at = now()
  where id = p_thread_id
    and user_id = v_user;

  return v_message;
end;
$function$;

revoke all on function public.system_intelligence_add_message(uuid, text, text, jsonb) from public, anon;
grant execute on function public.system_intelligence_add_message(uuid, text, text, jsonb) to authenticated, service_role;
