import test from 'node:test'
import assert from 'node:assert/strict'
import { deloadLoad, deloadSets, isDeloadDate } from './deload.ts'

test('a deload week runs from its Monday to the Sunday after', () => {
  const weeks = ['2026-11-16']
  assert.equal(isDeloadDate('2026-11-15', weeks), false)
  assert.equal(isDeloadDate('2026-11-16', weeks), true)
  assert.equal(isDeloadDate('2026-11-17', weeks), true)
  assert.equal(isDeloadDate('2026-11-22', weeks), true)
  assert.equal(isDeloadDate('2026-11-23', weeks), false)
  assert.equal(isDeloadDate('2026-11-17', []), false)
})

test('half the sets, rounded up', () => {
  assert.equal(deloadSets(4), 2)
  assert.equal(deloadSets(3), 2)
  assert.equal(deloadSets(1), 1)
})

test('deload loads: ~80%, barbell on a 5 kg grid, others whole kilos, bodyweight untouched', () => {
  // Lower B on 11 Nov 2026: RDL 65, front squat 45, lunge 55 (last set), calf raise 13 kg DB
  assert.equal(deloadLoad(65, 'barbell'), 50)
  assert.equal(deloadLoad(45, 'barbell'), 35)
  assert.equal(deloadLoad(55, 'barbell'), 40)
  assert.equal(deloadLoad(13, 'dumbbell'), 10)
  assert.equal(deloadLoad(16, 'kettlebell'), 12)
  assert.equal(deloadLoad(20, 'barbell'), 20, 'never below the bar')
  assert.equal(deloadLoad(null, 'barbell'), null)
  assert.equal(deloadLoad(80, 'bodyweight'), null)
})
