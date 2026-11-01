import { loadEnvFile } from 'node:process';
import { isUnverifiedEmailLoginExceptionAllowed } from '../modules/auth/email-login-policy.js';

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

const authCookieSameSite = process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase() ?? 'lax';
if (!['lax', 'strict', 'none'].includes(authCookieSameSite) || (authCookieSameSite === 'none' && nodeEnv !== 'production')) {
  throw new Error('AUTH_COOKIE_SAMESITE debe ser lax, strict o none; none solo está permitido en producción.');
}
const allowUnverifiedEmailLogin = process.env.AUTH_ALLOW_UNVERIFIED_EMAIL_LOGIN?.trim().toLowerCase() === 'true';
if (!isUnverifiedEmailLoginExceptionAllowed(nodeEnv, allowUnverifiedEmailLogin) && allowUnverifiedEmailLogin) {
  throw new Error('AUTH_ALLOW_UNVERIFIED_EMAIL_LOGIN no está permitido en producción.');
}
const defaultTrustedOrigins = nodeEnv === 'development'
  ? 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:5175,http://localhost:5175,http://127.0.0.1:5176,http://localhost:5176,http://127.0.0.1:5185,http://localhost:5185'
  : '';
const trustedOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? defaultTrustedOrigins).split(',').map((origin) => origin.trim()).filter(Boolean);
if (nodeEnv === 'production' && trustedOrigins.length === 0) {
  throw new Error('AUTH_TRUSTED_ORIGINS debe configurarse en producción.');
}
const emailMode = process.env.EMAIL_MODE?.trim() ?? 'development';
if (!['development', 'resend'].includes(emailMode)) {
  throw new Error('EMAIL_MODE debe ser development o resend.');
}
const emailFrom = process.env.EMAIL_FROM?.trim() ?? 'XAMUKO <notificaciones@xamuko.com>';
const emailVerificationUrl = process.env.EMAIL_VERIFICATION_URL?.trim() ?? 'http://localhost:5173/verify-email';
const passwordResetUrl = process.env.PASSWORD_RESET_URL?.trim() ?? 'http://localhost:5173/reset-password';
const passwordResetAdminUrl = process.env.PASSWORD_RESET_ADMIN_URL?.trim() ?? 'https://admin.xamuko.com/reset-password';
// RESEND_API_KEY is the canonical name. EMAIL_API_KEY remains a backwards-compatible fallback
// for existing local environments and is never logged or exposed.
const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? process.env.EMAIL_API_KEY?.trim();
const emailApiUrl = process.env.EMAIL_API_URL?.trim() ?? 'https://api.resend.com/emails';
const emailLogoUrl = process.env.EMAIL_LOGO_URL?.trim();
if (!emailFrom || !emailVerificationUrl || !passwordResetUrl) {
  throw new Error('La configuración de correo no puede estar vacía.');
}
if (emailLogoUrl) {
  try {
    const logoUrl = new URL(emailLogoUrl);
    if (logoUrl.protocol !== 'https:') throw new Error('EMAIL_LOGO_URL debe usar HTTPS.');
  } catch {
    throw new Error('EMAIL_LOGO_URL debe ser una URL HTTPS válida.');
  }
}
if (emailMode === 'resend' && !resendApiKey) {
  throw new Error('RESEND_API_KEY es obligatorio cuando EMAIL_MODE=resend.');
}

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() ?? 'http://localhost:3000/api/v1/auth/google/callback';
const googleFrontendUrl = process.env.GOOGLE_FRONTEND_URL?.trim() ?? 'http://localhost:5173';
const googleFrontendUrls = Object.freeze({
  usuario: process.env.GOOGLE_FRONTEND_URL_USUARIO?.trim() ?? googleFrontendUrl,
  negocios: process.env.GOOGLE_FRONTEND_URL_NEGOCIOS?.trim() ?? 'http://localhost:5174',
  staging: process.env.GOOGLE_FRONTEND_URL_STAGING?.trim() ?? 'https://staging.xamuko.com',
});
const googleBackendUrl = process.env.GOOGLE_BACKEND_URL?.trim() ?? 'http://localhost:3000';

export const env = Object.freeze({
  nodeEnv,
  port,
  host,
  databaseUrl: process.env.DATABASE_URL,
  accessTokenSecret,
  accessTokenTtlSeconds,
  refreshTokenTtlDays,
  authCookieSameSite: authCookieSameSite as 'lax' | 'strict' | 'none',
  allowUnverifiedEmailLogin,
  trustedOrigins,
  emailMode,
  emailFrom,
  emailVerificationUrl,
  passwordResetUrl,
  passwordResetAdminUrl,
  resendApiKey,
  emailApiUrl,
  emailLogoUrl,
  smtpHost: process.env.SMTP_HOST?.trim(),
  smtpPort: process.env.SMTP_PORT?.trim(),
  smtpUser: process.env.SMTP_USER?.trim(),
  googleClientId,
  googleClientSecret,
  googleRedirectUri,
  googleFrontendUrl,
  googleFrontendUrls,
  googleBackendUrl,
});
