/**
 * All reads and writes against Supabase for the screens. RLS scopes every
 * query to the signed-in user, so no user_id filters are needed here.
 */
import { supabase } from './supabase.ts'
import { EXERCISES, exerciseLoading } from './exercises.ts'
import { findSlot, PROGRAM_SLOTS, type Day } from './program.ts'
import { decide, type Verdict } from './progression.ts'
import type { LoggedExerciseRecord } from './progressRows.ts'
import { nextDay } from './sessionPlan.ts'
import { mealTotals, validateParseResponse, type MealCard, type MealItem, type ParseResponse, type SetCard, type Accuracy } from './logCards.ts'
import { sumMeals, type DayTotals } from './fuel.ts'
import { todayIso, timeHm } from './dates.ts'

// ---------------------------------------------------------------------------
// Types mirroring the tables

export interface SetEntry {
  reps: number
  load_kg?: number
  rest_pause?: boolean
}

export interface SessionExerciseRow {
  id: string
  session_id: string
  position: number
  exercise_key: string
  raw_name: string | null
  load_text: string | null
  load_kg: number | null
  implements: number
  sets: SetEntry[]
  programmed_sets: number | null
  rep_min: number | null
  rep_max: number | null
  target_reps: number | null
  next_aim: number | null
  verdict: Verdict | null
  next_load_text: string | null
  reason: string | null
  above_range: boolean | null
}

export interface SessionRow {
  id: string
  date: string
  day: Day
  source: 'vault' | 'app'
  status: 'in-progress' | 'done'
  started_at: string | null
  ended_at: string | null
  notes: string | null
  session_exercises: SessionExerciseRow[]
}

export interface MealRow {
  id: string
  nutrition_day_id: string
  position: number
  slot: string | null
  name: string
  items: MealItem[]
  kcal: number
  protein_g: number
  fiber_g: number | null
  accuracy: Accuracy | null
  logged_at: string
  source: 'vault' | 'app'
  raw_text: string | null
}

export interface DayRow {
  id: string
  date: string
  training: string | null
  kcal: number | null
  protein_g: number | null
  fiber_g: number | null
  sleep_h: number | null
  water_ml: number
  status: 'in-progress' | 'done' | null
  meals: MealRow[]
}

export interface LibraryRow {
  id: string
  name: string
  category: string | null
  portion: string | null
  kcal: number
  protein_g: number
  fiber_g: number | null
  accuracy: Accuracy | null
  items: MealItem[]
  notes: string | null
  times_eaten: number
  last_eaten: string | null
  source: 'sheet' | 'app'
}

export interface WeighInRow {
  id: string
  date: string
  kg: number
}

export interface LogEntryRow {
  id: string
  text: string
  kind: string | null
  card: unknown
  status: 'pending' | 'saved' | 'discarded' | 'error'
  saved_ref: { table: string; id: string } | null
  error: string | null
  created_at: string
}

function fail(table: string, error: { message: string } | null): never {
  throw new Error(`${table}: ${error?.message ?? 'unknown error'}`)
}

// ---------------------------------------------------------------------------
// Sessions

export async function fetchSessions(): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, date, day, source, status, started_at, ended_at, notes, session_exercises(*)')
    .order('date', { ascending: false })
  if (error) fail('sessions', error)
  const rows = (data ?? []) as unknown as SessionRow[]
  for (const s of rows) s.session_exercises.sort((a, b) => a.position - b.position)
  return rows
}

export function toLoggedRecords(sessions: SessionRow[]): LoggedExerciseRecord[] {
  const out: LoggedExerciseRecord[] = []
  for (const s of sessions) {
    if (s.status !== 'done') continue
    for (const e of s.session_exercises) {
      if (!e.verdict) continue
      out.push({
        exercise_key: e.exercise_key,
        date: s.date,
        day: s.day,
        load_text: e.load_text ?? '',
        sets: e.sets ?? [],
        verdict: e.verdict,
        next_load_text: e.next_load_text,
        reason: e.reason,
        target_reps: e.target_reps,
        above_range: e.above_range,
      })
    }
  }
  return out
}

export function lastDoneDay(sessions: SessionRow[]): Day | null {
  const done = sessions.filter(s => s.status === 'done').sort((a, b) => b.date.localeCompare(a.date))
  return done[0]?.day ?? null
}

export async function startSession(date: string, day: Day): Promise<SessionRow> {
  const { data, error } = await supabase
    .from('sessions')
    .upsert({ date, day, source: 'app', status: 'in-progress', started_at: new Date().toISOString() }, { onConflict: 'user_id,date,day' })
    .select('id, date, day, source, status, started_at, ended_at, notes, session_exercises(*)')
    .single()
  if (error) fail('sessions', error)
  return data as unknown as SessionRow
}

/** Previous session's carried aim for a lift (the note's "aim for 10"), if any. */
export function carriedAimFor(sessions: SessionRow[], exerciseKey: string, beforeDate: string, excludeSessionId?: string): number | null {
  const prior = sessions
    .filter(s => s.status === 'done' && s.date <= beforeDate && s.id !== excludeSessionId)
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const s of prior) {
    const e = s.session_exercises.find(x => x.exercise_key === exerciseKey)
    if (e) return e.next_aim ?? null
  }
  return null
}

export interface DecidedSet {
  verdict: Verdict
  target_reps: number
  next_load_text: string | null
  reason: string
  above_range: boolean
}

export function decideFor(day: Day, exerciseKey: string, sets: SetEntry[], loadKg: number | null, carriedAim: number | null): DecidedSet {
  const slot = findSlot(day, exerciseKey) ?? PROGRAM_SLOTS.find(s => s.exercise_key === exerciseKey) ?? null
  const programmedSets = slot?.sets ?? sets.length
  const repMin = slot?.rep_min ?? 8
  const repMax = slot?.rep_max ?? 12
  const d = decide({ sets, programmedSets, repMin, repMax, carriedAim, loading: exerciseLoading(exerciseKey), loadKg })
  return { verdict: d.verdict, target_reps: d.target, next_load_text: d.nextLoadText || null, reason: d.reason, above_range: d.aboveRange }
}

export function loadTextOf(loadKg: number | null, implementsN: number): string {
  if (loadKg === null) return 'Bodyweight'
  return implementsN > 1 ? `${implementsN} × ${loadKg}` : `${loadKg}`
}

export async function upsertSessionExercise(
  session: SessionRow,
  position: number,
  payload: { exercise_key: string; raw_name?: string | null; load_kg: number | null; implements: number; sets: SetEntry[] },
  decided: DecidedSet | null,
): Promise<SessionExerciseRow> {
  const slot = findSlot(session.day, payload.exercise_key)
  const row = {
    session_id: session.id,
    position,
    exercise_key: payload.exercise_key,
    raw_name: payload.raw_name ?? null,
    load_text: loadTextOf(payload.load_kg, payload.implements),
    load_kg: payload.load_kg,
    implements: payload.implements,
    sets: payload.sets,
    programmed_sets: slot?.sets ?? null,
    rep_min: slot?.rep_min ?? null,
    rep_max: slot?.rep_max ?? null,
    target_reps: decided?.target_reps ?? null,
    verdict: decided?.verdict ?? null,
    next_load_text: decided?.next_load_text ?? null,
    reason: decided?.reason ?? null,
    above_range: decided?.above_range ?? null,
  }
  const { data, error } = await supabase.from('session_exercises').upsert(row, { onConflict: 'session_id,position' }).select('*').single()
  if (error) fail('session_exercises', error)
  return data as SessionExerciseRow
}

export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').update({ status: 'done', ended_at: new Date().toISOString() }).eq('id', sessionId)
  if (error) fail('sessions', error)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
  if (error) fail('sessions', error)
}

/** Which day a quick-logged set belongs to: the only day with that lift, else the next day in rotation. */
export function inferDay(exerciseKey: string, sessions: SessionRow[]): Day {
  const days = [...new Set(PROGRAM_SLOTS.filter(s => s.exercise_key === exerciseKey).map(s => s.day))]
  if (days.length === 1) return days[0]
  const next = nextDay(lastDoneDay(sessions))
  return days.includes(next) ? next : days[0] ?? next
}

// ---------------------------------------------------------------------------
// Nutrition days and meals

export async function fetchDay(date: string): Promise<DayRow | null> {
  const { data, error } = await supabase
    .from('nutrition_days')
    .select('id, date, training, kcal, protein_g, fiber_g, sleep_h, water_ml, status, meals(*)')
    .eq('date', date)
    .maybeSingle()
  if (error) fail('nutrition_days', error)
  if (!data) return null
  const row = data as unknown as DayRow
  row.meals.sort((a, b) => a.position - b.position)
  return row
}

export async function fetchDays(): Promise<DayRow[]> {
  const { data, error } = await supabase
    .from('nutrition_days')
    .select('id, date, training, kcal, protein_g, fiber_g, sleep_h, water_ml, status, meals(*)')
    .order('date', { ascending: false })
  if (error) fail('nutrition_days', error)
  return (data ?? []) as unknown as DayRow[]
}

export async function ensureDay(date: string, training: string | null = null): Promise<DayRow> {
  const existing = await fetchDay(date)
  if (existing) return existing
  const { error } = await supabase.from('nutrition_days').upsert({ date, training, status: 'in-progress', water_ml: 0 }, { onConflict: 'user_id,date' })
  if (error) fail('nutrition_days', error)
  const row = await fetchDay(date)
  if (!row) throw new Error('nutrition day did not persist')
  return row
}

/** Today's totals: from meals when any are logged, else the day's stored totals. */
export function dayTotals(day: DayRow | null): DayTotals {
  if (!day) return { kcal: 0, protein_g: 0, fiber_g: 0, water_ml: 0 }
  if (day.meals.length > 0) return sumMeals(day.meals, day.water_ml)
  return { kcal: day.kcal ?? 0, protein_g: day.protein_g ?? 0, fiber_g: day.fiber_g ?? 0, water_ml: day.water_ml }
}

export async function recomputeDayTotals(dayId: string): Promise<void> {
  const { data, error } = await supabase.from('meals').select('kcal, protein_g, fiber_g').eq('nutrition_day_id', dayId)
  if (error) fail('meals', error)
  const t = sumMeals((data ?? []) as { kcal: number; protein_g: number; fiber_g: number | null }[])
  const { error: e2 } = await supabase.from('nutrition_days').update({ kcal: t.kcal, protein_g: t.protein_g, fiber_g: Math.round(t.fiber_g) }).eq('id', dayId)
  if (e2) fail('nutrition_days', e2)
}

export interface NewMeal {
  slot: string | null
  name: string
  items: MealItem[]
  raw_text: string | null
}

export async function addMeal(date: string, meal: NewMeal): Promise<MealRow> {
  const day = await ensureDay(date)
  const position = day.meals.reduce((m, x) => Math.max(m, x.position), 0) + 1
  const t = mealTotals(meal.items)
  const { data, error } = await supabase
    .from('meals')
    .insert({
      nutrition_day_id: day.id,
      position,
      slot: meal.slot,
      name: meal.name,
      items: meal.items,
      kcal: t.kcal,
      protein_g: t.protein_g,
      fiber_g: t.fiber_g,
      accuracy: t.accuracy,
      source: 'app',
      raw_text: meal.raw_text,
    })
    .select('*')
    .single()
  if (error) fail('meals', error)
  await recomputeDayTotals(day.id)
  return data as MealRow
}

export async function deleteMeal(meal: MealRow): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', meal.id)
  if (error) fail('meals', error)
  await recomputeDayTotals(meal.nutrition_day_id)
}

export async function addWater(date: string, ml: number): Promise<number> {
  const day = await ensureDay(date)
  const water_ml = day.water_ml + ml
  const { error } = await supabase.from('nutrition_days').update({ water_ml }).eq('id', day.id)
  if (error) fail('nutrition_days', error)
  return water_ml
}

export async function closeDay(dayId: string): Promise<void> {
  const { error } = await supabase.from('nutrition_days').update({ status: 'done' }).eq('id', dayId)
  if (error) fail('nutrition_days', error)
}

// ---------------------------------------------------------------------------
// Meal library

export async function fetchLibrary(): Promise<LibraryRow[]> {
  const { data, error } = await supabase.from('meal_library').select('*').order('times_eaten', { ascending: false }).order('name')
  if (error) fail('meal_library', error)
  return (data ?? []) as LibraryRow[]
}

export async function bumpLibrary(row: LibraryRow, date: string): Promise<void> {
  const { error } = await supabase.from('meal_library').update({ times_eaten: row.times_eaten + 1, last_eaten: date }).eq('id', row.id)
  if (error) fail('meal_library', error)
}

export async function saveToLibrary(card: MealCard, category: string | null): Promise<void> {
  const t = mealTotals(card.items)
  const { error } = await supabase.from('meal_library').upsert(
    {
      name: card.name,
      category,
      portion: card.items.map(i => i.name).join(', '),
      kcal: t.kcal,
      protein_g: t.protein_g,
      fiber_g: t.fiber_g,
      accuracy: t.accuracy,
      items: card.items,
      source: 'app',
    },
    { onConflict: 'user_id,name' },
  )
  if (error) fail('meal_library', error)
}

// ---------------------------------------------------------------------------
// Weigh-ins

export async function fetchWeighIns(): Promise<WeighInRow[]> {
  const { data, error } = await supabase.from('weigh_ins').select('id, date, kg').order('date')
  if (error) fail('weigh_ins', error)
  return (data ?? []) as WeighInRow[]
}

export async function upsertWeighIn(date: string, kg: number): Promise<void> {
  const { error } = await supabase.from('weigh_ins').upsert({ date, kg }, { onConflict: 'user_id,date' })
  if (error) fail('weigh_ins', error)
}

// ---------------------------------------------------------------------------
// Log entries and the parse function

export async function fetchLogEntries(limit = 40): Promise<LogEntryRow[]> {
  const { data, error } = await supabase.from('log_entries').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) fail('log_entries', error)
  return ((data ?? []) as LogEntryRow[]).reverse()
}

export async function insertLogEntry(text: string): Promise<LogEntryRow> {
  const { data, error } = await supabase.from('log_entries').insert({ text, status: 'pending' }).select('*').single()
  if (error) fail('log_entries', error)
  return data as LogEntryRow
}

export async function updateLogEntry(id: string, patch: Partial<Pick<LogEntryRow, 'kind' | 'card' | 'status' | 'saved_ref' | 'error'>>): Promise<void> {
  const { error } = await supabase.from('log_entries').update(patch).eq('id', id)
  if (error) fail('log_entries', error)
}

export interface ParseContextInput {
  sessions: SessionRow[]
  library: LibraryRow[]
  today: DayTotals | null
}

export function buildParseContext(input: ParseContextInput) {
  const recent: Record<string, string> = {}
  for (const s of [...input.sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const e of s.session_exercises) if (!(e.exercise_key in recent) && e.load_text) recent[e.exercise_key] = e.load_text
  }
  return {
    date: todayIso(),
    time: timeHm(),
    exercises: Object.entries(EXERCISES).map(([key, e]) => ({ key, name: e.name, loading: e.loading, aliases: e.aliases })),
    recent_loads: recent,
    meal_library: input.library.map(m => ({ name: m.name, portion: m.portion, kcal: m.kcal, protein_g: Number(m.protein_g), fiber_g: m.fiber_g === null ? null : Number(m.fiber_g), accuracy: m.accuracy ?? 'estimated' })),
    today: input.today,
  }
}

export async function parseLog(text: string, context: ReturnType<typeof buildParseContext>): Promise<ParseResponse> {
  const { data, error } = await supabase.functions.invoke('parse-log', { body: { text, context } })
  if (error) {
    let detail = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.text === 'function') {
      try {
        const t = await ctx.text()
        const j = JSON.parse(t) as { error?: string }
        if (j.error) detail = j.error
      } catch {
        /* keep message */
      }
    }
    throw new Error(detail)
  }
  return validateParseResponse(data, new Set(Object.keys(EXERCISES)))
}

/** Save a confirmed set card: into today's in-progress session, or a quick done session. */
export async function saveSetCard(card: SetCard, sessions: SessionRow[]): Promise<{ session: SessionRow; row: SessionExerciseRow; decided: DecidedSet }> {
  const date = todayIso()
  let session = sessions.find(s => s.date === date && s.status === 'in-progress') ?? null
  if (!session) {
    const day = inferDay(card.exercise_key, sessions)
    const existingToday = sessions.find(s => s.date === date && s.day === day) ?? null
    session = existingToday ?? (await startSession(date, day))
  }
  const position = session.session_exercises.reduce((m, x) => Math.max(m, x.position), 0) + 1
  const carried = carriedAimFor(sessions, card.exercise_key, date, session.id)
  const decided = decideFor(session.day, card.exercise_key, card.sets, card.load_kg, carried)
  const row = await upsertSessionExercise(session, position, card, decided)
  if (session.status === 'in-progress' && !sessions.some(s => s.id === session!.id)) {
    // a quick log outside the coach: close it right away
    await endSession(session.id)
    session = { ...session, status: 'done' }
  }
  return { session, row, decided }
}
