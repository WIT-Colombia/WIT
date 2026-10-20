import { prisma } from '../src/config/prisma.js';
const users = await prisma.user.findMany({ where: { emailNormalized: { startsWith: 'fav_test_' } }, select: { id: true } });
const ids = users.map((u) => u.id);
const businesses = await prisma.business.findMany({ where: { createdById: { in: ids } }, select: { id: true, businessAccountId: true } });
const businessIds = businesses.map((b) => b.id);
const accountIds = [...new Set(businesses.map((b) => b.businessAccountId))];
try {
  if (businessIds.length) await prisma.businessFavorite.deleteMany({ where: { businessId: { in: businessIds } } });
  if (businessIds.length) await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  if (accountIds.length) await prisma.businessAccount.deleteMany({ where: { id: { in: accountIds } } });
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.category.deleteMany({ where: { code: { startsWith: 'fav-test-' } } });
  console.log(`Limpieza aislada completada: ${ids.length} usuarios ficticios.`);
} finally { await prisma.$disconnect(); }
