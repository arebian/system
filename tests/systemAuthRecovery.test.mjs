import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthRecoveryFetch } from '../src/systemAuthRecovery.js';

function token(sub, rev = 0) { return `e30.${Buffer.from(JSON.stringify({ sub, rev })).toString('base64url')}.test`; }
const denied = (message = 'JWT expired') => new Response(JSON.stringify({ code: 'PGRST301', message }), { status: 401 });
const ok = () => new Response('{}', { status: 200 });
function harness(fetchImpl) {
  let session = { user: { id: 'user-a' }, access_token: token('user-a') };
  let refreshes = 0;
  const client = { auth: { getSession: async () => ({ data: { session } }), refreshSession: async () => {
    refreshes++; await new Promise((resolve) => setTimeout(resolve, 10));
    session = { user: { id: 'user-a' }, access_token: token('user-a', 1) };
    return { data: { session } };
  } } };
  const fetch = createAuthRecoveryFetch({ origin: 'https://test.supabase.co', getClient: () => client, fetchImpl, wait: async () => {} });
  const invoke = () => fetch('https://test.supabase.co/rest/v1/rpc/complete', { method: 'POST', headers: { authorization: `Bearer ${token('user-a')}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_id: 12 }) });
  return { invoke, fetch, refreshes: () => refreshes, setSession: (value) => { session = value; } };
}
test('parallel JWT failures share one refresh and preserve each mutation body', async () => {
  const bodies = [];
  const h = harness(async (request) => {
    bodies.push(await request.text());
    return request.headers.get('authorization').includes(token('user-a', 1)) ? ok() : denied();
  });
  const responses = await Promise.all([h.invoke(), h.invoke(), h.invoke()]);
  assert.deepEqual(responses.map((r) => r.status), [200,200,200]);
  assert.equal(h.refreshes(), 1);
  assert.equal(bodies.length, 6);
  assert.ok(bodies.every((body) => body === '{"p_id":12}'));
});
test('network, permission and business failures are never replayed', async () => {
  for (const status of [400,403,409,500]) {
    let calls=0;
    const h=harness(async () => { calls++; return new Response('{}',{status}); });
    assert.equal((await h.invoke()).status,status);
    assert.equal(calls,1);
    assert.equal(h.refreshes(),0);
  }
  let calls=0;
  const h=harness(async () => { calls++; throw new Error('Connection lost after send'); });
  await assert.rejects(h.invoke(), /Connection lost/);
  assert.equal(calls,1);
});
test('a signed-out or changed account cannot replay the previous account request', async () => {
  let calls=0;
  const h=harness(async () => { calls++; h.setSession({ user:{id:'user-b'},access_token:token('user-b') }); return denied(); });
  assert.equal((await h.invoke()).status,401);
  assert.equal(calls,1);
  assert.equal(h.refreshes(),0);
});
test('future-issued tokens get one bounded retry without refreshing recursively', async () => {
  let calls=0;
  const h=harness(async () => ++calls===1 ? denied('JWT issued at future') : ok());
  assert.equal((await h.invoke()).status,200);
  assert.equal(calls,2);
  assert.equal(h.refreshes(),0);
});
test('auth endpoints and anonymous requests bypass recovery', async () => {
  let calls=0;
  const h=harness(async () => { calls++; return denied(); });
  await h.fetch('https://test.supabase.co/auth/v1/token', { headers:{authorization:`Bearer ${token('user-a')}`} });
  await h.fetch('https://test.supabase.co/rest/v1/profiles');
  assert.equal(calls,2);
  assert.equal(h.refreshes(),0);
});
