import { randomInt } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';

const NICKNAME_SUFFIX_MIN = 1000;
const NICKNAME_SUFFIX_MAX = 10000;

type UserLookup = Pick<Prisma.TransactionClient, 'user'>;

/** Converts a display name into the public, non-sensitive part of a nickname. */
export function nicknameBase(displayName: string): string {
  return displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 23) || 'usuario';
}

export function nicknameCandidate(displayName: string): string {
  const suffix = randomInt(NICKNAME_SUFFIX_MIN, NICKNAME_SUFFIX_MAX).toString();
  return `@${nicknameBase(displayName)}.${suffix}`;
}

export async function createAvailableNickname(db: UserLookup, displayName: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = nicknameCandidate(displayName);
    const existing = await db.user.findUnique({ where: { nickname: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new Error('No se pudo generar un nickname disponible.');
}

function metadataMentionsNickname(value: unknown, key = ''): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).toLowerCase();
    return /target|constraint|index|column|field|nickname/.test(key.toLowerCase()) && (text === 'nickname' || text === 'user_nickname_key');
  }
  if (Array.isArray(value)) return value.some((item) => metadataMentionsNickname(item, key));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([childKey, childValue]) => metadataMentionsNickname(childValue, childKey));
  }
  return false;
}

export function isNicknameCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  return metadataMentionsNickname(error.meta);
}
