import test from 'node:test'
import assert from 'node:assert/strict'
import { MEAL_LIBRARY } from '../../supabase/seed/meals.ts'
import { daysEaten, defaultSlot, libraryItems, matchesLibrary, usualChips, type UsualDay, type UsualLibraryRow } from './usuals.ts'

const library: UsualLibraryRow[] = MEAL_LIBRARY.map(m => ({ id: m.name, name: m.name, category: m.category, portion: m.portion, kcal: m.kcal, protein_g: m.protein_g, fiber_g: m.fiber_g, accuracy: m.accuracy, items: m.items }))

const meal = (name: string, item = name) => ({ name, items: [{ name: item }] })
const BREAKFAST = meal('Usual breakfast', 'Usual breakfast: 2 grilled white bread, 4 ham slices (80 g), 2 eggs')
const SUPPS = meal('Omega-3', 'Omega-3, 1 multivitamin, 4 scoops Cell-Tech creatine (`supps` default)')
const DRINKS = meal('2 × 500 ml water + 1 × 100PLUS Original', '2 × 500 ml water + 1 × 100PLUS Original (325 ml) + 1 × 100PLUS Zero (325 ml)')
const SHAKE = meal('1 scoop ON whey + 250 ml Pauls full cream milk')
const BANANA = meal('1 banana')
const APPLE = meal('1 apple', '1 apple, with dinner')
const WRAP = meal('SaladStop! Chihuahua wrap', 'SaladStop! Chihuahua wrap (whole wrap assumed) + 1 coffee capsule')
const BEACH = meal('Heybo Muscle Beach bowl', 'Heybo Muscle Beach bowl, half eaten (tired)')

/** Three weeks shaped like the vault: breakfast daily, a shake on lifting days, bowls in rotation. */
const days: UsualDay[] = [
  { date: '2026-11-02', meals: [BREAKFAST, SUPPS, DRINKS, SHAKE, BANANA, APPLE] },
  { date: '2026-11-04', meals: [BREAKFAST, SUPPS, DRINKS, SHAKE, BANANA] },
  { date: '2026-11-07', meals: [BREAKFAST, SUPPS, DRINKS, SHAKE, BEACH] },
  { date: '2026-11-08', meals: [BREAKFAST, SUPPS, WRAP, APPLE] },
  { date: '2026-11-09', meals: [BREAKFAST, SUPPS, DRINKS, SHAKE, meal('Banana + half an apple'), BEACH] },
  { date: '2026-11-10', meals: [meal('Usual breakfast minus one egg'), SUPPS, BANANA, WRAP, BEACH, APPLE] },
]
const TODAY = '2026-11-11'
const withToday = (meals: typeof BREAKFAST[]) => [...days, { date: TODAY, meals }]
const labels = (chips: { label: string }[]) => chips.map(c => c.label)

test('a library meal is recognised in the vault wording and in the app wording', () => {
  assert.equal(matchesLibrary('Post-workout shake', SHAKE), true)
  assert.equal(matchesLibrary('Post-workout shake', meal('Post-workout shake')), true)
  assert.equal(matchesLibrary('Post-workout shake', meal('2 scoops ON whey + 250 ml Pauls full cream milk')), false)
  assert.equal(matchesLibrary('Supplements', SUPPS), true)
  assert.equal(matchesLibrary('Workout drinks', DRINKS), true)
  assert.equal(matchesLibrary('Usual breakfast', meal('Usual breakfast minus one egg')), true)
  assert.equal(matchesLibrary('1 apple', meal('Pineapple slices')), false)
  assert.equal(matchesLibrary('Chihuahua bowl', WRAP), false)
  // No pattern: falls back to the library name.
  assert.equal(matchesLibrary('Chicken leg', meal('Chicken leg')), true)
  assert.equal(matchesLibrary('Din Tai Fung dinner', meal('Din Tai Fung IMM via Grab')), false)
})

test('days eaten counts distinct days inside the window and leaves today out', () => {
  assert.deepEqual(daysEaten('Usual breakfast', days, TODAY), { count: 6, last: '2026-11-10' })
  assert.deepEqual(daysEaten('Banana', days, TODAY), { count: 4, last: '2026-11-10' })
  assert.deepEqual(daysEaten('Banana', withToday([BANANA]), TODAY), { count: 4, last: '2026-11-10' })
  // 21 days back from 28 Nov is 7 Nov: only 7, 9 and 10 Nov are in the window.
  assert.deepEqual(daysEaten('Muscle Beach bowl', days, '2026-11-28'), { count: 3, last: '2026-11-10' })
  assert.deepEqual(daysEaten('Usual breakfast', days, '2026-11-28').count, 4)
})

test('a rest day with nothing logged: morning block first, then meals by how often they are eaten', () => {
  const chips = usualChips({ library, days, today: TODAY, hour: 8, sessionToday: false })
  assert.deepEqual(labels(chips), ['Morning routine', '1 apple', 'Banana', 'Post-workout shake', 'Muscle Beach bowl', 'Chihuahua wrap'])
  const morning = chips[0]
  assert.equal(morning.kind, 'block')
  assert.deepEqual(morning.parts.map(p => [p.row.name, p.slot]), [['Usual breakfast', 'Breakfast'], ['Supplements', 'Supplements']])
  assert.equal(morning.kcal, 776)
  assert.equal(morning.protein_g, 57)
  assert.equal(morning.water_ml, 500)
  // Apple, banana and shake tie on 4 days; the most recently eaten comes first, then the name.
  assert.equal(chips[1].days, 4)
})

test('a lifting day adds the session block and takes its parts out of the single meals', () => {
  const chips = usualChips({ library, days, today: TODAY, hour: 10, sessionToday: true })
  assert.deepEqual(labels(chips).slice(0, 3), ['Morning routine', 'Session drinks + shake', '1 apple'])
  const session = chips[1]
  assert.equal(session.kcal, 359)
  assert.equal(session.protein_g, 33)
  assert.equal(session.water_ml, 1650)
  assert.equal(labels(chips).includes('Post-workout shake'), false)
  assert.equal(labels(chips).includes('Workout drinks'), false)
})

test('a block already in the day note is dropped, so it cannot be logged twice', () => {
  const chips = usualChips({ library, days: withToday([BREAKFAST, SUPPS]), today: TODAY, hour: 9, sessionToday: false })
  assert.equal(labels(chips).includes('Morning routine'), false)
})

test('a half-logged block offers only what is missing, without its water again', () => {
  const chips = usualChips({ library, days: withToday([BREAKFAST]), today: TODAY, hour: 9, sessionToday: false })
  const morning = chips[0]
  assert.equal(morning.label, 'Morning routine')
  assert.deepEqual(morning.parts.map(p => p.row.name), ['Supplements'])
  assert.equal(morning.kcal, 10)
  assert.equal(morning.water_ml, 0)
})

test('a meal already eaten today stays, marked done', () => {
  const chips = usualChips({ library, days: withToday([BREAKFAST, SUPPS, meal('Banana')]), today: TODAY, hour: 12, sessionToday: false })
  const banana = chips.find(c => c.label === 'Banana')
  assert.equal(banana?.doneToday, true)
  assert.equal(chips.find(c => c.label === '1 apple')?.doneToday, false)
})

test('one-off meals stay out, and no history means only the morning block', () => {
  const once = usualChips({ library, days: [{ date: '2026-11-10', meals: [meal('Barebells bar')] }], today: TODAY, hour: 12, sessionToday: false })
  assert.deepEqual(labels(once), ['Morning routine'])
  assert.deepEqual(labels(usualChips({ library: [], days: [], today: TODAY, hour: 12, sessionToday: true })), [])
})

test('slots follow the category, then the hour', () => {
  assert.equal(defaultSlot('dinner', 9), 'Dinner')
  assert.equal(defaultSlot('fiber', 15), 'Snack')
  assert.equal(defaultSlot('fiber', 20), 'Evening')
  assert.equal(defaultSlot('snack', 9), 'Snack')
  assert.equal(defaultSlot('shake', 13), 'Shake')
  assert.equal(defaultSlot(null, 21), 'Evening')
})

test('a library meal logs its own breakdown, or one line when it has none', () => {
  const breakfast = library.find(r => r.name === 'Usual breakfast')
  assert.ok(breakfast)
  assert.equal(libraryItems(breakfast).length, 6)
  const bare = libraryItems({ ...breakfast, items: [], protein_g: '57', fiber_g: null })
  assert.deepEqual(bare, [{ name: breakfast.portion, grams: null, kcal: 766, protein_g: 57, fiber_g: null, accuracy: 'estimated' }])
})

test('the seed carries the regulars and the two-can workout drinks', () => {
  const byName = new Map(MEAL_LIBRARY.map(m => [m.name, m]))
  // A tap logs the items, so their sum is what lands in the day.
  for (const name of ['Chihuahua wrap', 'Chihuahua bowl', 'Muscle Beach bowl', 'Greek yogurt 250 g', 'Yogurt bowl', 'Workout drinks']) {
    const m = byName.get(name)
    assert.ok(m, name)
    assert.equal(m.items.reduce((n, i) => n + i.kcal, 0), m.kcal, `${name} items add up to its kcal`)
  }
  assert.equal(byName.get('Workout drinks')?.kcal, 64)
})
