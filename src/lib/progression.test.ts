/**
 * Push-or-stay engine tests: the four real sessions (fixtures) plus synthetic
 * edge cases.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { countVerdicts, decide, decideSessions, disagreements } from './progression.ts'
import { buildProgressRows, countRows, type LoggedExerciseRecord } from './progressRows.ts'
import { bySession, exercise, loadFixtureSessions } from './fixtures.test-helper.ts'

const decided = decideSessions(loadFixtureSessions())

test('the engine reproduces every logged decision (16 of 22 have arrows)', () => {
  const logged = decided.flatMap(s => s.exercises).filter(e => e.logged_verdict !== null)
  assert.equal(logged.length, 16)
  assert.deepEqual(
    disagreements(decided).map(e => `${e.exercise_key}: logged ${e.logged_verdict}, engine ${e.decision.verdict}`),
    [],
  )
})

test('totals: 10 push, 11 stay, 1 progress_bw', () => {
  assert.deepEqual(countVerdicts(decided), { push: 10, stay: 11, progress_bw: 1 })
})

test('Lower A front squat: push to 47.5 kg against the carried aim of 10', () => {
  const fs = exercise(bySession(decided, 'lower_a'), 'front_squat')
  assert.equal(fs.carried_aim, 10)
  assert.equal(fs.decision.verdict, 'push')
  assert.equal(fs.decision.target, 10)
  assert.equal(fs.decision.nextLoadText, '47.5 kg')
})

test('Lower B front squat: push to 47.5 kg', () => {
  const fs = exercise(bySession(decided, 'lower_b'), 'front_squat')
  assert.equal(fs.decision.verdict, 'push')
  assert.equal(fs.decision.nextLoadText, '47.5 kg')
  assert.equal(fs.next_aim, 10)
})

test('incline DB curl: push, the 4th set of 8 is ignored', () => {
  const c = exercise(bySession(decided, 'upper_a'), 'incline_db_curl')
  assert.deepEqual(c.sets.map(s => s.reps), [12, 12, 12, 8])
  assert.equal(c.decision.verdict, 'push')
  assert.equal(c.decision.nextLoadText, 'next DB jump')
})

test('seated DB OHP: stay, straight sets first', () => {
  const o = exercise(bySession(decided, 'upper_a'), 'seated_db_ohp')
  assert.equal(o.decision.verdict, 'stay')
  assert.equal(o.decision.reason, 'straight sets first')
})

test('dead bug: bodyweight progression', () => {
  const d = exercise(bySession(decided, 'lower_b'), 'dead_bug')
  assert.equal(d.decision.verdict, 'progress_bw')
  assert.equal(d.decision.nextLoadText, 'slow the tempo or add a light load')
})

test('Upper A chest-supported row: push, above range', () => {
  const r = exercise(bySession(decided, 'upper_a'), 'chest_supported_row')
  assert.equal(r.decision.verdict, 'push')
  assert.equal(r.decision.aboveRange, true)
})

test('incline DB press: stay, get all 4 sets to 12', () => {
  const p = exercise(bySession(decided, 'upper_b'), 'incline_db_press')
  assert.equal(p.decision.verdict, 'stay')
  assert.equal(p.decision.reason, 'get all 4 sets to 12')
})

test('standing calf raise: push to 57.5 kg (program rule, not the note\'s 60)', () => {
  const c = exercise(bySession(decided, 'lower_a'), 'standing_calf_raise')
  assert.equal(c.decision.verdict, 'push')
  assert.equal(c.decision.nextLoadText, '57.5 kg')
})

test('single-leg calf raise: push, heavier KB', () => {
  const c = exercise(bySession(decided, 'lower_b'), 'single_leg_calf_raise')
  assert.equal(c.decision.verdict, 'push')
  assert.equal(c.decision.nextLoadText, 'heavier KB')
})

test('synthetic: 2 of 3 sets logged → stay, finish all sets', () => {
  const d = decide({
    sets: [{ reps: 12 }, { reps: 12 }],
    programmedSets: 3,
    repMin: 8,
    repMax: 12,
    carriedAim: null,
    loading: 'dumbbell',
    loadKg: 10,
  })
  assert.equal(d.verdict, 'stay')
  assert.equal(d.reason, 'finish all sets')
})

test('synthetic: aim 8 with 8, 8, 8 → push', () => {
  const d = decide({
    sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
    programmedSets: 3,
    repMin: 8,
    repMax: 12,
    carriedAim: 8,
    loading: 'barbell',
    loadKg: 40,
  })
  assert.equal(d.verdict, 'push')
  assert.equal(d.target, 8)
  assert.equal(d.aboveRange, false)
  assert.equal(d.nextLoadText, '42.5 kg')
})

test('synthetic: a rest-paused bonus set beyond the programmed count does not block a push', () => {
  const d = decide({
    sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }, { reps: 10, rest_pause: true }],
    programmedSets: 3,
    repMin: 8,
    repMax: 12,
    carriedAim: null,
    loading: 'kettlebell',
    loadKg: 4,
  })
  assert.equal(d.verdict, 'push')
  assert.equal(d.nextLoadText, 'heavier KB')
})

test('progress screen rows: Push 9, Stay 10 (9 + 1 bodyweight), New 3', () => {
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
  const rows = buildProgressRows(records)
  assert.equal(rows.length, 22)
  assert.deepEqual(countRows(rows), { push: 9, stay: 10, new: 3 })
  assert.equal(rows.filter(r => r.bodyweight).length, 1)
  assert.deepEqual(
    rows.filter(r => r.filter === 'new').map(r => r.key).sort(),
    ['close_grip_bench', 'db_shrug', 'rear_delt_fly'],
  )
  const row = rows.find(r => r.key === 'chest_supported_row')!
  assert.equal(row.filter, 'push')
  assert.equal(row.dayLabel, 'Upper A')
  assert.equal(row.date, '2026-10-31')
  const fs = rows.find(r => r.key === 'front_squat')!
  assert.equal(fs.filter, 'push')
  assert.equal(fs.nextLoadText, '47.5 kg')
  assert.equal(fs.dayLabel, 'Lower A')
  const press = rows.find(r => r.key === 'incline_db_press')!
  assert.equal(press.filter, 'stay')
  assert.equal(press.reason, 'get all 4 sets to 12')
})
