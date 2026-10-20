import assert from 'node:assert/strict';
import test from 'node:test';
import { favoriteRouter } from './favorite.routes.js';

test('las rutas de favoritos son privadas y cubren guardar, consultar y eliminar', () => {
  const stack = (favoriteRouter as any).stack as Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Function }> } }>;
  const routes = stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route!.methods)[0].toUpperCase()} ${layer.route!.path}`);
  assert.deepEqual(routes, [
    'GET /favorites',
    'GET /favorites/ids',
    'GET /businesses/:businessId/favorites/count',
    'POST /businesses/:businessId/favorite',
    'DELETE /businesses/:businessId/favorite',
    'GET /businesses/:businessId/offers/likes',
    'GET /offers/likes/mine',
    'GET /offers/likes',
    'GET /offers/:offerId/like',
    'POST /offers/:offerId/like',
    'DELETE /offers/:offerId/like',
  ]);
  const middlewareNames = stack.filter((layer) => !layer.route).map((layer) => layer as any).map((layer) => layer.handle.name);
  assert.equal(middlewareNames.includes('requireAuth'), true);
});
