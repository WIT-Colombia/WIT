import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV debe ser development, test o production.');
}
const portValue = process.env.PORT ?? '3000';
const port = Number(portValue);
if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 1 y 65535.');
}
const host = process.env.HOST?.trim() ?? '127.0.0.1';
if (!host) throw new Error('HOST no puede estar vacío.');

const accessTokenSecret = process.env.AUTH_ACCESS_TOKEN_SECRET?.trim();
if (!accessTokenSecret || accessTokenSecret.length < 32) {
  throw new Error('AUTH_ACCESS_TOKEN_SECRET debe existir y tener al menos 32 caracteres.');
}

const accessTokenTtlSeconds = Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? '900');
if (!Number.isInteger(accessTokenTtlSeconds) || accessTokenTtlSeconds < 60 || accessTokenTtlSeconds > 3600) {
  throw new Error('AUTH_ACCESS_TOKEN_TTL_SECONDS debe estar entre 60 y 3600.');
}

const refreshTokenTtlDays = Number(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS ?? '30');
if (!Number.isInteger(refreshTokenTtlDays) || refreshTokenTtlDays < 1 || refreshTokenTtlDays > 365) {
  throw new Error('AUTH_REFRESH_TOKEN_TTL_DAYS debe estar entre 1 y 365.');
}

const emailMode = process.env.EMAIL_MODE?.trim() ?? 'development';
if (!['development', 'smtp'].includes(emailMode)) {
  throw new Error('EMAIL_MODE debe ser development o smtp.');
}
const emailFrom = process.env.EMAIL_FROM?.trim() ?? 'no-reply@wit.local';
const emailVerificationUrl = process.env.EMAIL_VERIFICATION_URL?.trim() ?? 'http://localhost:3000/verify-email';
const passwordResetUrl = process.env.PASSWORD_RESET_URL?.trim() ?? 'http://localhost:3000/reset-password';
if (!emailFrom || !emailVerificationUrl || !passwordResetUrl) {
  throw new Error('La configuración de correo no puede estar vacía.');
}

export const env = Object.freeze({
  nodeEnv,
  port,
  host,
  databaseUrl: process.env.DATABASE_URL,
  accessTokenSecret,
  accessTokenTtlSeconds,
  refreshTokenTtlDays,
  emailMode,
  emailFrom,
  emailVerificationUrl,
  passwordResetUrl,
  smtpHost: process.env.SMTP_HOST?.trim(),
  smtpPort: process.env.SMTP_PORT?.trim(),
  smtpUser: process.env.SMTP_USER?.trim(),
});
