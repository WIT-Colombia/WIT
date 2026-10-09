import assert from 'node:assert/strict';
import test from 'node:test';
import { ResendEmailSender } from './resend-email-sender.js';

test('sends the email payload through the configured provider without logging it', async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return new Response('{}', { status: 200 });
  };

  try {
    await new ResendEmailSender('test-api-key', 'https://provider.test/emails', 'WIT <no-reply@example.test>').send({
      to: 'person@example.test',
      subject: 'Subject',
      text: 'Plain text',
      html: '<p>HTML</p>',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request?.url, 'https://provider.test/emails');
  assert.equal(request?.init?.method, 'POST');
  assert.equal(new Headers(request?.init?.headers).get('Authorization'), 'Bearer test-api-key');
  assert.match(String(request?.init?.body), /Plain text/);
  assert.match(String(request?.init?.body), /<p>HTML<\/p>/);
});

for (const providerStatus of [401, 403, 422, 429, 500, 502, 503]) {
  test(`maps Resend HTTP ${providerStatus} to a safe public error`, async () => {
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    const logs: unknown[] = [];
    globalThis.fetch = async () => new Response(JSON.stringify({
      name: 'validation_error',
      message: 'private recipient and token details must not be logged',
    }), { status: providerStatus, headers: { 'Content-Type': 'application/json' } });
    console.error = (...args: unknown[]) => logs.push(args);

    try {
      await assert.rejects(
        () => new ResendEmailSender('secret-api-key', 'https://provider.test/emails', 'WIT <no-reply@example.test>').send({
          to: 'person@example.test',
          subject: 'Subject',
          text: 'Plain text',
          html: '<p>HTML</p>',
        }),
        (error: unknown) => error instanceof Error
          && 'statusCode' in error
          && error.statusCode === 503
          && 'code' in error
          && error.code === 'EMAIL_DELIVERY_FAILED',
      );
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalConsoleError;
    }

    assert.equal(logs.length, 1);
    const [message, details] = logs[0] as [string, Record<string, unknown>];
    assert.equal(message, 'Resend email delivery failed');
    assert.deepEqual(details, {
      providerStatus,
      providerCode: 'validation_error',
      providerType: 'validation_error',
    });
    assert.doesNotMatch(JSON.stringify(logs), /secret-api-key|person@example\.test|private recipient|token details/i);
  });
}
