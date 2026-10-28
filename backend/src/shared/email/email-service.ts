import { env } from '../../config/env.js';
import { DevelopmentEmailSender } from './development-email-sender.js';
import { ResendEmailSender } from './resend-email-sender.js';
import type { EmailMessage, EmailSender } from './email-sender.js';
import { renderPasswordResetEmail, renderVerificationEmail } from './email-templates.js';
import type { EmailApplication } from './email-brand.js';

const sender: EmailSender = env.emailMode === 'resend'
  ? new ResendEmailSender(env.resendApiKey as string, env.emailApiUrl, env.emailFrom)
  : new DevelopmentEmailSender();

/** Sends a fully rendered transactional message through the configured provider. */
export async function sendTransactionalEmail(message: EmailMessage): Promise<void> {
  await sender.send(message);
}

export async function sendVerificationEmail(to: string, token: string, displayName?: string, application: EmailApplication = 'usuario'): Promise<void> {
  await sendTransactionalEmail(renderVerificationEmail({ to, token, displayName, baseUrl: env.emailVerificationUrl, logoUrl: env.emailLogoUrl }, application));
}

export async function sendPasswordResetEmail(to: string, token: string, displayName?: string, application: EmailApplication = 'usuario'): Promise<void> {
  await sendTransactionalEmail(renderPasswordResetEmail({ to, token, displayName, baseUrl: env.passwordResetUrl, logoUrl: env.emailLogoUrl }, application));
}
