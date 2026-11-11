import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPasswordResetEmail, renderSecurityNotificationEmail, renderVerificationEmail, renderWelcomeEmail } from './email-templates.js';

test('keeps the approved verification design and the encoded link', () => {
  const message = renderVerificationEmail({ to: 'person@example.test', token: 'token with spaces', baseUrl: 'https://usuario.example/verify-email', displayName: '<Persona>' });
  assert.equal(message.to, 'person@example.test');
  assert.match(message.subject, /Verifica/);
  assert.match(message.text, /token%20with%20spaces/);
  assert.match(message.html, /&lt;Persona&gt;/);
  assert.match(message.html, /15 minutos/);
  assert.match(message.html, /max-width:760px/);
  assert.match(message.html, /class="mail-body"/);
  assert.match(message.html, /background-image:linear-gradient\(180deg,#bf53ff 0%,#810bd1 47%,#5202a9 100%\)/);
  assert.match(message.html, /https:\/\/xamuko\.com\/assets\/xamuko-symbol\.png/);
  assert.doesNotMatch(message.html, /WIT/);
});

test('renders approved password reset art with a real one-use 15 minute link', () => {
  const message = renderPasswordResetEmail({ to: 'person@example.test', token: 'reset-token', baseUrl: 'https://user.xamuko.com/recuperar', displayName: 'Mónica Cepeda' });
  assert.match(message.subject, /Recupera tu contraseña de XAMUKO/);
  assert.match(message.text, /15 minutos/);
  assert.match(message.html, /15 minutos/);
  assert.match(message.html, /ilustracion-candado\.png/);
  assert.match(message.html, /icono-reloj\.png/);
  assert.match(message.html, /assets\/xamuko-symbol\.png/);
  assert.match(message.html, /width:100%;max-width:760px/);
  assert.match(message.html, /@media only screen and \(max-width:660px\)/);
  assert.match(message.html, /Hola, <strong[^>]*>Mónica Cepeda<\/strong>/);
  assert.match(message.html, /href="https:\/\/user\.xamuko\.com\/recuperar\?token=reset-token"/);
  assert.match(message.html, /Restablecer contraseña/);
  assert.doesNotMatch(message.html, /WIT|{{|data:image/);
});

test('escapes dynamic values in password reset without altering the plain-text URL', () => {
  const message = renderPasswordResetEmail({
    to: 'person@example.test',
    token: 'reset token',
    baseUrl: 'https://user.xamuko.com/recuperar?source=email&mode=secure',
    displayName: 'Ana & <img src=x onerror=alert(1)>',
  });
  assert.match(message.html, /Ana &amp; &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(message.html, /source=email&amp;mode=secure&amp;token=reset%20token/);
  assert.match(message.text, /source=email&mode=secure&token=reset%20token/);
  assert.doesNotMatch(message.html, /<img src=x onerror=/);
});

test('uses the Business identity while retaining the correct recovery URL', () => {
  const message = renderPasswordResetEmail({
    to: 'business@example.test',
    token: 'business-token',
    baseUrl: 'https://business.xamuko.com/recuperar',
    displayName: 'Negocio',
  }, 'negocios');
  assert.match(message.subject, /XAMUKO Business/);
  assert.match(message.html, /tu cuenta de XAMUKO Business/);
  assert.match(message.html, /business\.xamuko\.com\/recuperar\?token=business-token/);
  assert.doesNotMatch(message.html, /WIT Negocios/);
});

test('supports the Admin brand without leaking the old WIT identity', () => {
  const message = renderPasswordResetEmail({ to: 'admin@example.test', token: 'admin-token', baseUrl: 'https://admin.xamuko.com/recuperar' }, 'admin');
  assert.match(message.subject, /XAMUKO Admin/);
  assert.match(message.html, /XAMUKO Admin/);
  assert.match(message.text, /XAMUKO Admin/);
  assert.doesNotMatch(message.html, /WIT Admin/);
});

test('renders the same approved decorative logo and safe HTTPS markup for verification', () => {
  const message = renderVerificationEmail({ to: 'person@example.test', token: 'token', baseUrl: 'https://usuario.example/verify-email', logoUrl: 'https://cdn.example/xamuko.png' });
  assert.match(message.html, /src="https:\/\/xamuko\.com\/assets\/xamuko-symbol\.png"/);
  for (const asset of ['ilustracion-correo.png', 'icono-reloj.png', 'icono-sobre-blanco.png', 'pie-xamuko.png']) {
    assert.ok(message.html.includes('https://xamuko.com/assets/email/verify/' + asset));
  }
  assert.doesNotMatch(message.html, /\{\{(?:verification_url|nombre|app_name|asset_base_url)\}\}/);
});

test('welcome emails confirm verified activation and never ask for verification again', () => {
  const welcome = renderWelcomeEmail({ to: 'person@example.test', displayName: '<Persona>' });
  assert.match(welcome.subject, /Bienvenido · XAMUKO/);
  assert.match(welcome.html, /&lt;Persona&gt;/);
  assert.match(welcome.html, /ilustracion-correo\.png/);
  assert.match(welcome.html, /Tu correo está verificado y tu cuenta está activa/);
  assert.match(welcome.html, /Ya puedes iniciar sesión en XAMUKO/);
  assert.match(welcome.html, /xamuko-symbol\.png/);
  assert.doesNotMatch(welcome.html, /href="/);
  assert.match(welcome.text, /Tu correo está verificado y tu cuenta está activa/);
  assert.doesNotMatch(`${welcome.html} ${welcome.text}`, /verifica tu correo|verificar tu correo/i);

  const business = renderWelcomeEmail({ to: 'business@example.test', application: 'negocios' });
  assert.match(business.text, /Ya puedes iniciar sesión en XAMUKO Business/);
  assert.doesNotMatch(`${business.html} ${business.text}`, /verifica tu correo|verificar tu correo/i);
});
test('security notice keeps the action safe, with clear guidance and no phishing CTA', () => {
  const security = renderSecurityNotificationEmail({ to: 'person@example.test', displayName: 'Ana & <Persona>' }, 'Se cambió tu contraseña');
  assert.match(security.subject, /Aviso de seguridad · XAMUKO/);
  assert.match(security.html, /Ana &amp; &lt;Persona&gt;/);
  assert.match(security.html, /Se cambió tu contraseña/);
  assert.match(security.html, /ilustracion-candado\.png/);
  assert.match(security.html, /Si no reconoces esta actividad/);
  assert.doesNotMatch(security.html, /href="/);
  assert.match(security.text, /Se cambió tu contraseña/);
});

test('uses an authorized hosted HTTPS logo override for reset and notices', () => {
  const logoUrl = 'https://cdn.xamuko.com/email/logo.png?a=1&b=2';
  const reset = renderPasswordResetEmail({ to: 'person@example.test', token: 't', baseUrl: 'https://user.xamuko.com/recuperar', logoUrl });
  const welcome = renderWelcomeEmail({ to: 'person@example.test', logoUrl });
  const security = renderSecurityNotificationEmail({ to: 'person@example.test', logoUrl });
  for (const message of [reset, welcome, security]) {
    assert.match(message.html, /src="https:\/\/cdn\.xamuko\.com\/email\/logo\.png\?a=1&amp;b=2"/);
    assert.doesNotMatch(message.html, /src="http:\/\//);
  }
});

test('password change security alerts use the correct brand without exposing credentials or reset links', () => {
  for (const app of ['usuario', 'negocios'] as const) {
    const message = renderSecurityNotificationEmail({
      to: 'person@example.test', displayName: 'Lucía <Ejemplo>', application: app,
    }, 'Se cambió la contraseña de tu cuenta');
    const brand = app === 'negocios' ? 'XAMUKO Business' : 'XAMUKO';
    assert.equal(message.subject, `Aviso de seguridad · ${brand}`);
    assert.match(message.html, /Se cambió la contraseña de tu cuenta/);
    assert.match(message.html, /Si no reconoces esta actividad/);
    assert.match(message.html, /Lucía &lt;Ejemplo&gt;/);
    assert.match(message.text, new RegExp(brand));
    assert.doesNotMatch(message.html + message.text, /href="|token=|reset-token|passwordHash/i);
  }
});
