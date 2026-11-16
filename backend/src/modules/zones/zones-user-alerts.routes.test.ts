import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../../app.js';

test('Rutas de avisos territoriales: existen y exigen una cuenta autenticada', async () => {
  const server = app.listen(0);
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = 'http://127.0.0.1:' + address.port + '/api/v1/user/zones/alerts/50001';

    for (const method of ['GET', 'POST', 'DELETE']) {
      const response = await fetch(url, { method, signal: AbortSignal.timeout(5_000) });
      const body = await response.json() as { error?: { code?: string } };
      assert.equal(response.status, 401, method + ' no debe retornar 404 Ruta no encontrada');
      assert.equal(body.error?.code, 'UNAUTHENTICATED');
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
