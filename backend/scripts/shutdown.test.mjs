import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';

test('SIGTERM closes HTTP and an active database pool without systemd killing it', {
  timeout: 20_000, skip: !process.env.SHUTDOWN_TEST_DATABASE_URL,
}, async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['--input-type=module', '--eval', `
    const { prisma } = await import('./dist/config/prisma.js');
    await prisma.$queryRawUnsafe('SELECT 1');
    await import('./dist/server.js');
  `], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: process.env.SHUTDOWN_TEST_DATABASE_URL,
      AUTH_ACCESS_TOKEN_SECRET: 'shutdown-test-only-not-for-production-0123456789',
      GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-only',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(child, 'exit');
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const guard = setTimeout(() => child.kill('SIGKILL'), 12_000);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(500) });
        await response.arrayBuffer();
        if (response.ok) { ready = true; break; }
      } catch { /* Wait for the actual server, not a mocked close callback. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Server did not become ready: ${output}`);
    const started = Date.now();
    child.kill('SIGTERM');
    const [code, signal] = await closed;
    assert.equal(signal, null, output);
    assert.equal(code, 0, output);
    assert.ok(Date.now() - started < 5_000, `Shutdown took too long: ${output}`);
  } finally {
    clearTimeout(guard);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});
