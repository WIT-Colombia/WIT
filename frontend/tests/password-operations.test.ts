import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { postPasswordOperation, PasswordOperationError } from '../packages/utils/src/passwordOperations.ts';
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
const token = 'synthetic-reset-token-'.repeat(3);
const reset = { token, password: 'new-password-123', rememberMe: false };
test('recovery accepts exactly 202 and never asserts mailbox delivery', async () => {
  let sent: RequestInit | undefined;
  globalThis.fetch = async (_path, init) => { sent = init; return Response.json({ message: 'Si la cuenta existe, recibirás instrucciones.' }, { status: 202 }); };
  await postPasswordOperation('/api/v1/auth/password-reset/request', { email: 'test@example.test' }, 'request');
  assert.equal(sent?.credentials, 'include'); assert.equal(sent?.method, 'POST');
});
test('change accepts a real empty 204 and transmits authorization', async () => {
  globalThis.fetch = async (_path, init) => { assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture-token'); assert.deepEqual(JSON.parse(String(init?.body)), { currentPassword: 'old-password', newPassword: 'new-password' }); return new Response(null, { status: 204 }); };
  await postPasswordOperation('/api/v1/auth/change-password', { currentPassword: 'old-password', newPassword: 'new-password' }, 'change', 'fixture-token');
});
for (const operation of ['request', 'reset', 'change'] as const) {
  for (const kind of ['html', 'empty-json'] as const) test(`${operation} rejects a successful HTTP response with ${kind}`, async () => {
    globalThis.fetch = async () => kind === 'html' ? new Response('<html>SPA</html>', { status: 200 }) : Response.json({});
    await assert.rejects(postPasswordOperation('/api/v1/auth/test', { ...reset, newPassword: reset.password }, operation), (error: unknown) => error instanceof PasswordOperationError && error.code === 'INVALID_RESPONSE');
  });
}
test('reset accepts password completion even when automatic login is unavailable', async () => {
  globalThis.fetch = async () => Response.json({ user: { id: 'fixture' }, autoLogin: false });
  await postPasswordOperation('/api/v1/auth/password-reset/confirm', reset, 'reset');
});
for (const code of ['INVALID_AUTH_TOKEN', 'INVALID_CURRENT_PASSWORD', 'PASSWORD_UNCHANGED', 'EMAIL_NOT_VERIFIED', 'PASSWORD_NOT_AVAILABLE']) test(`preserves backend rejection ${code}`, async () => {
  globalThis.fetch = async () => Response.json({ error: { code, message: 'Operación rechazada.' } }, { status: 400 });
  await assert.rejects(postPasswordOperation('/api/v1/auth/password-reset/confirm', reset, 'reset'), (error: unknown) => error instanceof PasswordOperationError && error.code === code);
});
test('429 preserves Retry-After and network failure never becomes success', async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Espera.' } }, { status: 429, headers: { 'Retry-After': '60' } });
  await assert.rejects(postPasswordOperation('/api/v1/auth/password-reset/confirm', reset, 'reset'), /60 segundos/);
  globalThis.fetch = async () => { throw new Error('network'); };
  await assert.rejects(postPasswordOperation('/api/v1/auth/password-reset/confirm', reset, 'reset'), /No pudimos confirmar/);
});
test('missing or malformed-length tokens and invalid passwords never reach the API', async () => {
  globalThis.fetch = async () => { assert.fail('API must not be called'); };
  for (const value of ['', 'short', 'x'.repeat(257)]) await assert.rejects(postPasswordOperation('/api/v1/auth/password-reset/confirm', { ...reset, token: value }, 'reset'), /enlace/);
  for (const password of ['short', 'x'.repeat(129)]) await assert.rejects(postPasswordOperation('/api/v1/auth/password-reset/confirm', { ...reset, password }, 'reset'), /8 y 128/);
});
