import { env } from '../../config/env.js';
import { DevelopmentEmailSender } from './development-email-sender.js';
import { ResendEmailSender } from './resend-email-sender.js';
import type { EmailMessage, EmailSender } from './email-sender.js';
import { renderPasswordResetEmail, renderSecurityNotificationEmail, renderVerificationEmail, renderWelcomeEmail } from './email-templates.js';
import { createHash } from 'node:crypto';
import type { EmailApplication } from './email-brand.js';

const sender: EmailSender = env.emailMode === 'resend'
  ? new ResendEmailSender(env.resendApiKey as string, env.emailApiUrl, env.emailFrom)
  : new DevelopmentEmailSender();

/** Sends a fully rendered transactional message through the configured provider. */
export async function sendTransactionalEmail(message: EmailMessage): Promise<void> {
  await sender.send(message);
}

export async function sendVerificationEmail(to: string, token: string, displayName?: string, application: EmailApplication = 'usuario'): Promise<void> {
  const message = renderVerificationEmail({ to, token, displayName, baseUrl: env.emailVerificationUrl, logoUrl: env.emailLogoUrl }, application);
  await sendTransactionalEmail({ ...message, eventType: 'email_verification', idempotencyKey: `email_verification/${createHash('sha256').update(token).digest('hex')}` });
}

export async function sendPasswordResetEmail(to: string, token: string, displayName?: string, application: EmailApplication = 'usuario', resetBaseUrl: string = env.passwordResetUrl): Promise<void> {
  const message = renderPasswordResetEmail({ to, token, displayName, baseUrl: resetBaseUrl, logoUrl: env.emailLogoUrl }, application);
  await sendTransactionalEmail({ ...message, eventType: 'password_reset', idempotencyKey: `password_reset/${createHash('sha256').update(token).digest('hex')}` });
}

export async function sendWelcomeEmail(to: string, displayName?: string, application: EmailApplication = 'usuario'): Promise<void> {
  const message = renderWelcomeEmail({ to, displayName, application });
  await sendTransactionalEmail({ ...message, eventType: 'welcome', idempotencyKey: `welcome/${createHash('sha256').update(`${application}:${to}`).digest('hex')}` });
}

export async function sendSecurityNotificationEmail(to: string, displayName?: string, action?: string, application: EmailApplication = 'usuario'): Promise<void> {
  const message = renderSecurityNotificationEmail({ to, displayName, application }, action);
  await sendTransactionalEmail({ ...message, eventType: 'security_notification', idempotencyKey: `security_notification/${createHash('sha256').update(`${application}:${to}:${action ?? 'account-security'}`).digest('hex')}` });
}
