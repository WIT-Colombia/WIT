import assert from 'node:assert/strict';
import test from 'node:test';
import { changePasswordSchema, profileUpdateSchema } from './auth.schemas.js';

test('profile updates accept only the display name', () => {
  assert.deepEqual(profileUpdateSchema.parse({ name: ' Monica ' }), { name: 'Monica' });
  assert.equal(profileUpdateSchema.safeParse({ name: 'Monica', phoneNumber: '3214411013' }).success, false);
});

test('password change validates both current and new password fields', () => {
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: 'new-password' }).success, true);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'short', newPassword: 'new-password' }).success, false);
});
