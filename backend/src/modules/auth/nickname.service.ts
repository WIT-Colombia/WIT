import { Prisma } from '../../generated/prisma/client.js';

type UserLookup = Pick<Prisma.TransactionClient, 'user'>;

async function createUniqueNickname(db: UserLookup, displayName: string): Promise<string> {
  const base = displayName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'usuario';
  let candidate = `@${base}`;
  let suffix = 2;
  while (await db.user.findUnique({ where: { nickname: candidate }, select: { id: true } })) {
    const suffixText = `.${suffix}`;
    candidate = `@${base.slice(0, 32 - suffixText.length - 1)}${suffixText}`;
    suffix += 1;
  }
  return candidate;
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

export async function withUniqueNickname<T>(db: UserLookup, displayName: string, create: (nickname: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const nickname = await createUniqueNickname(db, displayName);
    try { return await create(nickname); }
    catch (error) {
      if (!isNicknameCollision(error) || attempt >= 11) throw error;
    }
  }
}
