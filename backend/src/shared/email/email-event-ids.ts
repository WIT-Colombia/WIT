import { randomUUID } from 'node:crypto';

/**
 * Every successful password change is a distinct security event.
 * Reusing a recipient/action key would suppress later alerts through Resend.
 * ResendEmailSender keeps this single key for all retries of the same send.
 */
export function newSecurityNotificationIdempotencyKey(): string {
  return `security_notification/${randomUUID()}`;
}
