import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleAuthorization, getGoogleState, safeGoogleReturnTo, setGoogleStateCookie } from './google-oauth.service.js';

test('Google OAuth state is signed, bound to the flow and recoverable only from the HttpOnly cookie', () => {
  const authorization = createGoogleAuthorization({ flow: 'login', returnTo: '/profile', rememberMe: false, consent: true });
  const headers: string[] = [];
  setGoogleStateCookie({ appendHeader: (_name: string, value: string) => headers.push(value) } as never, authorization.state);
  const cookie = headers[0].split(';', 1)[0];
  const request = { headers: { cookie } } as never;
  const recovered = getGoogleState(request);
  assert.equal(recovered.state, authorization.state.state);
  assert.equal(recovered.flow, 'login');
  assert.equal(recovered.rememberMe, false);
  assert.match(headers[0], /HttpOnly/);
});

test('Google OAuth return paths cannot redirect outside WIT', () => {
  assert.equal(safeGoogleReturnTo('https://evil.example'), '/home');
  assert.equal(safeGoogleReturnTo('//evil.example'), '/home');
  assert.equal(safeGoogleReturnTo('/settings'), '/settings');
});
