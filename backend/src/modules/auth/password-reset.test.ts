import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { consumePasswordResetToken, finishPasswordReset, lockActivePasswordResetUser } from './password-reset.js';

const token = 'synthetic-password-reset-token-only-for-tests';
function fixture(options: { status?: string; expired?: boolean; consumed?: boolean; verified?: boolean; type?: string; missing?: boolean; failIdentity?: boolean; failSessions?: boolean; loseIdentity?: boolean } = {}) {
  const initial = {
    user: { id: 'user-1', status: options.status ?? 'ACTIVE', emailNormalized: 'fixture@example.test', displayName: 'Fixture' },
    token: { id: 'token-1', userId: 'user-1', type: options.type ?? 'PASSWORD_RESET', consumedAt: options.consumed ? new Date(0) : null as Date | null, expiresAt: new Date(Date.now() + (options.expired ? -60_000 : 60_000)) },
    hash: 'old-password-hash', revoked: false,
  };
  let state = structuredClone(initial);
  let tail: Promise<void> = Promise.resolve();
  let beforeLock = () => {};
  let queriedHash = '';
  let lockCount = 0;
  async function run<T>(work: (transaction: Parameters<typeof consumePasswordResetToken>[0]) => Promise<T>): Promise<T> {
    let working: typeof state | undefined;
    let unlock: (() => void) | undefined;
    const transaction = {
      $queryRaw: async (strings: TemplateStringsArray, userId: string) => {
        assert.match(strings.join('?'), /FROM User WHERE id = \? FOR UPDATE/);
        assert.equal(userId, state.user.id);
        const previous = tail;
        tail = new Promise<void>(resolve => { unlock = resolve; });
        await previous;
        lockCount += 1; beforeLock();
        working = structuredClone(state);
        return [working.user];
      },
      authToken: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) => { queriedHash = where.tokenHash; return options.missing ? null : structuredClone(state.token); },
        updateMany: async ({ where, data }: { where: { id: string; consumedAt: null; expiresAt: { gt: Date } }; data: { consumedAt: Date } }) => {
          assert(working); assert.equal(where.id, working.token.id); assert.equal(where.consumedAt, null);
          if (working.token.consumedAt || working.token.expiresAt <= where.expiresAt.gt) return { count: 0 };
          working.token.consumedAt = data.consumedAt; return { count: 1 };
        },
      },
      authIdentity: {
        findFirst: async () => options.verified === false ? null : { verifiedAt: new Date(0) },
        updateMany: async ({ where, data }: { where: { provider: string; verifiedAt: { not: null } }; data: { passwordHash: string } }) => {
          assert(working); assert.equal(where.provider, 'EMAIL'); assert.equal(where.verifiedAt.not, null);
          if (options.failIdentity) throw new Error('identity write failed');
          if (options.loseIdentity) return { count: 0 };
          working.hash = data.passwordHash; return { count: 1 };
        },
      },
      session: { updateMany: async () => { assert(working); if (options.failSessions) throw new Error('revocation failed'); working.revoked = true; return { count: 1 }; } },
    } as unknown as Parameters<typeof consumePasswordResetToken>[0];
    try { const result = await work(transaction); if (working) state = working; return result; }
    finally { unlock?.(); }
  }
  return { run, state: () => state, initial, queriedHash: () => queriedHash, locks: () => lockCount, beforeLock: (fn: () => void) => { beforeLock = fn; } };
}
const reset = (f: ReturnType<typeof fixture>, clock?: () => Date) => f.run(tx => consumePasswordResetToken(tx, token, 'new-password-hash', clock));

test('active verified account resets atomically, hashes the token and revokes prior sessions', async () => {
  const f = fixture();
  const user = await reset(f);
  assert.equal(user.id, 'user-1'); assert.equal(f.locks(), 1);
  assert.equal(f.queriedHash(), createHash('sha256').update(token).digest('hex'));
  assert.equal(f.state().hash, 'new-password-hash'); assert(f.state().token.consumedAt); assert(f.state().revoked);
});
for (const status of ['SUSPENDED', 'DELETED']) test(`${status} account cannot consume a token or change credentials`, async () => {
  const f = fixture({ status });
  await assert.rejects(reset(f), { code: 'INVALID_AUTH_TOKEN' });
  assert.deepEqual(f.state(), f.initial);
});
test('suspension between token lookup and locking read is observed before any writes', async () => {
  const f = fixture(); f.beforeLock(() => { f.state().user.status = 'SUSPENDED'; });
  await assert.rejects(reset(f), { code: 'INVALID_AUTH_TOKEN' });
  assert.equal(f.state().hash, 'old-password-hash'); assert.equal(f.state().token.consumedAt, null); assert.equal(f.state().revoked, false);
});
for (const [name, options] of Object.entries({ expired: { expired: true }, reused: { consumed: true }, wrongPurpose: { type: 'EMAIL_VERIFICATION' }, missing: { missing: true }, unverified: { verified: false } })) test(`rejects ${name} without committing changes`, async () => {
  const f = fixture(options);
  await assert.rejects(reset(f), { code: name === 'unverified' ? 'EMAIL_NOT_VERIFIED' : 'INVALID_AUTH_TOKEN' });
  assert.deepEqual(f.state(), f.initial);
});
test('token expiring while waiting for user lock is rejected by conditional consumption', async () => {
  const f = fixture(); let calls = 0;
  await assert.rejects(reset(f, () => new Date(++calls === 1 ? Date.now() : Date.now() + 120_000)), { code: 'INVALID_AUTH_TOKEN' });
  assert.deepEqual(f.state(), f.initial);
});
test('a token is reusable neither sequentially nor by competing transactions', async () => {
  const f = fixture(); const results = await Promise.allSettled([reset(f), reset(f)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  await assert.rejects(reset(f), { code: 'INVALID_AUTH_TOKEN' });
});
for (const options of [{ failIdentity: true }, { failSessions: true }, { loseIdentity: true }]) test(`write failure rolls back token and credentials: ${JSON.stringify(options)}`, async () => {
  const f = fixture(options); await assert.rejects(reset(f)); assert.deepEqual(f.state(), f.initial);
});
test('missing user is rejected by the locking eligibility check', async () => {
  const tx = { $queryRaw: async () => [] } as unknown as Parameters<typeof lockActivePasswordResetUser>[0];
  await assert.rejects(lockActivePasswordResetUser(tx, 'missing'), { code: 'INVALID_AUTH_TOKEN' });
});
test('optional completion preserves active-account automatic login', async () => {
  const result = await finishPasswordReset('u', async () => ({ id: 'u', displayName: 'Fixture' }), async () => ({ accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' }));
  assert.equal(result.user.id, 'u'); assert.equal(result.session?.accessToken, 'synthetic-access');
});
test('profile-read failure after commit returns completed reset without creating a session', async () => {
  let attemptedSession = false;
  const result = await finishPasswordReset('u', async () => { throw new Error('profile read failed'); }, async () => { attemptedSession = true; return {}; });
  assert.deepEqual(result, { user: { id: 'u' }, session: null }); assert.equal(attemptedSession, false);
});
test('suspension after reset but before optional session issuance returns completion without access', async () => {
  const f = fixture(); const user = await reset(f); f.state().user.status = 'SUSPENDED';
  let issued = false;
  const result = await finishPasswordReset(user.id, async () => ({ id: user.id }), () => f.run(async tx => { await lockActivePasswordResetUser(tx, user.id); issued = true; return { accessToken: 'not-to-be-issued' }; }));
  assert.deepEqual(result, { user: { id: user.id }, session: null }); assert.equal(issued, false);
});
test('optional session failure cannot turn an already completed reset into an error', async () => {
  const result = await finishPasswordReset('u', async () => ({ id: 'u', email: 'private@example.test' }), async () => { throw new Error('session failure'); });
  assert.deepEqual(result, { user: { id: 'u' }, session: null });
});
