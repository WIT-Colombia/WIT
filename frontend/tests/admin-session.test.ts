import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { adminRefresh } from '../apps/admin/src/services/adminApiClient.ts';
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
const admin = { user: { id: 'fixture-admin' }, role: 'ADMIN', permissions: [] };
test('concurrent Admin restoration shares one rotating refresh and one role check', async () => {
  let refreshes = 0; let checks = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) { refreshes += 1; await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({ user: admin.user, accessToken: 'synthetic-admin-token' }); }
    checks += 1; assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-admin-token');
    return Response.json({ admin });
  };
  const results = await Promise.all(Array.from({ length: 10 }, () => adminRefresh()));
  assert.equal(refreshes, 1); assert.equal(checks, 1); for (const result of results) assert.deepEqual(result, admin);
});
test('a failed Admin refresh releases the in-flight promise and can be retried', async () => {
  let failures = true; let count = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith('/auth/refresh')) { count += 1; return failures ? Response.json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Sesión no válida.' } }, { status: 401 }) : Response.json({ user: admin.user, accessToken: 'synthetic-retry-token' }); }
    return Response.json({ admin });
  };
  await assert.rejects(adminRefresh()); failures = false;
  assert.deepEqual(await adminRefresh(), admin); assert.equal(count, 2);
});
