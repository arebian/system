-- 2.8.7 — Archive RPCs are player-scoped and require an authenticated session.

begin;

alter function public.system_mage_rank_order(text)
  set search_path = pg_catalog;

revoke execute on function public.mage_complete_book(uuid, text)
  from public, anon;
revoke execute on function public.mage_log_reading(uuid, integer, integer)
  from public, anon;
revoke execute on function public.mage_start_book(uuid)
  from public, anon;
revoke execute on function public.system_complete_mage_book(uuid, text)
  from public, anon;
revoke execute on function public.system_log_mage_reading(uuid, integer, integer, text, date)
  from public, anon;
revoke execute on function public.system_mage_knowledge_rank()
  from public, anon;
revoke execute on function public.system_start_mage_book(uuid)
  from public, anon;

grant execute on function public.mage_complete_book(uuid, text)
  to authenticated;
grant execute on function public.mage_log_reading(uuid, integer, integer)
  to authenticated;
grant execute on function public.mage_start_book(uuid)
  to authenticated;
grant execute on function public.system_complete_mage_book(uuid, text)
  to authenticated;
grant execute on function public.system_log_mage_reading(uuid, integer, integer, text, date)
  to authenticated;
grant execute on function public.system_mage_knowledge_rank()
  to authenticated;
grant execute on function public.system_start_mage_book(uuid)
  to authenticated;

commit;
