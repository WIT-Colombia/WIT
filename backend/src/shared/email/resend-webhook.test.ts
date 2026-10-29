import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyResendWebhookSignature } from './resend-webhook.js';

test('accepts a valid Svix/Resend signature and rejects replayed or modified payloads', () => {
  const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'safe-test-id' } });
  const secret = `whsec_${Buffer.from('webhook-test-secret').toString('base64')}`;
  const webhookId = 'msg_test_123';
  const timestamp = '1700000000';
  const signature = createHmac('sha256', Buffer.from('webhook-test-secret')).update(`${webhookId}.${timestamp}.${body}`).digest('base64');
  const input = { body, secret, webhookId, timestamp, signature: `v1,${signature}`, nowSeconds: 1700000100 };
  assert.equal(verifyResendWebhookSignature(input), true);
  assert.equal(verifyResendWebhookSignature({ ...input, body: `${body} ` }), false);
  assert.equal(verifyResendWebhookSignature({ ...input, nowSeconds: 1700000401 }), false);
});

test('rejects missing headers and malformed signatures', () => {
  assert.equal(verifyResendWebhookSignature({ body: '{}', secret: 'whsec_a', nowSeconds: 1700000000 }), false);
  assert.equal(verifyResendWebhookSignature({ body: '{}', secret: 'whsec_a', webhookId: 'id', timestamp: '1700000000', signature: 'v1,bad', nowSeconds: 1700000000 }), false);
});
