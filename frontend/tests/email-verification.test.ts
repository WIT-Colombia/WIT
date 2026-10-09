import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmEmail, getMe, requestVerification } from '../apps/usuario/src/services/authService.ts';
import { ApiError } from '../apps/usuario/src/services/httpClient.ts';

test('confirmation uses POST and profile refresh reads the verified state', async () => {
  const original = globalThis.fetch;
  const requests: { path: string; method?: string; body?: BodyInit | null }[] = [];
  let verified = false;
  globalThis.fetch = async (path, init) => {
    requests.push({ path: String(path), method: init?.method, body: init?.body });
    if (String(path).endsWith('/confirm')) { verified = true; return new Response(null, { status: 204 }); }
    return Response.json({ user: { id: 'fake-user', emailVerified: verified } });
  };
  try {
    assert.equal((await getMe()).emailVerified, false);
    await confirmEmail('synthetic-test-token');
    assert.equal((await getMe()).emailVerified, true);
    assert.equal(requests[1].method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[1].body)), { token: 'synthetic-test-token' });
  } finally { globalThis.fetch = original; }
});
test('resend preserves server cooldown and does not invent an expired-token error', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Espera.' } }, { status: 429, headers: { 'Retry-After': '60' } });
  try { await assert.rejects(requestVerification('fake@example.test'), (error: unknown) => error instanceof ApiError && error.retryAfterSeconds === 60 && !error.message.includes('expir')); }
  finally { globalThis.fetch = original; }
});
test('server unavailability is not labeled as token expiry', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });
  try { await assert.rejects(confirmEmail('synthetic-test-token'), (error: unknown) => error instanceof ApiError && error.status === 503 && !error.message.includes('expir')); }
  finally { globalThis.fetch = original; }
});
