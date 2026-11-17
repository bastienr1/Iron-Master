import test from 'node:test'
import assert from 'node:assert/strict'
import { decideSessions } from './progression.ts'
import type { LoggedExerciseRecord } from './progressRows.ts'
import { latestByExercise, prescribe, slotsFor, slotsForSession } from './sessionPlan.ts'
import { parseSessionNote } from './vaultParse.ts'
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

test('deload slots: half the sets, same lifts and ranges', () => {
  const normal = slotsFor('lower_a')
  const deload = slotsForSession('lower_a', true)
  assert.deepEqual(deload.map(s => s.exercise_key), normal.map(s => s.exercise_key))
  assert.deepEqual(deload.map(s => s.sets), [2, 2, 2, 2, 2])
  assert.deepEqual(slotsForSession('lower_a', false), normal)
})

test('deload prescription: front squat that was pushing to 47.5 drops to 35 for two sets, back to 47.5 after', () => {
  const p = prescribe('lower_a', latest, { deload: true })
  const fs = p[0]
  assert.equal(fs.key, 'front_squat')
  assert.equal(fs.verdict, 'deload')
  assert.equal(fs.sets, 2)
  assert.equal(fs.loadKg, 35)
  assert.equal(fs.rangeText, '2 × 8–12')
  assert.match(fs.cue, /^Deload\. Last time /)
  assert.match(fs.cue, /Two sets at ~80%, stop 3–4 reps short\. Back to 47\.5 kg next week\.$/)
})

test('deload prescription: a lift never logged stays NEW with the halved sets', () => {
  const p = prescribe('lower_b', latest, { deload: true })
  const wheel = p.find(x => x.key === 'ab_wheel')!
  assert.equal(wheel.verdict, 'new')
  assert.equal(wheel.sets, 2)
  assert.match(wheel.cue, /deload week/)
})

test('without the option nothing changes: sets are the programmed count', () => {
  const p = prescribe('lower_a', latest)
  assert.equal(p[0].sets, 4)
  assert.equal(p[0].verdict, 'push')
})

const NOTE = `---
type: physique-session
date: 2026-11-17
day: Lower B
focus: volume
deload: true
status: planned
---

# Lower B — 2026-11-17 (deload)
`

test('session note frontmatter: deload: true is read, absent means false', () => {
  const planned = parseSessionNote(NOTE, 'Health/Physique-Log/2026-11-17 Lower B.md')
  assert.equal(planned.deload, true)
  assert.equal(planned.day, 'lower_b')
  const normal = parseSessionNote(NOTE.replace('deload: true\n', ''), 'x.md')
  assert.equal(normal.deload, false)
})
