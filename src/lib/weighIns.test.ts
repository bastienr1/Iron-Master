import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWeighIn, trendWeighIns, type WeighInReading } from './weighIns.ts'
import { validateCard } from './logCards.ts'
import { EXERCISES } from './exercises.ts'

const keys = new Set(Object.keys(EXERCISES))

// 6 Nov 2026: three weigh-ins in one day. The trend must read the fasted one.
const morning: WeighInReading = { date: '2026-11-06', kg: 76.3, context: 'fasted' }
const afterBreakfast: WeighInReading = { date: '2026-11-06', kg: 76.6, context: 'pre_workout' }
const afterWorkout: WeighInReading = { date: '2026-11-06', kg: 76.7, context: 'post_workout' }

test('a post-workout weigh-in never replaces the fasted morning one', () => {
  let rows: WeighInReading[] = [{ date: '2026-11-04', kg: 76.2, context: 'fasted' }]
  rows = applyWeighIn(rows, morning)
  rows = applyWeighIn(rows, afterBreakfast)
  rows = applyWeighIn(rows, afterWorkout)
  assert.equal(rows.length, 4)
  assert.deepEqual(trendWeighIns(rows).map(r => r.kg), [76.2, 76.3])
  assert.ok(rows.some(r => r.kg === 76.7 && r.context === 'post_workout'), 'the post-workout reading is kept')
})

test('a second fasted reading on the same day replaces the first', () => {
  const rows = applyWeighIn([morning, afterWorkout], { date: '2026-11-06', kg: 76.2, context: 'fasted' })
  assert.equal(rows.length, 2)
  assert.deepEqual(trendWeighIns(rows).map(r => r.kg), [76.2])
})

test('the trend is sorted by date and ignores non-fasted days', () => {
  const rows: WeighInReading[] = [
    { date: '2026-11-06', kg: 76.3, context: 'fasted' },
    { date: '2026-11-05', kg: 77.1, context: 'other' },
    { date: '2026-11-04', kg: 76.2, context: 'fasted' },
  ]
  assert.deepEqual(trendWeighIns(rows).map(r => r.date), ['2026-11-04', '2026-11-06'])
})

test('a weigh-in card carries its context and defaults to fasted', () => {
  assert.deepEqual(validateCard({ kind: 'weigh_in', kg: 76.7, context: 'post_workout', note: 'After the workout.' }, keys), {
    kind: 'weigh_in',
    kg: 76.7,
    context: 'post_workout',
    note: 'After the workout.',
  })
  // Cards saved before contexts existed, and anything odd from the parser, are morning readings.
  assert.equal((validateCard({ kind: 'weigh_in', kg: 76.3 }, keys) as { context: string }).context, 'fasted')
  assert.equal((validateCard({ kind: 'weigh_in', kg: 76.3, context: 'evening' }, keys) as { context: string }).context, 'fasted')
})
