import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import { DevelopmentEmailSender } from './development-email-sender.js';
import type { EmailSender } from './email-sender.js';

const sender: EmailSender = new DevelopmentEmailSender();

function ensureDevelopmentMode(): void {
  if (env.emailMode !== 'development') {
    throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'El envío de correo no está configurado.');
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  ensureDevelopmentMode();
  await sender.send({
    to,
    subject: 'Verifica tu correo electrónico de WIT',
    text: `Verifica tu correo usando este enlace: ${env.emailVerificationUrl}?token=${token}`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  ensureDevelopmentMode();
  await sender.send({
    to,
    subject: 'Recupera tu contraseña de WIT',
    text: `Restablece tu contraseña usando este enlace: ${env.passwordResetUrl}?token=${token}`,
  });
}
