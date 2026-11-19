import assert from 'node:assert/strict';
import test from 'node:test';

process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'xamuko-plus-purchase-test-secret-32-chars';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/plus_purchase_test';

const { PLUS_MONTHLY_COP, requestPlusPurchase, adminListPlusRequests, adminClosePlusRequest } =
  await import('./user-plus-purchase.service.js');

test('Plus monthly price is exactly COP 4,900 on the server', () => {
  assert.equal(PLUS_MONTHLY_COP, 4_900);
});

test('User purchase requests reject the wrong amount and missing price consent before contacting DB', async () => {
  await assert.rejects(
    requestPlusPurchase('user-id', { acceptedAmountCop: 1, acceptedTerms: true }),
    { statusCode: 400 },
  );
  await assert.rejects(
    requestPlusPurchase('user-id', { acceptedAmountCop: PLUS_MONTHLY_COP, acceptedTerms: false }),
    { statusCode: 400 },
  );
});

test('Ordinary administrators cannot inspect or close purchase requests', async () => {
  await assert.rejects(adminListPlusRequests({ role: 'ADMIN' }), { statusCode: 403 });
  await assert.rejects(adminClosePlusRequest({ userId: 'user-a', role: 'ADMIN' }, 'request-a', 'Manual review approved'),
    { statusCode: 403 });
});

test('Closing a request requires an administrative justification', async () => {
  await assert.rejects(adminClosePlusRequest({ userId: 'user-a', role: 'SUPER_ADMIN' }, 'request-a', 'short'),
    { statusCode: 400 });
});
