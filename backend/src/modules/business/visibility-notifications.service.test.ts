import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_VISIBILITY_DAYS } from './visibility.service.js';
import {
  VISIBILITY_PERIOD_DAYS, visibilityMilestone, visibilityNoticeContent, noticeChannels,
} from './visibility-notifications.service.js';

const now = new Date('2026-11-16T12:00:00.000Z');
const hoursAhead = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);

test('el periodo definido en backend es de 40 días para toda la plataforma', () => {
  assert.equal(BUSINESS_VISIBILITY_DAYS, 40);
  assert.equal(VISIBILITY_PERIOD_DAYS, BUSINESS_VISIBILITY_DAYS);
});

test('no genera recordatorios antes de 7 días y respeta los umbrales de 7, 5, 3 y 1', () => {
  assert.equal(visibilityMilestone(hoursAhead(8 * 24), now), null);
  assert.equal(visibilityMilestone(hoursAhead(7 * 24), now), 'SEVEN_DAYS');
  assert.equal(visibilityMilestone(hoursAhead(6 * 24), now), 'SEVEN_DAYS');
  assert.equal(visibilityMilestone(hoursAhead(5 * 24), now), 'FIVE_DAYS');
  assert.equal(visibilityMilestone(hoursAhead(3 * 24), now), 'THREE_DAYS');
  assert.equal(visibilityMilestone(hoursAhead(24), now), 'ONE_DAY');
  assert.equal(visibilityMilestone(hoursAhead(0), now), 'EXPIRED');
  assert.equal(visibilityMilestone(hoursAhead(-24), now), 'EXPIRED');
});

test('avisos informativos solo a Business; los últimos y vencimiento a ambas bandejas', () => {
  assert.deepEqual(noticeChannels('SEVEN_DAYS'), ['business']);
  assert.deepEqual(noticeChannels('FIVE_DAYS'), ['business']);
  assert.deepEqual(noticeChannels('THREE_DAYS'), ['business', 'user']);
  assert.deepEqual(noticeChannels('ONE_DAY'), ['business', 'user']);
  assert.deepEqual(noticeChannels('EXPIRED'), ['business', 'user']);
});

test('mensaje de vencimiento indica que no está visible, no que fue eliminado', () => {
  const personal = visibilityNoticeContent('Mi negocio', 'EXPIRED', 'user');
  assert.match(personal.title, /atención/);
  assert.match(personal.message, /ya no está visible/);
  assert.match(personal.message, /Mi negocio/);
  assert.doesNotMatch(personal.message, /eliminad/);
  const upcoming = visibilityNoticeContent('Mi negocio', 'THREE_DAYS', 'user');
  assert.match(upcoming.message, /3 días/);
  assert.match(upcoming.message, /XAMUKO Business/);
});
