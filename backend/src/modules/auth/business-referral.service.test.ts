import assert from 'node:assert/strict';
import test from 'node:test';
import { attributeNewUserReferral, publicIdForReferralCode, referralCodeForBusiness } from './business-referral.service.js';
import { registerSchema } from './auth.schemas.js';

const publicId = '12345678-1234-4123-8123-123456789abc';
const code = 'XMK-12345678123441238123123456789ABC';
const userId = 'new-user-id';

function fixture(options: { published?: boolean; existing?: boolean; owner?: boolean } = {}) {
  let recorded = false;
  let count = 0;
  let lookup = 0;
  const tx = {
    business: { findFirst: async ({ where }: any) => {
      lookup += 1;
      assert.equal(where.publicId, publicId);
      assert.equal(where.lifecycleStatus, 'ACTIVE');
      assert.equal(where.publicationStatus, 'PUBLISHED');
      assert.equal(where.visibilityStatus, 'VISIBLE');
      assert.equal(where.deletionStatus, 'NONE');
      return options.published === false ? null : { id: 'biz-id', createdById: options.owner ? userId : 'owner-user' };
    } },
    businessReferral: { createMany: async ({ data, skipDuplicates }: any) => {
      assert.equal(skipDuplicates, true);
      assert.equal(data.businessId, 'biz-id');
      assert.equal(data.referredUserId, userId);
      if (recorded || options.existing) return { count: 0 };
      recorded = true;
      return { count: 1 };
    } },
    businessReferralCounter: { upsert: async ({ where, create, update }: any) => {
      assert.equal(where.businessId, 'biz-id');
      assert.equal(create.validReferralCount, 1);
      assert.equal(update.validReferralCount.increment, 1);
      count += 1;
      return { validReferralCount: count };
    } },
  } as unknown as Parameters<typeof attributeNewUserReferral>[0];
  return { tx, count: () => count, lookups: () => lookup };
}

test('each business gets a lossless, unique and stable code from its public UUID', () => {
  assert.equal(referralCodeForBusiness(publicId), code);
  assert.equal(referralCodeForBusiness(publicId.toUpperCase()), code);
  assert.equal(publicIdForReferralCode(code.toLowerCase()), publicId);
  assert.notEqual(referralCodeForBusiness('abcdefab-1234-4123-8123-123456789abc'), code);
  assert.equal(referralCodeForBusiness('demo-business'), null);
  assert.equal(publicIdForReferralCode('XMK-123'), null);
});

test('registration schema accepts optional referral and rejects unexpected fields', () => {
  const data = { name: 'Cliente Nuevo', email: 'nuevo@example.test', password: 'seguro123' };
  assert.equal(registerSchema.safeParse(data).success, true);
  assert.equal(registerSchema.safeParse({ ...data, referralCode: code }).success, true);
  assert.equal(registerSchema.safeParse({ ...data, referralCode: 'x'.repeat(41) }).success, false);
  assert.equal(registerSchema.safeParse({ ...data, businessId: publicId }).success, false);
});

test('a new referred user increments the business count only once', async () => {
  const f = fixture();
  await attributeNewUserReferral(f.tx, userId, code);
  await attributeNewUserReferral(f.tx, userId, code);
  assert.equal(f.count(), 1);
  assert.equal(f.lookups(), 2);
});

test('missing code has no referral side effects, ordinary registration remains unchanged', async () => {
  const f = fixture();
  await attributeNewUserReferral(f.tx, userId);
  await attributeNewUserReferral(f.tx, userId, '   ');
  assert.equal(f.count(), 0);
  assert.equal(f.lookups(), 0);
});

test('unrecognized, unpublished and self-referral codes are rejected', async () => {
  await assert.rejects(attributeNewUserReferral(fixture().tx, userId, 'BAD-CODE'), { code: 'INVALID_REFERRAL_CODE' });
  await assert.rejects(attributeNewUserReferral(fixture({ published: false }).tx, userId, code), { code: 'INVALID_REFERRAL_CODE' });
  await assert.rejects(attributeNewUserReferral(fixture({ owner: true }).tx, userId, code), { code: 'REFERRAL_SELF_NOT_ALLOWED' });
});

test('a previously attributed account never increments a second time', async () => {
  const f = fixture({ existing: true });
  await attributeNewUserReferral(f.tx, userId, code);
  assert.equal(f.count(), 0);
});
