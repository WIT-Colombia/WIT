import test from 'node:test';
import assert from 'node:assert/strict';
process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'paid-plans-test-secret-at-least-32-characters';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/paid_plans_test';
const { availabilityFromRows, paidPlanKey, paidPlanUpdate, setPaidPlanAvailability, getPaidPlanAvailability } = await import('./paid-plans.service.js');
const { prisma } = await import('../../config/prisma.js');

test('ambos planes comienzan desactivados, incluso sin registros', () => {
  assert.deepEqual(availabilityFromRows([]), { businessPro: false, xamukoPlus: false });
  assert.deepEqual(availabilityFromRows([{ key: 'unknown', enabled: true }]), { businessPro: false, xamukoPlus: false });
});
test('validación estricta: solo los dos planes y booleanos reales', () => {
  assert.equal(paidPlanKey.safeParse('anything').success, false);
  for (const enabled of ['false', 1, null, undefined]) assert.equal(paidPlanUpdate.safeParse({ enabled }).success, false);
  assert.equal(paidPlanUpdate.safeParse({ enabled: true, role: 'SUPER_ADMIN' }).success, false);
  assert.equal(paidPlanUpdate.safeParse({ enabled: false }).success, true);
});
test('un administrador ordinario no puede cambiar disponibilidad', async () => {
  await assert.rejects(setPaidPlanAvailability({ role: 'ADMIN', userId: 'test' }, 'businessPro', true), { statusCode: 403 });
});
test('cambios independientes, persistentes y auditados en la misma transacción', async t => {
  const rows = new Map<string, boolean>();
  const audit: any[] = [];
  const tx = {
    paidPlanAvailability: {
      findUnique: async ({ where }: any) => rows.has(where.key) ? { key: where.key, enabled: rows.get(where.key) } : null,
      findMany: async () => [...rows].map(([key, enabled]) => ({ key, enabled })),
      upsert: async ({ where, update }: any) => { rows.set(where.key, update.enabled); },
    },
    auditLog: { create: async ({ data }: any) => { audit.push(data); } },
  };
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = (async (callback: any) => callback(tx)) as any;
  t.after(() => { prisma.$transaction = originalTransaction; });
  const originalFindMany = prisma.paidPlanAvailability.findMany;
  prisma.paidPlanAvailability.findMany = tx.paidPlanAvailability.findMany as any;
  t.after(() => { prisma.paidPlanAvailability.findMany = originalFindMany; });
  const admin = { role: 'SUPER_ADMIN', userId: 'admin-test' };
  assert.deepEqual(await setPaidPlanAvailability(admin, 'businessPro', true), { businessPro: true, xamukoPlus: false });
  await setPaidPlanAvailability(admin, 'xamukoPlus', true);
  await setPaidPlanAvailability(admin, 'businessPro', false);
  assert.deepEqual(await getPaidPlanAvailability(), { businessPro: false, xamukoPlus: true });
  assert.equal(audit.length, 3);
  assert.deepEqual(audit[2].previousState, { key: 'businessPro', enabled: true });
  assert.deepEqual(audit[2].newState, { key: 'businessPro', enabled: false });
  assert.equal(audit[2].actorUserId, 'admin-test');
});
