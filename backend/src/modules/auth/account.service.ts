import argon2 from 'argon2';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getCurrentUser } from './auth.service.js';
import type { ChangePasswordInput, ProfileUpdateInput } from './auth.schemas.js';

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: input.name.trim(),
    },
  });
  return getCurrentUser(userId);
}

export async function changePassword(userId: string, currentSessionId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailNormalized: true } });
  const identity = user?.emailNormalized ? await prisma.authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'EMAIL', providerSubject: user.emailNormalized } },
    select: { id: true, passwordHash: true },
  }) : null;
  if (!identity) {
    throw new AppError(400, 'PASSWORD_NOT_AVAILABLE', 'Esta cuenta no tiene una contraseña de WIT configurada.');
  }
  if (!identity.passwordHash || !(await argon2.verify(identity.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.');
  }
  if (await argon2.verify(identity.passwordHash, input.newPassword)) {
    throw new AppError(400, 'PASSWORD_UNCHANGED', 'La nueva contraseña debe ser diferente.');
  }
  const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.authIdentity.update({ where: { id: identity.id }, data: { passwordHash } });
    await transaction.session.updateMany({ where: { userId, id: { not: currentSessionId }, revokedAt: null }, data: { revokedAt: now } });
  });
}
