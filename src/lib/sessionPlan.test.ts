import test from 'node:test'
import assert from 'node:assert/strict'
import { decideSessions } from './progression.ts'
import type { LoggedExerciseRecord } from './progressRows.ts'
import { latestByExercise, nextDay, prescribe, rangeText, slotsFor } from './sessionPlan.ts'
import { loadFixtureSessions } from './fixtures.test-helper.ts'

const decided = decideSessions(loadFixtureSessions())
const records: LoggedExerciseRecord[] = decided.flatMap(s =>
  s.exercises.map(e => ({
    exercise_key: e.exercise_key,
    date: s.date,
    day: s.day,
    load_text: e.load_text,
    sets: e.sets,
    verdict: e.decision.verdict,
    next_load_text: e.decision.nextLoadText || null,
    reason: e.decision.reason,
    target_reps: e.decision.target,
    above_range: e.decision.aboveRange,
  })),
)
const latest = latestByExercise(records)

test('rotation: after Lower A comes Upper B; nothing logged starts at Upper A', () => {
  assert.equal(nextDay('lower_a'), 'upper_b')
  assert.equal(nextDay('lower_b'), 'upper_a')
  assert.equal(nextDay(null), 'upper_a')
})

test('Upper B prescription from the real logs', () => {
  const p = prescribe('upper_b', latest)
  assert.equal(p.length, 8)
  assert.deepEqual(p.map(x => x.key), slotsFor('upper_b').map(s => s.exercise_key))

  const press = p[0]
  assert.equal(press.key, 'incline_db_press')
  assert.equal(press.verdict, 'stay')
  assert.equal(press.loadKg, 19.5)
  assert.deepEqual(press.lastReps, [12, 11, 11, 11])
  assert.match(press.cue, /Get all four sets to 12, then it goes up/)
  assert.equal(press.rangeText, '4 × 8–12')
  assert.equal(press.restSeconds, 120)

  const row = p[1]
  assert.equal(row.key, 'chest_supported_row')
  assert.equal(row.verdict, 'push')
  assert.equal(row.loadText, 'next DB jump')
  assert.equal(row.lastDate, '2026-10-31')

  const rear = p.find(x => x.key === 'rear_delt_fly')!
  assert.equal(rear.verdict, 'new')
  assert.equal(rear.loadText, 'pick a weight')
  assert.equal(rear.restSeconds, 90)
})

test('Lower A prescription: front squat pushes to 47.5 kg', () => {
  const p = prescribe('lower_a', latest)
  const fs = p[0]
  assert.equal(fs.key, 'front_squat')
  assert.equal(fs.verdict, 'push')
  assert.equal(fs.loadKg, 47.5)
  assert.equal(fs.loadText, '47.5')
  const calf = p.find(x => x.key === 'standing_calf_raise')!
  assert.equal(calf.loadKg, 57.5)
  const hlr = p.find(x => x.key === 'hanging_leg_raise')!
  assert.equal(hlr.verdict, 'stay')
  assert.equal(hlr.loadText, 'Bodyweight')
})

test('range text', () => {
  assert.equal(rangeText(slotsFor('lower_a')[1]), '3 × 10 per side')
  assert.equal(rangeText(slotsFor('upper_a')[0]), '4 × 6–10')
  assert.deepEqual(slotsFor('lower_b').map(s => s.exercise_key), [
    'barbell_rdl', 'front_squat', 'barbell_forward_lunge', 'single_leg_calf_raise', 'ab_wheel',
  ])
  assert.equal(rangeText(slotsFor('lower_b')[4]), '3 × 8–12')
})
