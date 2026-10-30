import { randomBytes, createHash } from 'node:crypto';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

const RP_ID = env.adminWebauthnRpId;
const ORIGIN = env.adminWebauthnOrigin;
const RP_NAME = env.adminWebauthnRpName;
const TTL_MS = 5 * 60 * 1000;

function requireConfig() {
  if (!RP_ID || !ORIGIN) throw new AppError(503, 'ADMIN_WEBAUTHN_NOT_CONFIGURED', 'WebAuthn administrativo no está configurado.');
}
function assertFresh(expiresAt: Date, consumedAt: Date | null) {
  if (consumedAt || expiresAt <= new Date()) throw new AppError(400, 'ADMIN_WEBAUTHN_CHALLENGE_INVALID', 'El desafío WebAuthn expiró o ya fue utilizado.');
}
export async function beginRegistration(userId: string) {
  requireConfig();
  const credentials = await (prisma as any).adminWebAuthnCredential.findMany({ where: { userId, revokedAt: null }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({ rpName: RP_NAME, rpID: RP_ID, userName: userId, userDisplayName: 'XAMUKO Admin', attestationType: 'none', excludeCredentials: credentials.map((item: any) => ({ id: item.credentialId, transports: item.transports ? item.transports.split(',') : undefined })) });
  await (prisma as any).adminWebAuthnChallenge.create({ data: { userId, challenge: options.challenge, purpose: 'registration', expiresAt: new Date(Date.now() + TTL_MS) } });
  return options;
}
export async function finishRegistration(userId: string, response: any) {
  requireConfig();
  const challenge = await (prisma as any).adminWebAuthnChallenge.findFirst({ where: { userId, purpose: 'registration', consumedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!challenge) throw new AppError(400, 'ADMIN_WEBAUTHN_CHALLENGE_INVALID', 'No existe un desafío WebAuthn válido.');
  assertFresh(challenge.expiresAt, challenge.consumedAt);
  const verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID });
  if (!verification.verified || !verification.registrationInfo) throw new AppError(401, 'ADMIN_WEBAUTHN_INVALID', 'La credencial WebAuthn no es válida.');
  const info: any = verification.registrationInfo;
  await (prisma as any).$transaction([
    (prisma as any).adminWebAuthnChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
    (prisma as any).adminWebAuthnCredential.create({ data: { userId, credentialId: info.credential.id, publicKey: Buffer.from(info.credential.publicKey), counter: info.credential.counter, transports: response.response?.transports?.join(',') ?? null } }),
  ]);
  return { verified: true };
}
export async function beginAuthentication(userId: string) {
  requireConfig();
  const credentials = await (prisma as any).adminWebAuthnCredential.findMany({ where: { userId, revokedAt: null }, select: { credentialId: true, transports: true } });
  if (!credentials.length) throw new AppError(403, 'ADMIN_WEBAUTHN_REQUIRED', 'Registra una passkey antes de continuar.');
  const options = await generateAuthenticationOptions({ rpID: RP_ID, allowCredentials: credentials.map((item: any) => ({ id: item.credentialId, transports: item.transports ? item.transports.split(',') : undefined })) });
  await (prisma as any).adminWebAuthnChallenge.create({ data: { userId, challenge: options.challenge, purpose: 'authentication', expiresAt: new Date(Date.now() + TTL_MS) } });
  return options;
}
export async function finishAuthentication(userId: string, response: any) {
  requireConfig();
  const challenge = await (prisma as any).adminWebAuthnChallenge.findFirst({ where: { userId, purpose: 'authentication', consumedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!challenge) throw new AppError(400, 'ADMIN_WEBAUTHN_CHALLENGE_INVALID', 'No existe un desafío WebAuthn válido.');
  assertFresh(challenge.expiresAt, challenge.consumedAt);
  const credential = await (prisma as any).adminWebAuthnCredential.findFirst({ where: { userId, credentialId: response.id, revokedAt: null } });
  if (!credential) throw new AppError(401, 'ADMIN_WEBAUTHN_INVALID', 'La credencial WebAuthn no está autorizada.');
  const verification = await verifyAuthenticationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID, credential: { id: credential.credentialId, publicKey: credential.publicKey, counter: Number(credential.counter) } });
  if (!verification.verified) throw new AppError(401, 'ADMIN_WEBAUTHN_INVALID', 'La aserción WebAuthn no es válida.');
  await (prisma as any).$transaction([
    (prisma as any).adminWebAuthnChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
    (prisma as any).adminWebAuthnCredential.update({ where: { id: credential.id }, data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() } }),
  ]);
  return { verified: true };
}
export function hashAdminSessionToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function newAdminSessionToken() { return randomBytes(48).toString('base64url'); }
