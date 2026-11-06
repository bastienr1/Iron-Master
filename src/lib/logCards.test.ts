import test from 'node:test'
import assert from 'node:assert/strict'
import { activityText, mealTotals, validateCard, validateParseResponse, type ActivityCard } from './logCards.ts'
import { EXERCISES } from './exercises.ts'

const keys = new Set(Object.keys(EXERCISES))

test('a set card round-trips and rounds reps', () => {
  const c = validateCard({ kind: 'set', exercise_key: 'front_squat', raw_name: 'Front squat', load_kg: 45, implements: 1, sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }, { reps: 10 }], note: 'Felt strong.' }, keys)
  assert.equal(c?.kind, 'set')
  if (c?.kind !== 'set') return
  assert.equal(c.exercise_key, 'front_squat')
  assert.equal(c.sets.length, 4)
  assert.equal(c.note, 'Felt strong.')
})

test('unknown exercise keys and empty sets are rejected', () => {
  assert.equal(validateCard({ kind: 'set', exercise_key: 'leg_press', sets: [{ reps: 10 }] }, keys), null)
  assert.equal(validateCard({ kind: 'set', exercise_key: 'front_squat', sets: [] }, keys), null)
  assert.equal(validateCard({ kind: 'set', exercise_key: 'front_squat', sets: [{ reps: 0 }] }, keys), null)
})

test("a meal card like JT's pecho set totals 800 kcal / 64 g, worst accuracy wins", () => {
  const c = validateCard({
    kind: 'meal',
    name: "Lunch · JT's Manukan Grille",
    slot: 'Lunch',
    items: [
      { name: 'Chicken inasal 206 g', grams: 206, kcal: 390, protein_g: 56, fiber_g: 0, accuracy: 'weighed' },
      { name: 'Oily sauce ~1 tbsp', grams: null, kcal: 80, protein_g: 0, fiber_g: 0, accuracy: 'estimated' },
      { name: 'Plain rice 153 g', grams: 153, kcal: 200, protein_g: 4, fiber_g: 0.6, accuracy: 'weighed' },
      { name: 'Adobong kangkong 152 g', grams: 152, kcal: 130, protein_g: 4, fiber_g: 3.5, accuracy: 'weighed' },
    ],
    library_match: null,
    note: null,
  }, keys)
  assert.equal(c?.kind, 'meal')
  if (c?.kind !== 'meal') return
  const t = mealTotals(c.items)
  assert.equal(t.kcal, 800)
  assert.equal(t.protein_g, 64)
  assert.equal(t.fiber_g, 4.1)
  assert.equal(t.accuracy, 'estimated')
})

test('weigh-in and water bounds', () => {
  assert.deepEqual(validateCard({ kind: 'weigh_in', kg: 75.44 }, keys), { kind: 'weigh_in', kg: 75.4, context: 'fasted', note: null })
  assert.equal(validateCard({ kind: 'weigh_in', kg: 7 }, keys), null)
  assert.deepEqual(validateCard({ kind: 'water', ml: 500 }, keys), { kind: 'water', ml: 500, note: null })
  assert.equal(validateCard({ kind: 'water', ml: 0 }, keys), null)
})

test('a response keeps valid cards and drops bad ones', () => {
  const r = validateParseResponse({ cards: [{ kind: 'water', ml: 250 }, { kind: 'bogus' }, { kind: 'note', text: 'Headache mid-session' }], reply: 'Logged.' }, keys)
  assert.equal(r.cards.length, 2)
  assert.equal(r.reply, 'Logged.')
  assert.deepEqual(validateParseResponse(null, keys), { cards: [], reply: '' })
})

test('an activity card needs at least one measure and prints cleanly', () => {
  const walk = validateCard({ kind: 'activity', activity: 'walk', minutes: 60, km: 5, steps: null, note: null }, keys)
  assert.deepEqual(walk, { kind: 'activity', activity: 'walk', minutes: 60, km: 5, steps: null, note: null })
  assert.equal(activityText(walk as ActivityCard), 'Walk · 60 min · 5 km')

  const steps = validateCard({ kind: 'activity', activity: 'steps', steps: 8400.4 }, keys) as ActivityCard
  assert.equal(steps.steps, 8400)
  assert.equal(activityText(steps), '8,400 steps')

  assert.equal(validateCard({ kind: 'activity', activity: 'walk' }, keys), null)
  assert.equal(validateCard({ kind: 'activity', activity: 'walk', minutes: 5000 }, keys), null)
  const odd = validateCard({ kind: 'activity', activity: 'rowing', minutes: 20 }, keys) as ActivityCard
  assert.equal(odd.activity, 'other')
  assert.equal(activityText(odd), 'Activity · 20 min')
})
