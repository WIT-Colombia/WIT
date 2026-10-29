import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_TIMESTAMP_SKEW_SECONDS = 300;

function decodeSecret(secret: string): Buffer {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(encoded, 'base64');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Validates Resend/Svix webhook headers against the untouched request body. */
export function verifyResendWebhookSignature(input: {
  body: string;
  secret: string;
  webhookId?: string;
  timestamp?: string;
  signature?: string;
  nowSeconds?: number;
}): boolean {
  if (!input.webhookId || !input.timestamp || !input.signature || !input.secret) return false;
  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) return false;
  const signedPayload = `${input.webhookId}.${input.timestamp}.${input.body}`;
  const expected = createHmac('sha256', decodeSecret(input.secret)).update(signedPayload).digest('base64');
  return input.signature.split(' ').some((candidate) => candidate.startsWith('v1,') && safeEqual(candidate.slice(3), expected));
}

export const RESEND_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = MAX_TIMESTAMP_SKEW_SECONDS;
