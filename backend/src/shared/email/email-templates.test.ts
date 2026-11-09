import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPasswordResetEmail, renderSecurityNotificationEmail, renderVerificationEmail, renderWelcomeEmail } from './email-templates.js';

test('renders a verification message with an encoded one-time link', () => {
  const message = renderVerificationEmail({ to: 'person@example.test', token: 'token with spaces', baseUrl: 'https://usuario.wit.example/verify-email', displayName: '<Persona>' });
  assert.equal(message.to, 'person@example.test');
  assert.match(message.subject, /Verifica/);
  assert.match(message.text, /token%20with%20spaces/);
  assert.match(message.html, /&lt;Persona&gt;/);
  assert.match(message.html, /15 minutos/);
  assert.match(message.html, /max-width:760px/);
  assert.match(message.html, /class="mail-body"/);
  assert.match(message.html, /background-image:linear-gradient\(180deg,#bf53ff 0%,#810bd1 47%,#5202a9 100%\)/);
  assert.match(message.text, /XAMUKO · Lo que necesitas, está más cerca\./);
  assert.doesNotMatch(message.html, /WIT/);
});

test('renders a password reset message with the shorter expiry', () => {
  const message = renderPasswordResetEmail({ to: 'person@example.test', token: 'reset-token', baseUrl: 'https://usuario.wit.example/reset-password' });
  assert.match(message.subject, /contraseña/);
  assert.match(message.text, /30 minutos/);
  assert.match(message.html, /reset-token/);
  assert.match(message.html, /role="presentation"/);
  assert.match(message.html, /viewport/);
  assert.match(message.html, /Hola, ahí\./);
  assert.match(message.subject, /XAMUKO/);
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
  assert.match(message.html, /XAMUKO Business/);
  assert.match(message.html, /background-color:#7206cb/);
  assert.match(message.html, /https:\/\/negocios\.wit\.example\/verify-email\?token=verification-token/);
  assert.match(message.text, /XAMUKO · Lo que necesitas, está más cerca/);
});

test('supports the admin brand variant through a server-selected application', () => {
  const message = renderPasswordResetEmail({ to: 'admin@example.test', token: 'admin-token', baseUrl: 'https://admin.wit.example/reset-password' }, 'admin');
  assert.match(message.html, /WIT Admin/);
  assert.match(message.html, /background:#6D5AE6/);
  assert.match(message.text, /WIT Admin · Encuentra lo que necesitas/);
});


test('renders the approved hosted XAMUKO artwork and preserves the reset email fallback', () => {
  const withLogo = renderVerificationEmail({ to: 'person@example.test', token: 'token', baseUrl: 'https://usuario.example/verify-email', logoUrl: 'https://cdn.example/xamuko.png' });
  assert.match(withLogo.html, /src="https:\/\/xamuko\.com\/assets\/xamuko-logo\.png"/);
  assert.match(withLogo.html, /alt="XAMUKO · Descubre · Apoya · Disfruta"/);
  for (const asset of ['ilustracion-correo.png', 'icono-reloj.png', 'icono-sobre-blanco.png', 'pie-xamuko.png']) {
    assert.ok(withLogo.html.includes('https://xamuko.com/assets/email/verify/' + asset));
  }
  assert.doesNotMatch(withLogo.html, /\{\{(?:verification_url|nombre|app_name|asset_base_url)\}\}/);


  const withoutLogo = renderPasswordResetEmail({ to: 'person@example.test', token: 'token', baseUrl: 'https://usuario.example/reset-password' });
  assert.doesNotMatch(withoutLogo.html, /<img[^>]+src=/);
  assert.match(withoutLogo.html, />XAMUKO<\/span>/);
});

test('renders welcome and security notices without exposing unsafe HTML', () => {
  const welcome = renderWelcomeEmail({ to: 'person@example.test', displayName: '<Persona>' });
  assert.match(welcome.subject, /Bienvenido/);
  assert.match(welcome.html, /&lt;Persona&gt;/);
  const security = renderSecurityNotificationEmail({ to: 'person@example.test', displayName: 'Persona' }, 'Se cambió tu contraseña');
  assert.match(security.subject, /Aviso de seguridad/);
  assert.match(security.text, /Se cambió tu contraseña/);
});
