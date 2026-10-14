revoke all on function public.system_claim_reward(bigint) from public,anon;
grant execute on function public.system_claim_reward(bigint) to authenticated,service_role;
revoke all on function public.system_set_inventory_state(bigint,boolean,boolean) from public,anon;
grant execute on function public.system_set_inventory_state(bigint,boolean,boolean) to authenticated,service_role;
