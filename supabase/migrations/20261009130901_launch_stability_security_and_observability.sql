-- No player progression or reading history is rewritten by this migration.
set lock_timeout = '5s';

revoke execute on function public.system_accept_quest_by_title_v2(text, integer, jsonb, date) from public, anon;
revoke execute on function public.system_complete_quest_by_title_v2(text, jsonb, date) from public, anon;
grant execute on function public.system_accept_quest_by_title_v2(text, integer, jsonb, date) to authenticated;
grant execute on function public.system_complete_quest_by_title_v2(text, jsonb, date) to authenticated;

create index if not exists mage_reading_progress_book_idx on public.mage_reading_progress(book_id);
create index if not exists mage_reading_sessions_book_idx on public.mage_reading_sessions(book_id);
create index if not exists user_mage_books_book_idx on public.user_mage_books(book_id);

alter policy mage_reading_progress_select_own on public.mage_reading_progress using (user_id = (select auth.uid()));
alter policy mage_reading_progress_insert_own on public.mage_reading_progress with check (user_id = (select auth.uid()));
alter policy mage_reading_progress_update_own on public.mage_reading_progress using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy mage_reading_progress_delete_own on public.mage_reading_progress using (user_id = (select auth.uid()));
alter policy user_mage_books_own_read on public.user_mage_books using (user_id = (select auth.uid()));
alter policy mage_reading_sessions_own_read on public.mage_reading_sessions using (user_id = (select auth.uid()));

-- Codes and screen names only: never store chat, proof, GPS routes or clips.
create table if not exists public.client_error_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_]{1,80}$'),
  area text not null check (area in ('RUNTIME','AUTH','ARCHIVE','AI','CLASS_SPECIAL','NETWORK')),
  build text not null check (build ~ '^[0-9.]{1,20}$'),
  created_at timestamptz not null default now()
);
create index if not exists client_error_events_user_time_idx on public.client_error_events(user_id, created_at desc);
alter table public.client_error_events enable row level security;
revoke all on table public.client_error_events from public, anon, authenticated;

create or replace function public.system_report_client_error_v1(p_code text, p_area text, p_build text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or p_code !~ '^[A-Z0-9_]{1,80}$'
     or p_area is null or p_area not in ('RUNTIME','AUTH','ARCHIVE','AI','CLASS_SPECIAL','NETWORK')
     or p_build is null or p_build !~ '^[0-9.]{1,20}$' then
    raise exception 'INVALID_ERROR_EVENT';
  end if;
  if not exists(select 1 from public.profiles where id = v_user) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':client-error', 0));
  if (select count(*) from public.client_error_events where user_id = v_user and created_at > now() - interval '1 hour') >= 20 then
    return false;
  end if;
  insert into public.client_error_events(user_id, code, area, build) values(v_user, p_code, p_area, p_build);
  -- Keep the report small even for long-lived accounts.
  delete from public.client_error_events where user_id = v_user and created_at < now() - interval '30 days';
  return true;
end;
$$;
revoke all on function public.system_report_client_error_v1(text, text, text) from public, anon;
grant execute on function public.system_report_client_error_v1(text, text, text) to authenticated;
