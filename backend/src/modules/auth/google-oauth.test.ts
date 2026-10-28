import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleAuthorization, getGoogleState, safeGoogleReturnTo, setGoogleStateCookie } from './google-oauth.service.js';
import { createGoogleDiagnostic, logGoogleDiagnostic } from './google-diagnostics.js';

test('Google OAuth state is signed, bound to the flow and recoverable only from the HttpOnly cookie', () => {
  const authorization = createGoogleAuthorization({ flow: 'login', returnTo: '/profile', rememberMe: false, consent: true });
  const headers: string[] = [];
  setGoogleStateCookie({ appendHeader: (_name: string, value: string) => headers.push(value) } as never, authorization.state);
  const cookie = headers[0].split(';', 1)[0];
  const request = { headers: { cookie } } as never;
  const recovered = getGoogleState(request);
  assert.equal(recovered.state, authorization.state.state);
  assert.equal(recovered.flow, 'login');
  assert.equal(recovered.application, 'usuario');
  assert.equal(recovered.rememberMe, false);
  assert.match(headers[0], /HttpOnly/);
});

test('Google OAuth state preserves the explicit Business application', () => {
  const authorization = createGoogleAuthorization({ application: 'negocios', flow: 'login', returnTo: '/mis-negocios', consent: true });
  const headers: string[] = [];
  setGoogleStateCookie({ appendHeader: (_name: string, value: string) => headers.push(value) } as never, authorization.state);
  const cookie = headers[0].split(';', 1)[0];
  const recovered = getGoogleState({ headers: { cookie } } as never);
  assert.equal(recovered.application, 'negocios');
  assert.equal(recovered.returnTo, '/mis-negocios');
});

test('Google OAuth return paths cannot redirect outside WIT', () => {
  assert.equal(safeGoogleReturnTo('https://evil.example'), '/home');
  assert.equal(safeGoogleReturnTo('//evil.example'), '/home');
  assert.equal(safeGoogleReturnTo('/settings'), '/settings');
});

test('Google OAuth diagnostics contain only safe metadata', () => {
  const record = createGoogleDiagnostic('code_exchange', 'provider_rejected');
  assert.deepEqual(Object.keys(record).sort(), ['category', 'diagnosticId', 'stage']);
  assert.match(record.diagnosticId, /^[0-9a-f-]{36}$/);
  const logs: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logs.push(args);
  try { logGoogleDiagnostic(record); } finally { console.error = original; }
  assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs[0]).includes('token'), false);
  assert.equal(JSON.stringify(logs[0]).includes('secret'), false);
});
