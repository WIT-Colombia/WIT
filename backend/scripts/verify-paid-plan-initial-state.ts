/** Integration-only assertion for a freshly migrated, isolated test database.
 * Never run this against production: Admin is allowed to enable paid plans later.
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/config/prisma.js';

try {
  const rows = await prisma.paidPlanAvailability.findMany({
    where: { key: { in: ['businessPro', 'xamukoPlus'] } },
    select: { key: true, enabled: true },
  });
  const availability = new Map(rows.map(row => [row.key, row.enabled]));
  assert.equal(availability.size, 2, 'Both paid plan availability rows must exist after migration');
  assert.equal(availability.get('businessPro'), true,
    'Business PRO stays enabled after the one-time Plus shutdown migration');
  assert.equal(availability.get('xamukoPlus'), false,
    'Xamuko Plus must be disabled until SUPER_ADMIN activates it through Admin');
  console.log('Fresh migration verified: Business PRO enabled; Xamuko Plus disabled.');
} finally {
  await prisma.$disconnect();
}
