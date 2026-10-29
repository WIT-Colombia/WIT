import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

type LockedUser = { id: string; status: string; emailNormalized: string | null; displayName: string };
type LockTransaction = Pick<Prisma.TransactionClient, '$queryRaw'>;
type ResetTransaction = LockTransaction & Pick<Prisma.TransactionClient, 'authToken' | 'authIdentity' | 'session'>;
const invalidToken = () => new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');

/** A locking/current read, not a repeatable-read snapshot created by the token lookup. */
export async function lockActivePasswordResetUser(transaction: LockTransaction, userId: string): Promise<LockedUser> {
  const users = await transaction.$queryRaw<LockedUser[]>`
    SELECT id, status, emailNormalized, displayName FROM User WHERE id = ${userId} FOR UPDATE
  `;
  const user = users[0];
  // Use the generic token error: possession of a token must not reveal account status.
  if (!user || user.status !== 'ACTIVE') throw invalidToken();
  return user;
}

/** Called only inside the password-reset transaction; exceptions must roll back all writes. */
export async function consumePasswordResetToken(transaction: ResetTransaction, token: string, passwordHash: string, clock = () => new Date()) {
  const record = await transaction.authToken.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
  if (!record || record.type !== 'PASSWORD_RESET' || record.consumedAt || record.expiresAt <= clock()) throw invalidToken();
  const user = await lockActivePasswordResetUser(transaction, record.userId);
  const identity = await transaction.authIdentity.findFirst({ where: { userId: user.id, provider: 'EMAIL' }, select: { verifiedAt: true } });
  if (!identity?.verifiedAt) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo electrónico antes de recuperar el acceso.');
  // Recheck time after waiting for the user lock; conditional consumption defeats reuse/races.
  const now = clock();
  const consumed = await transaction.authToken.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
  if (consumed.count !== 1) throw invalidToken();
  const updated = await transaction.authIdentity.updateMany({ where: { userId: user.id, provider: 'EMAIL', verifiedAt: { not: null } }, data: { passwordHash } });
  if (updated.count === 0) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo electrónico antes de recuperar el acceso.');
  await transaction.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
  return user;
}

/** Only optional post-commit work is caught here; password-reset failures stay failures. */
export async function finishPasswordReset<User extends { id: string }, Session>(userId: string, loadUser: () => Promise<User>, createSession: () => Promise<Session>) {
  try {
    const user = await loadUser();
    const session = await createSession();
    return { user, session };
  } catch {
    return { user: { id: userId }, session: null };
  }
}
