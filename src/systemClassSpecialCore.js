export function isClassCompatible(affinity, path) {
  const classes = (Array.isArray(affinity) ? affinity : String(affinity || '').replace(/[{}"\[\]]/g, '').split(','))
    .map((item) => String(item).trim().toUpperCase()).filter(Boolean);
  return classes.length === 0 || classes.includes(String(path || '').trim().toUpperCase());
}

export function specialCountdown(session, now = Date.now(), offsetMs = 0) {
  const start = Date.parse(session?.started_at);
  const expires = Date.parse(session?.expires_at);
  if (!Number.isFinite(start) || !Number.isFinite(expires)) return { seconds: 0, expired: false, ready: false };
  const remaining = Math.max(0, Math.ceil((start + Number(session.target_seconds) * 1000 - now - offsetMs) / 1000));
  const expired = now + offsetMs >= expires;
  return { seconds: remaining, expired, ready: session.status === 'ACTIVE' && !expired && remaining === 0 };
}

export function formatSpecialTime(seconds) {
  const value = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function recordingMimeType(Recorder) {
  return ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((type) => Recorder.isTypeSupported?.(type)) || '';
}

export function tankSetError(exercise, sets, reflection) {
  if (exercise.trim().length < 3) return 'Name the exercise you completed.';
  if (sets.length < 3 || sets.length > 12) return 'Record 3–12 real sets.';
  if (sets.some((set) => !/^\d+$/.test(String(set.reps)) || Number(set.reps) < 1 || Number(set.reps) > 100 || !/^\d{1,3}(\.\d{1,2})?$/.test(String(set.load_kg)) || Number(set.load_kg) > 500)) return 'Each set needs 1–100 reps and a load from 0–500 kg. Use 0 for bodyweight.';
  if (reflection.trim().length < 20) return 'Add a short note about your form or the adjustment you made (at least 20 characters).';
  return '';
}
