import { env } from '../../config/env.js';
import { DevelopmentEmailSender } from './development-email-sender.js';
import { ResendEmailSender } from './resend-email-sender.js';
import type { EmailSender } from './email-sender.js';
import { renderPasswordResetEmail, renderVerificationEmail } from './email-templates.js';
import type { EmailApplication } from './email-brand.js';

const sender: EmailSender = env.emailMode === 'resend'
  ? new ResendEmailSender(env.emailApiKey as string, env.emailApiUrl, env.emailFrom)
  : new DevelopmentEmailSender();

export async function sendVerificationEmail(to: string, token: string, displayName?: string, application: EmailApplication = 'usuario'): Promise<void> {
  await sender.send(renderVerificationEmail({ to, token, displayName, baseUrl: env.emailVerificationUrl }, application));
}

export async function sendPasswordResetEmail(to: string, token: string, displayName?: string, application: EmailApplication = 'usuario'): Promise<void> {
  await sender.send(renderPasswordResetEmail({ to, token, displayName, baseUrl: env.passwordResetUrl }, application));
}
