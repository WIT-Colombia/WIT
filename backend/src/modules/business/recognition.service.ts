import type { PrismaClient, Prisma } from '../../generated/prisma/client.js';
type Db = PrismaClient | Prisma.TransactionClient;

export type RecognitionLevel = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type SubscriptionCandidate = { plan: string; status: string; startsAt: Date; expiresAt: Date | null; specialActivation: boolean; revokedAt: Date | null };

export function isSubscriptionEffective(subscription: SubscriptionCandidate, now = new Date()) {
  return subscription.plan === 'PRO' && subscription.status === 'ACTIVE' && subscription.startsAt <= now && subscription.revokedAt === null && (subscription.expiresAt === null ? subscription.specialActivation : subscription.expiresAt > now);
}

const levels: ReadonlyArray<{ level: RecognitionLevel; minimum: number; productLimit: number; serviceLimit: number }> = [
  { level: 'BASIC', minimum: 0, productLimit: 20, serviceLimit: 20 },
  { level: 'BRONZE', minimum: 20, productLimit: 25, serviceLimit: 25 },
  { level: 'SILVER', minimum: 50, productLimit: 30, serviceLimit: 30 },
  { level: 'GOLD', minimum: 100, productLimit: 40, serviceLimit: 40 },
  { level: 'PLATINUM', minimum: 250, productLimit: 50, serviceLimit: 50 },
  { level: 'DIAMOND', minimum: 500, productLimit: 75, serviceLimit: 75 },
];

export function recognitionFor(validReferralCount: number) {
  return [...levels].reverse().find(item => validReferralCount >= item.minimum) ?? levels[0];
}

export async function catalogLimits(db: Db, businessId: string) {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { referralCounter: { select: { validReferralCount: true } } } });
  const level = recognitionFor(business?.referralCounter?.validReferralCount ?? 0);
  const now = new Date();
  const proRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM BusinessSubscription
    WHERE businessId = ${businessId} AND plan = 'PRO' AND status = 'ACTIVE'
      AND startsAt <= ${now} AND revokedAt IS NULL
      AND (expiresAt > ${now} OR (expiresAt IS NULL AND specialActivation = true))
    ORDER BY startsAt DESC, createdAt DESC LIMIT 1
  `;
  const proActive = proRows.length > 0;
  const [products, services] = await Promise.all([
    db.businessOffer.count({ where: { businessId, kind: 'PRODUCT', deletedAt: null } }),
    db.businessOffer.count({ where: { businessId, kind: 'SERVICE', deletedAt: null } }),
  ]);
  return {
    level: level.level,
    plan: proActive ? 'PRO' : 'BASIC',
    products: { used: products, limit: proActive ? null : level.productLimit, available: proActive ? null : Math.max(0, level.productLimit - products), unlimited: proActive },
    services: { used: services, limit: proActive ? null : level.serviceLimit, available: proActive ? null : Math.max(0, level.serviceLimit - services), unlimited: proActive },
  };
}

export function limitForKind(kind: 'PRODUCT' | 'SERVICE', limits: Awaited<ReturnType<typeof catalogLimits>>) {
  return kind === 'PRODUCT' ? limits.products : limits.services;
}
