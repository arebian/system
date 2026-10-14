-- System Intelligence backend core: persistent, user-owned conversation state.

create index if not exists system_intelligence_threads_user_updated_idx
  on public.system_intelligence_threads(user_id, updated_at desc);

create index if not exists system_intelligence_messages_user_created_idx
  on public.system_intelligence_messages(user_id, created_at asc);

create index if not exists system_intelligence_messages_thread_created_idx
  on public.system_intelligence_messages(thread_id, created_at asc);

create or replace function public.system_intelligence_create_thread(
  p_title text default null,
  p_context jsonb default '{}'::jsonb
)
returns public.system_intelligence_threads
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_thread public.system_intelligence_threads;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  insert into public.system_intelligence_threads(user_id,title,context,status)
  values(v_user,nullif(trim(p_title),''),coalesce(p_context,'{}'::jsonb),'ACTIVE')
  returning * into v_thread;

  return v_thread;
end;
$$;

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
  v_role text := lower(trim(p_role));
  v_message public.system_intelligence_messages;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_role not in ('user','assistant','system') then raise exception 'INVALID_MESSAGE_ROLE'; end if;
  if nullif(trim(p_content),'') is null then raise exception 'EMPTY_MESSAGE'; end if;

  if not exists (
    select 1 from public.system_intelligence_threads
    where id=p_thread_id and user_id=v_user and status='ACTIVE'
  ) then
    raise exception 'THREAD_NOT_FOUND';
  end if;

  insert into public.system_intelligence_messages(thread_id,user_id,role,content,metadata)
  values(p_thread_id,v_user,v_role,trim(p_content),coalesce(p_metadata,'{}'::jsonb))
  returning * into v_message;

  update public.system_intelligence_threads
  set updated_at=now()
  where id=p_thread_id and user_id=v_user;

  return v_message;
end;
$$;

create or replace function public.system_intelligence_context()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select jsonb_build_object(
    'profile', to_jsonb(p),
    'attributes', to_jsonb(a),
    'routine', to_jsonb(r),
    'active_boss', (
      select to_jsonb(b) from public.boss_quests b
      where b.user_id=v_user and b.status='ACTIVE'
      order by b.created_at desc limit 1
    ),
    'active_quests', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from public.user_quests q
      where q.user_id=v_user and q.status in ('ASSIGNED','ACCEPTED')
    ), '[]'::jsonb),
    'recent_progress', coalesce((
      select jsonb_agg(x.event order by x.created_at desc)
      from (
        select to_jsonb(pe) as event, pe.created_at
        from public.progression_events pe
        where pe.user_id=v_user
        order by pe.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  ) into v_result
  from public.profiles p
  left join public.attributes a on a.user_id=p.id
  left join public.player_routines r on r.user_id=p.id
  where p.id=v_user;

  return coalesce(v_result,'{}'::jsonb);
end;
$$;

grant execute on function public.system_intelligence_create_thread(text,jsonb) to authenticated;
grant execute on function public.system_intelligence_add_message(uuid,text,text,jsonb) to authenticated;
grant execute on function public.system_intelligence_context() to authenticated;

