-- Keep player history readable and deletable by its owner, but prevent clients
-- from forging or rewriting progression and journey events. Trusted backend
-- functions (including SECURITY DEFINER trigger functions) remain responsible
-- for creating canonical history records.

drop policy if exists progression_events_insert_own on public.progression_events;
drop policy if exists progression_events_update_own on public.progression_events;

drop policy if exists journey_events_insert_own on public.journey_events;
drop policy if exists journey_events_update_own on public.journey_events;

-- This function is invoked by the user_quests trigger only. It must not be
-- callable as a client RPC. Trigger invocation does not require callers to
-- hold EXECUTE on the trigger function.
revoke all on function public.system_award_pillar_cement() from public;
revoke all on function public.system_award_pillar_cement() from anon;
revoke all on function public.system_award_pillar_cement() from authenticated;

comment on function public.system_award_pillar_cement() is
  'Internal trigger: awards one pillar cement unit after a qualifying pillar quest transitions to COMPLETED. Not callable by client roles.';
