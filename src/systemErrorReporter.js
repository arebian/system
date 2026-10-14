import { supabase } from './supabaseClient.js';
import { errorEvent } from './systemErrors.js';

const recent = new Map();
export async function reportSystemError(error, area = 'RUNTIME') {
  const event = errorEvent(error, area);
  const key = event.area + ':' + event.code;
  const now = Date.now();
  if (now - (recent.get(key) || 0) < 60000 || navigator.onLine === false) return;
  recent.set(key, now);
  if (recent.size > 60) recent.delete(recent.keys().next().value);
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) return;
    await supabase.rpc('system_report_client_error_v1', { p_code: event.code, p_area: event.area, p_build: event.build });
  } catch { /* Reporting must never block the user's action or retry itself. */ }
}
