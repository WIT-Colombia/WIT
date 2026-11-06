import assert from 'node:assert/strict';
import test from 'node:test';
import { createAvailableNickname, nicknameBase, nicknameCandidate } from './nickname.service.js';

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
