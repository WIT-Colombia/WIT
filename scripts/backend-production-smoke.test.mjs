import assert from 'node:assert/strict';
import test from 'node:test';
import { runSmoke } from './backend-production-smoke.mjs';

const payload = (url) => {
  const path = new URL(url).pathname;
  if (path === '/api/v1/health') return [{ status: 'ok', service: 'wit-backend' }, 200];
  if (path === '/api/v1/public/zones/next-launch') {
    return [{ next: null, serverTime: new Date().toISOString() }, 200];
  }
  if (path === '/api/v1/public/zones/status') {
    const name = new URL(url).searchParams.get('city');
    return [{ zone: { code: name === 'Palmira' ? '76520' : '76001', state: 'CLOSED' } }, 200];
  }
  if (path === '/api/v1/public/businesses') return [{ businesses: [] }, 200];
  if (path.startsWith('/api/v1/admin/')) return [{ error: { code: 'UNAUTHENTICATED' } }, 401];
  return [{ error: { code: 'NOT_FOUND' } }, 404];
};

test('production smoke makes only anonymous GETs and accepts complete routes', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    const [body, status] = payload(url);
    return new Response(JSON.stringify(body), { status });
  };
  const rows = await runSmoke(fetcher, 'https://api.example.test');
  assert.equal(rows.length, 7);
  assert.equal(rows.every(row => row.passed), true);
  assert.equal(requests.every(({ options }) =>
    options.method === 'GET' && options.credentials === 'omit'), true);
});

test('smoke flags an old backend with missing zones endpoints', async () => {
  const fetcher = async url => {
    const [body, status] = payload(url);
    if (url.includes('/zones/')) return new Response(JSON.stringify({
      error: { code: 'NOT_FOUND' },
    }), { status: 404 });
    return new Response(JSON.stringify(body), { status });
  };
  const rows = await runSmoke(fetcher, 'https://api.example.test');
  assert.equal(rows.filter(row => !row.passed).length, 3);
  assert.ok(rows.filter(row => !row.passed).every(row => row.name.includes('apertura') ||
    row.name.includes('Palmira') || row.name.includes('Cali')));
});

test('smoke fails closed when admin read endpoints are publicly accessible', async () => {
  const fetcher = async url => {
    const [body, status] = payload(url);
    if (url.includes('/admin/')) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify(body), { status });
  };
  const rows = await runSmoke(fetcher, 'https://api.example.test');
  assert.equal(rows.filter(row => !row.passed).length, 2);
});

test('smoke reports connectivity errors without exposing remote response bodies', async () => {
  const rows = await runSmoke(async () => {
    throw new Error('secret-do-not-echo');
  }, 'https://api.example.test');
  assert.equal(rows.every(row => !row.passed && row.status === 'network-error'), true);
  assert.doesNotMatch(JSON.stringify(rows), /secret-do-not-echo/);
});
