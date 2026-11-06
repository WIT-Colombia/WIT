import assert from 'node:assert/strict';
import test from 'node:test';
import { emailApplicationForOrigin } from './auth.controller.js';

test('identifies an authorized Business origin after URL normalization', () => {
  assert.equal(emailApplicationForOrigin('https://business.xamuko.com/'), 'negocios');
});

test('keeps the authorized Usuario origin compatible', () => {
  assert.equal(emailApplicationForOrigin('https://user.xamuko.com'), 'usuario');
});

test('does not classify an untrusted Business origin as Business', () => {
  assert.equal(emailApplicationForOrigin('https://business.xamuko.com.evil.example'), 'usuario');
});
