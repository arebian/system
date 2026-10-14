// Retry only requests rejected for JWT authentication, never an ambiguous
// timeout, a network failure, or a business-rule error. All callers share the
// same refresh so parallel RPCs cannot rotate the refresh token repeatedly.
export function createAuthRecoveryFetch({ origin, getClient, fetchImpl = globalThis.fetch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let refreshFlight = null;

  function subject(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '='))).sub || null;
    } catch { return null; }
  }

  return async function authenticatedFetch(input, init) {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const bearer = request.headers.get('authorization') || '';
    const token = bearer.replace(/^Bearer\s+/i, '');
    const userId = subject(token);
    // Auth refresh itself must bypass this wrapper's recovery logic.
    if (url.origin !== origin || !/^\/(rest|functions|storage)\/v1\//.test(url.pathname) || !userId) {
      return fetchImpl(request);
    }
    const retryRequest = request.clone();
    const response = await fetchImpl(request);
    if (response.status !== 401 || request.signal.aborted) return response;
    let detail;
    try { detail = await response.clone().json(); } catch { return response; }
    const message = [detail?.message, detail?.msg, detail?.error, detail?.error_description].join(' ').toLowerCase();
    const future = /issued.*future|not valid yet|not yet valid/.test(message);
    if (!future && !/jwt|token.*expir|invalid.*token/.test(message) && detail?.code !== 'PGRST301') return response;

    try {
      const client = getClient();
      let { data } = await client.auth.getSession();
      if (data?.session?.user?.id !== userId) return response;
      if (future) {
        await wait(1200);
      } else if (data.session.access_token === token) {
        if (!refreshFlight) {
          const pending = client.auth.refreshSession();
          refreshFlight = pending;
          // Clear a settled flight without creating an unhandled rejection.
          pending.then(() => { if (refreshFlight === pending) refreshFlight = null; }, () => { if (refreshFlight === pending) refreshFlight = null; });
        }
        const refreshed = await refreshFlight;
        if (refreshed.error || !refreshed.data?.session) return response;
      }
      ({ data } = await client.auth.getSession());
      if (request.signal.aborted || data?.session?.user?.id !== userId) return response;
      const headers = new Headers(retryRequest.headers);
      headers.set('authorization', `Bearer ${data.session.access_token}`);
      return fetchImpl(new Request(retryRequest, { headers }));
    } catch {
      // Preserve the original error so existing retry/sign-in UI can display it.
      return response;
    }
  };
}
