import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchedule, getCurrentShow } from '../schedule.js';

test('műsorsáv határa a rádió időzónájában, nem a hallgató gépén számolódik', () => {
  // Bukarest október 21-én UTC+3.
  assert.equal(getCurrentShow(new Date('2026-10-21T02:59:00Z')).title, 'Plusz FM');
  assert.equal(getCurrentShow(new Date('2026-10-21T03:00:00Z')).title, 'Reggeli Plusz');
  assert.equal(getCurrentShow(new Date('2026-10-21T08:00:00Z')).title, 'Plusz FM');
});
test('a holnapi műsor péntek éjfél előtt már a szombati program', () => {
  const { date, programs } = getSchedule(1, new Date('2026-10-23T20:59:00Z'));
  assert.equal(date.toISOString().slice(0, 10), '2026-10-24');
  assert.equal(programs.length, 2);
  assert.equal(programs[0].title, 'Hétvégi zenei maraton');
});
test('téli időszámításra váltás után is 6 órakor kezd a reggeli műsor', () => {
  assert.equal(getCurrentShow(new Date('2026-10-26T03:59:00Z')).title, 'Plusz FM');
  assert.equal(getCurrentShow(new Date('2026-10-26T04:00:00Z')).title, 'Reggeli Plusz');
});
