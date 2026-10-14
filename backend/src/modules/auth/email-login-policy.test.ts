import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnverifiedEmailLoginExceptionAllowed, shouldRequireEmailVerification } from './email-login-policy.js';

test('el inicio de sesión no verificado se rechaza por defecto', () => {
  assert.equal(shouldRequireEmailVerification(null, false), true);
  assert.equal(shouldRequireEmailVerification(new Date(), false), false);
});

test('la excepción local permite la cuenta no verificada', () => {
  assert.equal(shouldRequireEmailVerification(null, true), false);
});

test('la política no permite activar la excepción en producción', () => {
  assert.equal(isUnverifiedEmailLoginExceptionAllowed('production', true), false);
  assert.equal(isUnverifiedEmailLoginExceptionAllowed('development', true), true);
});
