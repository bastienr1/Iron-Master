/**
 * The app clock is Singapore (UTC+8) whatever zone the device is in. Run under
 * TZ=UTC, TZ=America/New_York and TZ=Asia/Singapore; all must pass.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { hourNow, shortDate, timeHm, todayIso } from './dates.ts'

test('todayIso uses the Singapore date', () => {
  // 23:23 UTC on 1 Nov is 07:23 on 2 Nov in Singapore.
  assert.equal(todayIso(new Date('2026-11-01T23:23:00Z')), '2026-11-02')
  // 15:59 UTC is 23:59 the same day; a minute later the date rolls over.
  assert.equal(todayIso(new Date('2026-11-02T15:59:00Z')), '2026-11-02')
  assert.equal(todayIso(new Date('2026-11-02T16:00:00Z')), '2026-11-03')
})

test('timeHm and hourNow read the Singapore clock', () => {
  const end = new Date('2026-11-02T02:09:05Z')
  assert.equal(timeHm(end), '10:09')
  assert.equal(hourNow(end), 10)
})

test('midnight reads as hour 0, not 24', () => {
  const midnight = new Date('2026-11-02T16:00:00Z')
  assert.equal(timeHm(midnight), '00:00')
  assert.equal(hourNow(midnight), 0)
})

test('shortDate gives the weekday of the calendar date', () => {
  assert.equal(shortDate('2026-11-02'), 'Mon 2 Nov')
  assert.equal(shortDate('2026-11-01'), 'Sun 1 Nov')
})
