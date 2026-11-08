import assert from 'node:assert/strict';
import test from 'node:test';
import { createAvailableNickname, isNicknameCollision, nicknameBase, nicknameCandidate } from './nickname.service.js';
import { Prisma } from '../../generated/prisma/client.js';

test('nickname base is normalized without sensitive identifiers', () => {
  assert.equal(nicknameBase('Mónica Cepeda'), 'monica.cepeda');
  assert.equal(nicknameBase('   *** '), 'usuario');
});

test('generated nicknames have the supported format and random numeric suffix', () => {
  const first = nicknameCandidate('Mónica Cepeda');
  const second = nicknameCandidate('Mónica Cepeda');
  assert.match(first, /^@monica\.cepeda\.\d{4}$/);
  assert.match(second, /^@monica\.cepeda\.\d{4}$/);
  assert.ok(first.length <= 32);
});

test('available nickname lookup retries after a collision candidate', async () => {
  let lookups = 0;
  const db = {
    user: {
      findUnique: async () => {
        lookups += 1;
        return lookups === 1 ? { id: 'existing-user' } : null;
      },
    },
  } as never;

  const nickname = await createAvailableNickname(db, 'Mónica Cepeda');
  assert.match(nickname, /^@monica\.cepeda\.\d{4}$/);
  assert.equal(lookups, 2);
});

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
