import test from 'node:test';
import assert from 'node:assert/strict';
process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'paid-plan-switch-test-secret-with-32-characters';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/paid_plans_test';

const { availabilityFromRows, paidPlanKey, paidPlanUpdate, isPaidPlanEnabled, setPaidPlanAvailability } = await import('./paid-plans.service.js');

test('ambos planes inician apagados cuando aún no se han configurado', () => {
  assert.deepEqual(availabilityFromRows([]), { businessPro: false, xamukoPlus: false });
  assert.deepEqual(availabilityFromRows([{ key: 'unknown', enabled: true }]), { businessPro: false, xamukoPlus: false });
});

test('entrada estricta: estado booleano, motivo suficiente y confirmación expresa', () => {
  assert.equal(paidPlanKey.safeParse('unknown').success, false);
  assert.equal(paidPlanUpdate.safeParse({ enabled: true }).success, false);
  assert.equal(paidPlanUpdate.safeParse({ enabled: true, reason: 'Muy corto', confirmation: 'CONFIRMAR' }).success, false);
  assert.equal(paidPlanUpdate.safeParse({ enabled: true, reason: 'Cambio autorizado para prueba', confirmation: 'CONFIRMAR' }).success, true);
  assert.equal(paidPlanUpdate.safeParse({ enabled: 'false', reason: 'Cambio autorizado para prueba', confirmation: 'CONFIRMAR' }).success, false);
});

test('solo el superadministrador puede modificar el interruptor', async () => {
  await assert.rejects(
    setPaidPlanAvailability({ role: 'ADMIN', userId: 'admin-test' }, 'businessPro', true, 'Cambio no autorizado'),
    { statusCode: 403 },
  );
});

test('consulta global del plan no depende de una suscripción de un negocio', async () => {
  const db = { paidPlanAvailability: { findUnique: async ({ where }: { where: { key: string } }) =>
    where.key === 'businessPro' ? { enabled: true } : { enabled: false },
  } } as unknown as NonNullable<Parameters<typeof isPaidPlanEnabled>[1]>;
  assert.equal(await isPaidPlanEnabled('businessPro', db), true);
  assert.equal(await isPaidPlanEnabled('xamukoPlus', db), false);
});

test('los cambios se auditan una sola vez con motivo, actor y estado anterior', async () => {
  const rows = new Map<string, boolean>();
  const audit: Array<Record<string, unknown>> = [];
  const tx = {
    paidPlanAvailability: {
      findUnique: async ({ where }: { where: { key: string } }) => rows.has(where.key)
        ? { key: where.key, enabled: rows.get(where.key) } : null,
      findMany: async () => [...rows].map(([key, enabled]) => ({ key, enabled })),
      upsert: async ({ where, create, update }: { where: { key: string }; create: { enabled: boolean }; update: { enabled: boolean } }) => {
        rows.set(where.key, rows.has(where.key) ? update.enabled : create.enabled);
      },
    },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { audit.push(data); } },
  };
  const db = { $transaction: async (callback: (arg: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as NonNullable<Parameters<typeof setPaidPlanAvailability>[4]>;
  const admin = { role: 'SUPER_ADMIN', userId: 'admin-test' };
  const reason = 'Cambio de control global autorizado';
  assert.deepEqual(await setPaidPlanAvailability(admin, 'businessPro', true, reason, db),
    { businessPro: true, xamukoPlus: false });
  assert.deepEqual(await setPaidPlanAvailability(admin, 'businessPro', true, reason, db),
    { businessPro: true, xamukoPlus: false });
  await setPaidPlanAvailability(admin, 'xamukoPlus', true, reason, db);
  await setPaidPlanAvailability(admin, 'businessPro', false, reason, db);
  assert.deepEqual(availabilityFromRows([...rows].map(([key, enabled]) => ({ key, enabled }))),
    { businessPro: false, xamukoPlus: true });
  assert.equal(audit.length, 3);
  assert.deepEqual(audit[2].previousState, { key: 'businessPro', enabled: true });
  assert.deepEqual(audit[2].newState, { key: 'businessPro', enabled: false });
  assert.equal(audit[2].actorUserId, 'admin-test');
  assert.equal(audit[2].reason, reason);
});
