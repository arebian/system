export function errorCode(error) {
  const raw = String(error?.code || error?.message || error || '').toUpperCase();
  if (/FAILED TO FETCH|NETWORK|LOAD FAILED|CONNECTION/.test(raw)) return 'NETWORK_UNAVAILABLE';
  if (/TIMEOUT|TIMED OUT|ABORT/.test(raw)) return 'REQUEST_TIMEOUT';
  if (/CHUNK|DYNAMICALLY IMPORTED MODULE|MODULE SCRIPT/.test(raw)) return 'UPDATE_RELOAD_REQUIRED';
  if (/^[A-Z][A-Z0-9_]{1,79}$/.test(raw)) return raw;
  return 'UNEXPECTED_ERROR';
}

export function recoveryMessage(error, area = 'SYSTEM') {
  const code = errorCode(error);
  if (code === 'NETWORK_UNAVAILABLE') return 'The connection was interrupted. Your input is still here. Reconnect and try again.';
  if (code.includes('TIMEOUT')) return 'The server took too long to respond. Check the current status before retrying; your input is still here.';
  if (/AUTH|JWT|SESSION/.test(code)) return 'Your session needs to reconnect. Sign in again, then return to this action.';
  if (code === 'UPDATE_RELOAD_REQUIRED') return 'A new app version is available. Reload THE SYSTEM to load this screen.';
  if (area === 'ARCHIVE') return 'This edition is temporarily unavailable. Retry the reader or choose another title; your reading progress is saved.';
  return 'This action could not be confirmed. Your input is still here. Try again when the connection is ready.';
}

// Deliberately omit arbitrary messages, tokens, URLs, stacks and user content.
export function errorEvent(error, area) {
  const code = errorCode(error);
  const allowed = new Set(['NETWORK_UNAVAILABLE','REQUEST_TIMEOUT','UPDATE_RELOAD_REQUIRED','AUTH_REQUIRED','SESSION_EXPIRED','INVALID_JWT','ARCHIVE_TEXT_UNAVAILABLE','ARCHIVE_TEXT_INVALID','AI_UNAVAILABLE','PROFILE_SAVE_FAILED','UNEXPECTED_ERROR']);
  return { code: allowed.has(code) ? code : 'UNEXPECTED_ERROR', area: ['RUNTIME','AUTH','ARCHIVE','AI','CLASS_SPECIAL','NETWORK'].includes(area) ? area : 'RUNTIME', build: '2.10.0' };
}
