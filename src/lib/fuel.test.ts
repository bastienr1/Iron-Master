import test from 'node:test'
import assert from 'node:assert/strict'
import { fill, periodOf, remaining, restOfDayPlan, sumMeals } from './fuel.ts'
import { programWeek } from './targets.ts'

test('sumMeals adds kcal, protein and fiber, keeps water', () => {
  const t = sumMeals([
    { kcal: 766, protein_g: 57, fiber_g: 5 },
    { kcal: 800, protein_g: 64, fiber_g: 4 },
    { kcal: 295, protein_g: 33, fiber_g: null },
  ], 1500)
  assert.deepEqual(t, { kcal: 1861, protein_g: 154, fiber_g: 9, water_ml: 1500 })
})

test('remaining on 1 Nov after lunch: protein met, 750 kcal left, 20 g fiber short', () => {
  const r = remaining({ kcal: 2000, protein_g: 154, fiber_g: 10, water_ml: 1500 })
  assert.equal(r.kcal, 750)
  assert.equal(r.proteinMet, true)
  assert.equal(r.fiber_g, 20)
  assert.equal(r.water_ml, 1500)
  assert.equal(r.kcalOver, false)
})

test('rest-of-day plan after lunch mirrors the note: dinner ~550, evening fruit, fiber fixers, water', () => {
  const lines = restOfDayPlan({ kcal: 2000, protein_g: 154, fiber_g: 10, water_ml: 1500 }, 'afternoon')
  const labels = lines.map(l => l.label)
  assert.deepEqual(labels, ['Dinner', 'Evening', 'Fiber', 'Water'])
  assert.match(lines[0].text, /~550 kcal, 20–30 g protein, 150 g\+ vegetables/)
  assert.match(lines[1].text, /~200 kcal · 2 apples or 3 mandarins/)
  assert.match(lines[2].text, /^20 g short\. Psyllium 10 g \(\+8 g\)/)
  assert.match(lines[3].text, /1\.5 L more before bed/)
})

test('plan when everything is met only mentions what is left', () => {
  const lines = restOfDayPlan({ kcal: 2800, protein_g: 170, fiber_g: 32, water_ml: 3000 }, 'night')
  assert.deepEqual(lines.map(l => l.label), ['Food'])
  assert.match(lines[0].text, /50 kcal over/)
})

test('protein not met asks for more protein at the next meal', () => {
  const lines = restOfDayPlan({ kcal: 900, protein_g: 60, fiber_g: 8, water_ml: 500 }, 'morning')
  assert.equal(lines[0].label, 'Lunch')
  assert.match(lines[0].text, /60 g\+ protein/)
})

test('periods and bar fill', () => {
  assert.equal(periodOf(8), 'morning')
  assert.equal(periodOf(13), 'afternoon')
  assert.equal(periodOf(19), 'evening')
  assert.equal(periodOf(22), 'night')
  assert.equal(fill(2000, 2750), 2000 / 2750)
  assert.equal(fill(3000, 2750), 1)
})

test('program week: 16 Oct is week 1, 1 Nov is week 3', () => {
  assert.equal(programWeek('2026-10-16'), 1)
  assert.equal(programWeek('2026-10-22'), 1)
  assert.equal(programWeek('2026-10-23'), 2)
  assert.equal(programWeek('2026-11-01'), 3)
})
