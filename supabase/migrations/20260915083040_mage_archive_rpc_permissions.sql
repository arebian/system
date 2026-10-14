-- Archive state is a signed-in player surface. It already rejects anonymous
-- callers through auth.uid(), so make that boundary explicit at the RPC layer.

begin;

revoke execute on function public.system_mage_archive_state()
  from public, anon;

grant execute on function public.system_mage_archive_state()
  to authenticated;

commit;
