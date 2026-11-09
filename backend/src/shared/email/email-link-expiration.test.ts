import assert from 'node:assert/strict';
import test from 'node:test';
import { EMAIL_ACTION_LINK_TTL_MINUTES, EMAIL_ACTION_LINK_TTL_MS, emailActionLinkExpiresAt } from './email-link-expiration.js';
import { renderPasswordResetEmail, renderVerificationEmail } from './email-templates.js';

test('XAMUKO verification and password-reset links expire exactly 15 minutes after issuance', () => {
  const issuedAt = new Date('2026-11-09T12:00:00.000Z');
  assert.equal(EMAIL_ACTION_LINK_TTL_MINUTES, 15);
  assert.equal(EMAIL_ACTION_LINK_TTL_MS, 900_000);
  assert.equal(emailActionLinkExpiresAt(issuedAt).toISOString(), '2026-11-09T12:15:00.000Z');
  assert.equal(issuedAt.toISOString(), '2026-11-09T12:00:00.000Z');
});

test('HTML and plain-text mail disclose the same actual 15-minute expiry', () => {
  const input = { to: 'recipient@example.test', token: 'synthetic-token', baseUrl: 'https://user.xamuko.com/verify-email' };
  for (const message of [
    renderVerificationEmail(input),
    renderPasswordResetEmail({ ...input, baseUrl: 'https://user.xamuko.com/recuperar' }),
  ]) {
    assert.match(message.html, /15 minutos/);
    assert.match(message.text, /15 minutos/);
    assert.doesNotMatch(message.html, /24 horas/);
    assert.doesNotMatch(message.text, /24 horas/);
  }
});
