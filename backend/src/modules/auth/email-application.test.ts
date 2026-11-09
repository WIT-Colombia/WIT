import assert from 'node:assert/strict';
import test from 'node:test';
import { emailApplicationForOrigin } from './email-application.js';

const trusted = ['https://user.xamuko.com', 'https://business.xamuko.com'];
test('maps a trusted business origin to Business', () => {
  assert.equal(emailApplicationForOrigin('https://business.xamuko.com', 'https://business.xamuko.com', trusted), 'negocios');
});
test('maps Usuario and missing origins to Usuario', () => {
  assert.equal(emailApplicationForOrigin('https://user.xamuko.com', 'https://business.xamuko.com', trusted), 'usuario');
  assert.equal(emailApplicationForOrigin(undefined, 'https://business.xamuko.com', trusted), 'usuario');
});
test('rejects spoofed or untrusted Business origins', () => {
  assert.equal(emailApplicationForOrigin('https://business.xamuko.com.attacker.test', 'https://business.xamuko.com', trusted), 'usuario');
  assert.equal(emailApplicationForOrigin('https://business.xamuko.com', 'https://business.xamuko.com', ['https://user.xamuko.com']), 'usuario');
  assert.equal(emailApplicationForOrigin('https://business.xamuko.com/x', 'https://business.xamuko.com', trusted), 'usuario');
});
