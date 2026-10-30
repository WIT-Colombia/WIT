import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../config/prisma.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const unique = (prefix: string) => prefix + '-' + randomBytes(8).toString('hex');
export type AdminFixture = { userId: string; googleSub: string; email: string; cleanup: () => Promise<void> };

export async function createAdminFixture(): Promise<AdminFixture> {
  const googleSub = 'ci-admin-google-sub';
  const email = unique('admin-test') + '@example.test';
  const user = await prisma.user.create({ data: { emailNormalized: email, displayName: 'Admin integration test', authIdentities: { create: { provider: 'GOOGLE', providerSubject: googleSub, verifiedAt: new Date() } }, adminRoleAssignments: { create: { role: 'SUPER_ADMIN', active: true } } }, select: { id: true } });
  return { userId: user.id, googleSub, email, cleanup: async () => { await prisma.adminSession.deleteMany({ where: { userId: user.id } }); await prisma.adminWebAuthnCredential.deleteMany({ where: { userId: user.id } }); await prisma.adminRoleAssignment.deleteMany({ where: { userId: user.id } }); await prisma.authIdentity.deleteMany({ where: { userId: user.id } }); await prisma.user.delete({ where: { id: user.id } }); } };
}

export async function createPendingOAuth(googleSub: string, state: 'valid' | 'expired' | 'consumed' = 'valid') {
  const token = randomBytes(48).toString('base64url');
  const record = await (prisma as any).adminPendingOAuth.create({ data: { googleSub, tokenHash: hash(token), expiresAt: new Date(Date.now() + (state === 'expired' ? -1000 : 300000)), consumedAt: state === 'consumed' ? new Date() : null } });
  return { ...record, token, cookie: 'xamuko_admin_pending=' + token };
}

export async function createActivation(googleSub: string, state: 'valid' | 'expired' | 'consumed' = 'valid') {
  const token = randomBytes(48).toString('base64url');
  const record = await (prisma as any).adminPasskeyActivation.create({ data: { googleSub, tokenHash: hash(token), expiresAt: new Date(Date.now() + (state === 'expired' ? -1000 : 600000)), consumedAt: state === 'consumed' ? new Date() : null } });
  return { ...record, token, cookie: 'xamuko_admin_activation=' + token };
}

export async function createAdminSession(userId: string, state: 'valid' | 'expired' | 'revoked' = 'valid') {
  const token = randomBytes(48).toString('base64url');
  const record = await (prisma as any).adminSession.create({ data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + (state === 'expired' ? -1000 : 28800000)), revokedAt: state === 'revoked' ? new Date() : null } });
  return { ...record, token, cookie: 'xamuko_admin_session=' + token };
}

export async function createWebAuthnCredential(userId: string) {
  const credentialId = randomBytes(32).toString('base64url');
  const record = await (prisma as any).adminWebAuthnCredential.create({ data: { userId, credentialId, publicKey: Buffer.alloc(32, 7), counter: 0, transports: 'internal' } });
  return record;
}
