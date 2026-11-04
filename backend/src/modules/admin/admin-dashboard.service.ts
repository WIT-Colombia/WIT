import { prisma } from '../../config/prisma.js';

// Read-only statistics from persisted records. A subscription is not a sale:
// this service deliberately does not invent revenue or Usuario Plus billing.
export async function getAdminDashboardStats(now = new Date()) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    return { from, to, month: from.toISOString().slice(0, 7) };
  });
  const liveBusiness = { deletionStatus: { not: 'DELETED' as const } };
  const activePro = {
    status: 'ACTIVE' as const,
    revokedAt: null,
    startsAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    users, usersActive, usersSuspended,
    businesses, businessesVerified, businessesPublished, businessesUnpublished, businessesInReview,
    reviewsPublished, businessProActive, businessProPending, businessProExpiring,
    ...monthlyCounts
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.business.count({ where: liveBusiness }),
    prisma.business.count({ where: { ...liveBusiness, verificationStatus: 'APPROVED' } }),
    prisma.business.count({ where: { ...liveBusiness, publicationStatus: 'PUBLISHED' } }),
    prisma.business.count({ where: { ...liveBusiness, publicationStatus: 'UNPUBLISHED' } }),
    prisma.business.count({ where: { ...liveBusiness, publicationStatus: 'REVIEW' } }),
    prisma.businessReview.count({ where: { status: 'PUBLISHED' } }),
    prisma.business.count({ where: { ...liveBusiness, subscriptions: { some: activePro } } }),
    prisma.business.count({ where: { ...liveBusiness, subscriptions: { some: { status: 'PENDING' } } } }),
    prisma.business.count({ where: {
      ...liveBusiness, subscriptions: { some: {
        ...activePro, expiresAt: { gt: now, lte: soon },
      } },
    } }),
    ...months.flatMap(({ from, to }) => [
      prisma.user.count({ where: { status: { not: 'DELETED' }, createdAt: { gte: from, lt: to } } }),
      prisma.business.count({ where: { ...liveBusiness, createdAt: { gte: from, lt: to } } }),
      prisma.businessReview.count({ where: { status: 'PUBLISHED', createdAt: { gte: from, lt: to } } }),
    ]),
  ]);

  return {
    generatedAt: now.toISOString(),
    totals: { users, businesses, businessesVerified, reviewsPublished, businessProActive },
    businessStatuses: { published: businessesPublished, unpublished: businessesUnpublished, review: businessesInReview },
    userStatuses: { active: usersActive, suspended: usersSuspended },
    subscriptions: { proActive: businessProActive, proPending: businessProPending, proExpiring30Days: businessProExpiring, plus: null },
    monthly: months.map(({ month }, index) => ({
      month,
      users: monthlyCounts[index * 3] ?? 0,
      businesses: monthlyCounts[index * 3 + 1] ?? 0,
      reviews: monthlyCounts[index * 3 + 2] ?? 0,
    })),
    revenue: null,
  };
}
