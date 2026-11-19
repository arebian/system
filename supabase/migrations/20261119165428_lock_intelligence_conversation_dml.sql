-- The responder owns assistant messages; authenticated users submit only user
-- messages through system_intelligence_add_message(), which enforces p_role='user'.
drop policy if exists system_intelligence_messages_insert_own on public.system_intelligence_messages;
drop policy if exists system_intelligence_messages_update_own on public.system_intelligence_messages;
drop policy if exists system_intelligence_messages_delete_own on public.system_intelligence_messages;
drop policy if exists system_intelligence_threads_insert_own on public.system_intelligence_threads;
drop policy if exists system_intelligence_threads_update_own on public.system_intelligence_threads;
drop policy if exists system_intelligence_threads_delete_own on public.system_intelligence_threads;

revoke insert, update, delete on public.system_intelligence_messages from anon, authenticated;
revoke insert, update, delete on public.system_intelligence_threads from anon, authenticated;
