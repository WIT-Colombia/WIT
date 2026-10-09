import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPasswordResetEmail, renderVerificationEmail } from './email-templates.js';

test('renders a verification message with an encoded one-time link', () => {
  const message = renderVerificationEmail({ to: 'person@example.test', token: 'token with spaces', baseUrl: 'https://usuario.wit.example/verify-email', displayName: '<Persona>' });
  assert.equal(message.to, 'person@example.test');
  assert.match(message.subject, /Verifica/);
  assert.match(message.text, /token%20with%20spaces/);
  assert.match(message.html, /&lt;Persona&gt;/);
  assert.match(message.html, /24 horas/);
  assert.match(message.html, /max-width:600px/);
  assert.match(message.html, /padding:40px/);
  assert.match(message.html, /background:#16B978/);
  assert.match(message.html, /WIT Usuarios · Encuentra lo que necesitas/);
});

test('renders a password reset message with the shorter expiry', () => {
  const message = renderPasswordResetEmail({ to: 'person@example.test', token: 'reset-token', baseUrl: 'https://usuario.wit.example/reset-password' });
  assert.match(message.subject, /contraseña/);
  assert.match(message.text, /30 minutos/);
  assert.match(message.html, /reset-token/);
  assert.match(message.html, /role="presentation"/);
  assert.match(message.html, /viewport/);
  assert.match(message.html, /Hola, ahí\./);
});

test('escapes dynamic values in the HTML while preserving the plain-text link', () => {
  const message = renderPasswordResetEmail({
    to: 'person@example.test',
    token: 'reset-token',
    baseUrl: 'https://usuario.wit.example/reset-password?source=email&mode=secure',
    displayName: 'Ana & <WIT>',
  });
  assert.match(message.html, /Ana &amp; &lt;WIT&gt;/);
  assert.match(message.html, /source=email&amp;mode=secure&amp;token=reset-token/);
  assert.match(message.text, /source=email&mode=secure&token=reset-token/);
});

test('uses the official brand variant without changing the secure link', () => {
  const message = renderVerificationEmail({ to: 'person@example.test', token: 'verification-token', baseUrl: 'https://negocios.wit.example/verify-email', displayName: 'Negocio' }, 'negocios');
  assert.match(message.html, /WIT Negocios/);
  assert.match(message.html, /background:#2563eb/);
  assert.match(message.html, /https:\/\/negocios\.wit\.example\/verify-email\?token=verification-token/);
  assert.match(message.text, /WIT Negocios · Encuentra lo que necesitas/);
});

test('supports the admin brand variant through a server-selected application', () => {
  const message = renderPasswordResetEmail({ to: 'admin@example.test', token: 'admin-token', baseUrl: 'https://admin.wit.example/reset-password' }, 'admin');
  assert.match(message.html, /WIT Admin/);
  assert.match(message.html, /background:#6D5AE6/);
  assert.match(message.text, /WIT Admin · Encuentra lo que necesitas/);
});
