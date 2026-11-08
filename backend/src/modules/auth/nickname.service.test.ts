import assert from 'node:assert/strict';
import test from 'node:test';
import { isNicknameCollision, withUniqueNickname } from './nickname.service.js';
import { Prisma } from '../../generated/prisma/client.js';
test('nickname collision detection accepts Prisma 7 constraint metadata', () => {
  const error = Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: 'P2002',
    meta: { driverAdapterError: { cause: { constraint: 'User_nickname_key' } } },
  }) as Prisma.PrismaClientKnownRequestError;
  assert.equal(isNicknameCollision(error), true);
});

test('nickname collision detection ignores email unique violations', () => {
  const error = Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: 'P2002',
    meta: { target: ['emailNormalized'] },
  }) as Prisma.PrismaClientKnownRequestError;
  assert.equal(isNicknameCollision(error), false);
});

test('nickname collision detection matches only complete column and constraint identifiers', () => {
  const cases = [
    { meta: { target: 'nickname' }, expected: true },
    { meta: { target: ['nickname'] }, expected: true },
    { meta: { target: 'User_nickname_key' }, expected: true },
    { meta: { driverAdapterError: { cause: { constraint: { fields: ['nickname'] } } } }, expected: true },
    { meta: { driverAdapterError: { cause: { constraint: { index: 'User_nickname_key' } } } }, expected: true },
    { meta: { target: 'not_nickname' }, expected: false },
    { meta: { target: ['not_nickname'] }, expected: false },
    { meta: { target: 'User_nickname_key_extra' }, expected: false },
    { meta: { driverAdapterError: { cause: { constraint: 'Other_nickname_key' } } }, expected: false },
    { meta: { driverAdapterError: { cause: { constraint: { fields: ['not_nickname'] } } } }, expected: false },
  ];
  for (const { meta, expected } of cases) {
    const error = Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
      code: 'P2002',
      meta,
    }) as Prisma.PrismaClientKnownRequestError;
    assert.equal(isNicknameCollision(error), expected, JSON.stringify(meta));
  }
});

function collision(field = 'nickname') {
  return new Prisma.PrismaClientKnownRequestError('synthetic unique violation', { code: 'P2002', clientVersion: '7', meta: { driverAdapterError: { cause: { constraint: { fields: [field] } } } } });
}
const db = { user: { findUnique: async () => null } } as never;
test('race retries after failed insert', async () => {
  let calls = 0;
  const result = await withUniqueNickname(db, 'Mónica Cepeda', async nickname => {
    assert.equal(nickname, '@monica.cepeda');
    if (++calls === 1) throw collision();
    return 'created';
  });
  assert.equal(result, 'created'); assert.equal(calls, 2);
});
test('existing nickname uses next suffix', async () => {
  const taken = { user: { findUnique: async ({where}: {where: {nickname: string}}) => where.nickname === '@ana' ? {id: 'fictional'} : null } } as never;
  assert.equal(await withUniqueNickname(taken, 'Ana', async n => n), '@ana.2');
});
test('email duplicate is propagated without retry', async () => {
  let calls = 0; const error = collision('emailNormalized');
  await assert.rejects(withUniqueNickname(db, 'Ana', async () => { calls++; throw error; }), e => e === error);
  assert.equal(calls, 1);
});
test('retry limit propagates final collision', async () => {
  let calls = 0;
  await assert.rejects(withUniqueNickname(db, 'Ana', async () => { calls++; throw collision(); }));
  assert.equal(calls, 12);
});
