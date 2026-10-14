import test from 'node:test';
import assert from 'node:assert/strict';
import { businessRouter } from './modality.routes.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { AppError } from '../../shared/errors/app-error.js';

function request(headers: Record<string, string> = {}) {
  const read = (name: string) => headers[name.toLowerCase()] ?? headers[name];
  return { header: read, get: read } as any;
}

test('las rutas de modalidades son privadas y no exponen PATCH sin configuración real', () => {
  const stack = (businessRouter as any).stack as Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
  const routes = stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route!.methods)[0].toUpperCase()} ${layer.route!.path}`);
  assert.equal(routes.length, 9);
  assert.equal(routes.every((route) => route.includes('/businesses/:businessId/modalities')), true);
  assert.equal(routes.some((route) => route.startsWith('PATCH ')), false);
});

test('JWT ausente o inválido se rechaza sin consultar membresías', async () => {
  for (const authorization of [undefined, 'Bearer invalid-token']) {
    let received: unknown;
    await requireAuth(request(authorization ? { authorization } : {}), {} as any, (error) => { received = error; });
    assert.equal(received instanceof AppError, true);
    assert.equal((received as AppError).statusCode, 401);
  }
});

test('origen no autorizado se rechaza y origen confiable continúa', () => {
  let rejected: unknown;
  requireTrustedOrigin(request({ origin: 'https://evil.example' }), {} as any, (error) => { rejected = error; });
  assert.equal(rejected instanceof AppError, true);
  assert.equal((rejected as AppError).statusCode, 403);

  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174']) {
    let continued = false;
    requireTrustedOrigin(request({ origin }), {} as any, (error) => { continued = !error; });
    assert.equal(continued, true, `debe permitir ${origin} en desarrollo`);
  }
});
