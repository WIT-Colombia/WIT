import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function consumeVerificationToken(transaction: Pick<Prisma.TransactionClient, 'authToken' | 'authIdentity'>, token: string) {
  const now = new Date();
    const record = await transaction.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.type !== 'EMAIL_VERIFICATION' || record.consumedAt || record.expiresAt <= now) {
      throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');
    }
    const consumed = await transaction.authToken.updateMany({
      where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');
    await transaction.authIdentity.updateMany({ where: { userId: record.userId, provider: 'EMAIL' }, data: { verifiedAt: now } });
    return { ...record, consumedAt: now };
}
