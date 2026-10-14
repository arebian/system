import { supabase } from './supabaseClient.js';
import { reportSystemError } from './systemErrorReporter.js';

async function rpc(name, parameters = {}) {
  const { data, error } = await supabase.rpc(name, parameters).abortSignal(AbortSignal.timeout(20000));
  if (error) { void reportSystemError(error, 'CLASS_SPECIAL'); throw error; }
  return data;
}

export const loadClassSpecial = () => rpc('system_class_special_state_v1');
export const startClassSpecial = (path) => rpc('system_start_class_special_v1', { p_class: path });
export const cancelClassSpecial = (id) => rpc('system_cancel_class_special_v1', { p_session_id: id });
export const completeClassSpecial = (id, result) => rpc('system_complete_class_special_v1', { p_session_id: id, p_result: result });

export async function uploadClassSpecialClip(file, session, uploadId) {
  if (!file?.size || file.size > 35 * 1024 * 1024) throw new Error('Record a clip smaller than 35 MB.');
  const contentType = file.type.split(';')[0];
  if (!['video/mp4', 'video/webm'].includes(contentType)) throw new Error('This browser did not produce a supported video. Try a current Chrome or Safari.');
  // Reuse one path on retry. A response lost after a successful upload must not
  // force a second file or a new session. Retakes explicitly remove that file.
  if (!/^[a-f0-9-]{36}$/.test(String(uploadId))) throw new Error('RECORDING_ID_REQUIRED');
  const path = `${session.user_id}/${session.id}/${uploadId}.${contentType === 'video/mp4' ? 'mp4' : 'webm'}`;
  const { error } = await supabase.storage.from('class-special-clips').upload(path, file, { contentType, upsert: false });
  if (error && String(error.statusCode) !== '409' && error.error !== 'Duplicate') throw error;
  return path;
}

export async function deleteClassSpecialClip(path) {
  if (!path) return;
  const { error } = await supabase.storage.from('class-special-clips').remove([path]);
  if (error) throw error;
}
