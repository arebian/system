-- Trigger-only integrity guards must not be callable as public RPCs.
-- Trigger invocation does not require client EXECUTE privileges.
revoke all on function public.system_guard_parent_quest_objectives() from public;
revoke all on function public.system_guard_parent_quest_objectives() from anon;
revoke all on function public.system_guard_parent_quest_objectives() from authenticated;
