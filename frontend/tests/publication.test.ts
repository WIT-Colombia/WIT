import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingDestinations } from '../apps/landing/src/destinations.ts';

test('development keeps local routes', () => {
  assert.deepEqual(landingDestinations(true), {
    businessLogin: 'http://127.0.0.1:5174/login', businessRegister: 'http://127.0.0.1:5174/registro',
    userLogin: 'http://127.0.0.1:5173/register?mode=login', userRegister: 'http://127.0.0.1:5173/register', explore: 'http://127.0.0.1:5173/home',
  });
});
test('production routes use independent HTTPS origins', () => {
  const links = landingDestinations(false);
  assert.equal(links.businessRegister, 'https://business.xamuko.com/registro');
  assert.equal(links.userLogin, 'https://app.xamuko.com/register?mode=login');
  for (const link of Object.values(links)) assert.equal(new URL(link).protocol, 'https:');
});
test('configured origins preserve routes and normalize trailing slash', () => {
  const links = landingDestinations(false, { user: 'https://users.example/', business: 'https://shops.example' });
  assert.equal(links.explore, 'https://users.example/home');
  assert.equal(links.businessLogin, 'https://shops.example/login');
});
test('reject insecure production and malformed destinations', () => {
  for (const user of ['http://example.com', 'javascript:alert(1)', 'https://u:p@example.com', 'https://example.com/path', 'https://example.com?q=1']) {
    assert.throws(() => landingDestinations(false, { user }));
  }
});
