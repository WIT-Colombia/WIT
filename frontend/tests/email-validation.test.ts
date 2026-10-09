import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEmail } from '../apps/usuario/src/services/emailValidation.ts';

test('email validation gives specific feedback for empty, malformed and incomplete domains', () => {
  assert.match(validateEmail(''), /Escribe tu correo/);
  assert.match(validateEmail('persona'), /signo @/);
  assert.match(validateEmail('persona@'), /dominio completo/);
  assert.equal(validateEmail('persona@example.com'), '');
});
