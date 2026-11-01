/**
 * Vault parser tests on the fixture notes (fixtures/vault). Runs on Node's
 * built-in runner with native type stripping (`npm test`).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAim, parseLoadCell, parseRepsCell, parseRangeCell, sessionTotals } from './vaultParse.ts'
import { resolveExercise } from './exercises.ts'
import { bySession, exercise, loadFixtureNutrition, loadFixtureSessions } from './fixtures.test-helper.ts'

const sessions = loadFixtureSessions()

test('four fixture sessions: 22 exercises, 77 sets, 841 reps', () => {
  const t = sessionTotals(sessions)
  assert.deepEqual(t, { sessions: 4, exercises: 22, sets: 77, reps: 841 })
})

test('per-session reps', () => {
  const reps = (day: string) =>
    bySession(sessions, day).exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + s.reps, 0), 0)
  assert.equal(reps('upper_b'), 211)
  assert.equal(reps('lower_b'), 177)
  assert.equal(reps('upper_a'), 261)
  assert.equal(reps('lower_a'), 192)
})

test('nothing unread in any fixture note', () => {
  for (const s of sessions) assert.deepEqual(s.unread, [], `${s.path}: ${s.unread.join('; ')}`)
})

test('frontmatter date and day', () => {
  const ub = bySession(sessions, 'upper_b')
  assert.equal(ub.date, '2026-10-28')
  assert.equal(bySession(sessions, 'lower_a').date, '2026-11-01')
})

test('hammer curl keeps its bonus set as a 4th set', () => {
  const hc = exercise(bySession(sessions, 'upper_b'), 'hammer_curl')
  assert.deepEqual(hc.sets.map(s => s.reps), [10, 10, 10, 6])
  assert.equal(hc.programmed_sets, 3)
  assert.equal(hc.load_kg, 11)
})

test('seated DB OHP: 3 sets of 10, last two rest-paused', () => {
  const ohp = exercise(bySession(sessions, 'upper_a'), 'seated_db_ohp')
  assert.deepEqual(ohp.sets, [{ reps: 10 }, { reps: 10, rest_pause: true }, { reps: 10, rest_pause: true }])
})

test('Upper B lateral raise table becomes one exercise with per-set loads', () => {
  const lr = exercise(bySession(sessions, 'upper_b'), 'db_lateral_raise')
  assert.equal(lr.sets.length, 5)
  assert.deepEqual(lr.sets.map(s => s.load_kg), [6, 8, 7, 5, 5])
  assert.deepEqual(lr.sets.map(s => s.reps), [8, 4, 6, 20, 20])
  assert.equal(lr.load_text, '5–8')
  assert.equal(lr.programmed_sets, 4)
  assert.equal(lr.rep_min, 15)
  assert.equal(lr.rep_max, 25)
})

test('weight cells: implements, kg, bodyweight, bodyweight + KB', () => {
  const lb = bySession(sessions, 'lower_b')
  const rdl = exercise(lb, 'db_rdl')
  assert.equal(rdl.implements, 2)
  assert.equal(rdl.load_kg, 32)
  assert.equal(rdl.load_text, '2 × 32 (64 total)')
  assert.equal(exercise(lb, 'dead_bug').load_kg, null)
  assert.equal(exercise(lb, 'single_leg_calf_raise').load_kg, 4)
  assert.equal(exercise(bySession(sessions, 'upper_b'), 'incline_db_press').load_kg, 19.5)
  assert.deepEqual(parseLoadCell('BW + 4 kg KB'), { load_text: 'BW + 4 kg KB', load_kg: 4, implements: 1 })
  assert.equal(parseLoadCell('heavy'), null)
})

test('reps cells ignore trailing words and parentheticals', () => {
  assert.deepEqual(parseRepsCell('15, 15, 15 per leg'), [{ reps: 15 }, { reps: 15 }, { reps: 15 }])
  assert.deepEqual(parseRepsCell('10, 7+3 (15 s pause), 7+3 (30 s pause)'), [
    { reps: 10 },
    { reps: 10, rest_pause: true },
    { reps: 10, rest_pause: true },
  ])
  assert.deepEqual(parseRepsCell('10, 10, 10 + bonus set of 6'), [{ reps: 10 }, { reps: 10 }, { reps: 10 }, { reps: 6 }])
  assert.equal(parseRepsCell('a few'), null)
})

test('range cells', () => {
  assert.deepEqual(parseRangeCell('3 × 8–10'), { sets: 3, rep_min: 8, rep_max: 10 })
  assert.deepEqual(parseRangeCell('3 × 10 per leg'), { sets: 3, rep_min: 10, rep_max: 10 })
  assert.deepEqual(parseRangeCell('3 × 10–12 per leg'), { sets: 3, rep_min: 10, rep_max: 12 })
  assert.equal(parseRangeCell('see program'), null)
})

test('ranges fall back to the program seed when the note has no Program range column', () => {
  const ub = bySession(sessions, 'upper_b')
  const press = exercise(ub, 'incline_db_press')
  assert.equal(press.programmed_sets, 4)
  assert.equal(press.rep_min, 8)
  assert.equal(press.rep_max, 12)
})

test('logged decisions: arrows → push/stay, none → null', () => {
  const ua = bySession(sessions, 'upper_a')
  assert.equal(exercise(ua, 'bench_press').logged_verdict, 'stay')
  assert.equal(exercise(ua, 'incline_db_curl').logged_verdict, 'push')
  for (const e of bySession(sessions, 'upper_b').exercises) assert.equal(e.logged_verdict, null)
  assert.equal(exercise(bySession(sessions, 'lower_b'), 'dead_bug').logged_verdict, null)
  const logged = sessions.flatMap(s => s.exercises).filter(e => e.logged_verdict !== null)
  assert.equal(logged.length, 16)
})

test('aims: single, range, per-set plans', () => {
  assert.equal(exercise(bySession(sessions, 'lower_b'), 'front_squat').next_aim, 10)
  const ua = bySession(sessions, 'upper_a')
  assert.equal(exercise(ua, 'chest_supported_row').next_aim, 10)
  assert.equal(exercise(ua, 'bench_press').next_aim, null)
  assert.equal(exercise(ua, 'seated_db_ohp').next_aim, null)
  assert.equal(parseAim('aim for 8 per set'), 8)
  assert.equal(parseAim('aim 8–10'), 10)
  assert.equal(parseAim('aim 8, 8, 7, 7'), null)
  assert.equal(parseAim('aim 10, 8, 8'), null)
  assert.equal(parseAim('aim 12'), 12)
  assert.equal(parseAim('same weight'), null)
})

test('exercise aliases resolve to canonical keys', () => {
  assert.equal(resolveExercise('Front squat (barbell)'), 'front_squat')
  assert.equal(resolveExercise('Barbell front squat'), 'front_squat')
  assert.equal(resolveExercise('DB front squat'), 'front_squat')
  assert.equal(resolveExercise('Heel-elevated goblet squat'), 'front_squat')
  assert.equal(
    resolveExercise('[Barbell front squat](https://x) (replaces [goblet](https://y) / [DB front squat](https://z))'),
    'front_squat',
  )
  assert.equal(resolveExercise('Weighted pull-up'), 'pull_up')
  assert.equal(resolveExercise('Pull-up'), 'pull_up')
  assert.equal(resolveExercise('Chest-supported DB row'), 'chest_supported_row')
  assert.equal(resolveExercise('Lateral raise'), 'db_lateral_raise')
  assert.equal(resolveExercise('DB lateral raise'), 'db_lateral_raise')
  assert.equal(resolveExercise('DB Romanian deadlift'), 'db_rdl')
  assert.equal(resolveExercise('Single-leg DB RDL'), 'single_leg_db_rdl')
  assert.equal(resolveExercise('Barbell bench press'), 'bench_press')
  assert.equal(resolveExercise('Overhead DB triceps extension'), 'overhead_db_triceps')
  assert.equal(resolveExercise('Standing calf raise (barbell in rack)'), 'standing_calf_raise')
  assert.equal(resolveExercise('Leg press'), null)
})

test('nutrition frontmatter: 5 days, kcal, status', () => {
  const days = loadFixtureNutrition()
  assert.equal(days.length, 5)
  assert.deepEqual(
    days.map(d => [d.date, d.status, d.kcal]),
    [
      ['2026-10-28', 'done', 2910],
      ['2026-10-29', 'done', 2825],
      ['2026-10-30', 'done', 2705],
      ['2026-10-31', 'done', 2933],
      ['2026-11-01', 'in-progress', null],
    ],
  )
  const last = days[4]
  assert.equal(last.protein_g, null)
  assert.equal(last.sleep_h, 8)
  assert.equal(last.training, 'Lower A')
  assert.equal(days[0].protein_g, 225)
  assert.equal(days[0].fiber_g, 22)
  assert.equal(days[0].sleep_h, null)
})

test('meal tables: one meal per eaten row, continuation rows fold into the previous meal', () => {
  const days = loadFixtureNutrition()
  const by = (d: string) => days.find(x => x.date === d)!
  assert.deepEqual(days.map(d => d.meals.length), [6, 5, 5, 7, 5])
  for (const d of days) assert.deepEqual(d.unread, [], d.path)

  const dtf = by('2026-10-29').meals.find(m => m.slot === 'Dinner')!
  assert.equal(dtf.name, 'Din Tai Fung')
  assert.equal(dtf.items.length, 4)
  assert.equal(dtf.kcal, 1399)
  assert.equal(dtf.protein_g, 73.5)

  const sum = (d: string) => by(d).meals.reduce((n, m) => n + m.kcal, 0)
  assert.equal(sum('2026-10-28'), 2910)
  assert.equal(sum('2026-10-31'), 2933)
  assert.equal(sum('2026-11-01'), 1999)

  const lunch = by('2026-11-01').meals.find(m => m.slot === 'Lunch')!
  assert.equal(lunch.accuracy, 'weighed')
  assert.equal(lunch.name, "JT's Manukan Grille")
  const thai = by('2026-10-30').meals.find(m => m.slot === 'Dinner')!
  assert.equal(thai.name, 'Time For Thai, shared')
  assert.equal(by('2026-10-28').meals[0].name, '2 grilled white bread')
  assert.equal(by('2026-10-29').meals[0].name, 'Usual breakfast')
})
