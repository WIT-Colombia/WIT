import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { activationCodeMatches } from './admin-passkey-activation.service.js';

const code = 'activation-code-only-in-secret-manager';
const digest = createHash('sha256').update(code).digest('hex');

test('rechaza activación sin código', () => assert.equal(activationCodeMatches(digest, ''), false));
test('rechaza código incorrecto', () => assert.equal(activationCodeMatches(digest, 'otro-codigo'), false));
test('acepta únicamente el código cuyo hash coincide', () => assert.equal(activationCodeMatches(digest, code), true));
test('rechaza configuración ausente o hash inválido', () => {
  assert.equal(activationCodeMatches(undefined, code), false);
  assert.equal(activationCodeMatches('not-a-sha256', code), false);
});
