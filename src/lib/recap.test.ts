import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRecap, formatRange, weekOf } from './recap.ts'
import { decideSessions } from './progression.ts'
import { loadFixtureNutrition, loadFixtureSessions } from './fixtures.test-helper.ts'

const decided = decideSessions(loadFixtureSessions())
const sessions = decided.map(s => ({ date: s.date, day: s.day, exercises: s.exercises.map(e => ({ verdict: e.decision.verdict, sets: e.sets })) }))
const days = loadFixtureNutrition().map(d => ({ date: d.date, kcal: d.kcal, protein_g: d.protein_g, fiber_g: d.fiber_g, status: d.status }))

test('week of 1 Nov 2026 is Mon 26 Oct – Sun 1 Nov, ISO week 44', () => {
  const w = weekOf('2026-11-01')
  assert.equal(w.start, '2026-10-26')
  assert.equal(w.end, '2026-11-01')
  assert.equal(w.isoWeek, 44)
  assert.equal(formatRange(w), '26 Oct – 1 Nov')
  assert.equal(weekOf('2026-10-28').start, '2026-10-26')
})

test('recap for week 44 matches the design: 4/4 sessions, 841 reps, 10 level ups, avg 2,843 kcal', () => {
  const r = buildRecap('2026-11-01', sessions, days, [])
  assert.equal(r.sessions, 4)
  assert.equal(r.reps, 841)
  assert.equal(r.levelUps, 10)
  assert.equal(r.avgKcal, 2843)
  assert.equal(r.daysLogged, 4)
  assert.equal(r.headline, 'Training on track, fiber short')
  assert.equal(r.bars.length, 7)
  assert.deepEqual(r.bars.map(b => b.status), ['none', 'none', 'done', 'done', 'done', 'done', 'in-progress'])
  assert.equal(r.bars[2].kcal, 2910)
  assert.equal(r.bodyweight.unlocked, false)
  assert.equal(r.bodyweight.count, 0)
})

test('bodyweight unlocks after 3 fasted weigh-ins with a per-week slope; other readings do not count', () => {
  const r = buildRecap('2026-11-01', sessions, days, [
    { date: '2026-10-20', kg: 75.0, context: 'fasted' },
    { date: '2026-10-27', kg: 75.2, context: 'fasted' },
    { date: '2026-11-03', kg: 75.4, context: 'fasted' },
    { date: '2026-11-03', kg: 75.9, context: 'post_workout' },
  ])
  assert.equal(r.bodyweight.unlocked, true)
  assert.equal(r.bodyweight.count, 3)
  assert.equal(r.bodyweight.perWeekKg, 0.2)
  assert.equal(r.bodyweight.latest?.kg, 75.4)

  const locked = buildRecap('2026-11-01', sessions, days, [
    { date: '2026-10-20', kg: 75.0, context: 'fasted' },
    { date: '2026-10-27', kg: 75.2, context: 'fasted' },
    { date: '2026-11-03', kg: 75.9, context: 'post_workout' },
  ])
  assert.equal(locked.bodyweight.unlocked, false)
})

test('an empty week has a plain headline', () => {
  const r = buildRecap('2026-12-07', sessions, days, [])
  assert.equal(r.headline, 'Nothing logged yet this week')
  assert.equal(r.avgKcal, null)
})
