import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { consumeVerificationToken } from './verification-confirmation.js';

const token = 'synthetic-verification-token-only-for-tests';
function fixture(overrides = {}) {
  const record = { id: 'token-id', userId: 'user-id', type: 'EMAIL_VERIFICATION', consumedAt: null as Date | null, expiresAt: new Date(Date.now() + 60_000), ...overrides };
  let verifiedAt: Date | null = null;
  let queriedHash = '';
  const transaction = {
    authToken: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => { queriedHash = where.tokenHash; return record; },
      updateMany: async ({ data }: { data: { consumedAt: Date } }) => { if (record.consumedAt) return { count: 0 }; record.consumedAt = data.consumedAt; return { count: 1 }; },
    },
    authIdentity: { updateMany: async ({ data }: { data: { verifiedAt: Date } }) => { verifiedAt = data.verifiedAt; return { count: 1 }; } },
  } as unknown as Parameters<typeof consumeVerificationToken>[0];
  return { transaction, record, verified: () => verifiedAt, hash: () => queriedHash };
}
test('valid confirmation hashes the token, consumes it and verifies the identity in the supplied transaction', async () => {
  const f = fixture();
  await consumeVerificationToken(f.transaction, token);
  assert.equal(f.hash(), createHash('sha256').update(token).digest('hex'));
  assert.ok(f.record.consumedAt);
  assert.equal(f.verified(), f.record.consumedAt);
});
for (const [name, overrides] of Object.entries({ expired: { expiresAt: new Date(0) }, consumed: { consumedAt: new Date() }, wrongPurpose: { type: 'PASSWORD_RESET' } })) {
  test(`rejects ${name} tokens without changing verification state`, async () => {
    const f = fixture(overrides);
    await assert.rejects(consumeVerificationToken(f.transaction, token), { code: 'INVALID_AUTH_TOKEN' });
    assert.equal(f.verified(), null);
  });
}
test('concurrent confirmations allow one token consumption only', async () => {
  const f = fixture();
  const results = await Promise.allSettled([consumeVerificationToken(f.transaction, token), consumeVerificationToken(f.transaction, token)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.ok(f.verified());
});
test('identity update errors propagate so the enclosing transaction can roll back', async () => {
  const f = fixture();
  f.transaction.authIdentity.updateMany = (async () => { throw new Error('synthetic failure'); }) as typeof f.transaction.authIdentity.updateMany;
  await assert.rejects(consumeVerificationToken(f.transaction, token), /synthetic failure/);
});
test('missing tokens cannot verify an identity', async () => {
  const f = fixture();
  f.transaction.authToken.findUnique = (async () => null) as unknown as typeof f.transaction.authToken.findUnique;
  await assert.rejects(consumeVerificationToken(f.transaction, token), { code: 'INVALID_AUTH_TOKEN' });
  assert.equal(f.verified(), null);
});
