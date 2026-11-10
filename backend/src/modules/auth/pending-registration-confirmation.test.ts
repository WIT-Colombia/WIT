import assert from 'node:assert/strict';
import test from 'node:test';
import type { PendingEmailRegistration, Prisma } from '../../generated/prisma/client.js';
import { createUserFromConfirmedPending } from './pending-registration-confirmation.js';

const code = 'XMK-12345678123441238123123456789ABC';
const uuid = '12345678-1234-4123-8123-123456789abc';
const pending: PendingEmailRegistration = {
  id: 'pending-one',
  emailNormalized: 'nuevo@example.test',
  displayName: 'Persona Nueva',
  passwordHash: '$argon2id$test-hash-not-a-password',
  referralCode: code,
  application: 'usuario',
  tokenHash: 'hashed-only',
  expiresAt: new Date(Date.now() + 900_000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fixture(options: { expired?: boolean; invalidBusiness?: boolean; referralCode?: string | null } = {}) {
  const row = { ...pending, referralCode: options.referralCode === undefined ? code : options.referralCode };
  let claimed = false;
  let userCreated = 0;
  let referralCreated = 0;
  let referralCount = 0;
  let verifiedAt: Date | null = null;

  const tx = {
    pendingEmailRegistration: {
      deleteMany: async ({ where }: any) => {
        assert.equal(where.id, row.id);
        assert.equal(where.tokenHash, row.tokenHash);
        if (claimed || options.expired) return { count: 0 };
        claimed = true;
        return { count: 1 };
      },
    },
    user: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        assert.equal(data.displayName, row.displayName);
        assert.equal(data.emailNormalized, row.emailNormalized);
        assert.equal(data.authIdentities.create.passwordHash, row.passwordHash);
        assert.equal(data.authIdentities.create.provider, 'EMAIL');
        assert.equal(data.authIdentities.create.providerSubject, row.emailNormalized);
        assert.ok(data.authIdentities.create.verifiedAt instanceof Date);
        verifiedAt = data.authIdentities.create.verifiedAt;
        userCreated += 1;
        return { id: 'new-user' };
      },
    },
    business: {
      findFirst: async ({ where }: any) => {
        assert.equal(where.publicId, uuid);
        assert.equal(where.publicationStatus, 'PUBLISHED');
        return options.invalidBusiness ? null : { id: 'biz-id', createdById: 'owner' };
      },
    },
    businessReferral: {
      createMany: async ({ data, skipDuplicates }: any) => {
        assert.equal(skipDuplicates, true);
        assert.equal(data.businessId, 'biz-id');
        assert.equal(data.referredUserId, 'new-user');
        referralCreated += 1;
        return { count: 1 };
      },
    },
    businessReferralCounter: {
      upsert: async ({ where, create, update }: any) => {
        assert.equal(where.businessId, 'biz-id');
        assert.equal(create.validReferralCount, 1);
        assert.equal(update.validReferralCount.increment, 1);
        referralCount += 1;
        return { validReferralCount: referralCount };
      },
    },
  } as unknown as Prisma.TransactionClient;
  return {
    tx, pending: row,
    state: () => ({ claimed, userCreated, referralCreated, referralCount, verified: verifiedAt !== null }),
  };
}

test('no account or referral exists before email confirmation; both are created afterward', async () => {
  const f = fixture();
  assert.deepEqual(f.state(), { claimed: false, userCreated: 0, referralCreated: 0, referralCount: 0, verified: false });
  assert.equal(await createUserFromConfirmedPending(f.tx, f.pending, f.pending.tokenHash), 'new-user');
  assert.deepEqual(f.state(), { claimed: true, userCreated: 1, referralCreated: 1, referralCount: 1, verified: true });
});

test('expired or already consumed verification tokens create neither user nor referral', async () => {
  const expired = fixture({ expired: true });
  await assert.rejects(createUserFromConfirmedPending(expired.tx, expired.pending, expired.pending.tokenHash), { code: 'INVALID_AUTH_TOKEN' });
  assert.equal(expired.state().userCreated, 0);
  assert.equal(expired.state().referralCount, 0);

  const duplicated = fixture();
  await createUserFromConfirmedPending(duplicated.tx, duplicated.pending, duplicated.pending.tokenHash);
  await assert.rejects(createUserFromConfirmedPending(duplicated.tx, duplicated.pending, duplicated.pending.tokenHash), { code: 'INVALID_AUTH_TOKEN' });
  assert.equal(duplicated.state().referralCount, 1);
});

test('registration without a referral creates the verified account and no business credit', async () => {
  const f = fixture({ referralCode: null });
  await createUserFromConfirmedPending(f.tx, f.pending, f.pending.tokenHash);
  assert.equal(f.state().userCreated, 1);
  assert.equal(f.state().referralCreated, 0);
  assert.equal(f.state().referralCount, 0);
});

test('a business unavailable between email send and confirmation does not block the real user', async () => {
  const f = fixture({ invalidBusiness: true });
  await createUserFromConfirmedPending(f.tx, f.pending, f.pending.tokenHash);
  assert.equal(f.state().userCreated, 1);
  assert.equal(f.state().referralCount, 0);
});
