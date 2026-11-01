/**
 * One-time (and repeatable) import of the Obsidian logs into Supabase.
 *
 *   npm run import:vault
 *
 * Reads VAULT_ROOT/Health/Physique-Log (type: physique-session) and
 * VAULT_ROOT/Health/Nutrition-Log, runs the push-or-stay engine, and upserts
 * for IMPORT_USER_ID with the service-role key. Idempotent through the unique
 * keys: a second run reports 0 inserted, 0 changed. The live vault is read
 * only, never written.
 *
 * Env (.env.local): SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * IMPORT_USER_ID, VAULT_ROOT, optional SUPABASE_SCHEMA (default public).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { PROGRAM_SLOTS } from '../supabase/seed/program.ts'
import { parseDay } from '../src/lib/program.ts'
import { MEAL_LIBRARY } from '../supabase/seed/meals.ts'
import { parseFrontmatter, parseNutritionNote, parseSessionNote, sessionTotals } from '../src/lib/vaultParse.ts'
import { decideSessions, disagreements, countVerdicts } from '../src/lib/progression.ts'

// ---------------------------------------------------------------------------
// Env

function loadDotEnv(file: string) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, '$1')
  }
}
loadDotEnv(resolve(process.cwd(), '.env.local'))

function need(name: string, fallback?: string): string {
  const v = process.env[name] ?? (fallback ? process.env[fallback] : undefined)
  if (!v) {
    console.error(`Missing ${name}${fallback ? ` (or ${fallback})` : ''} in .env.local`)
    process.exit(2)
  }
  return v
}

// --dry-run parses and reports without touching Supabase (no credentials needed).
const DRY_RUN = process.argv.includes('--dry-run')
const VAULT_ROOT = need('VAULT_ROOT')
const SCHEMA = process.env.SUPABASE_SCHEMA || 'public'
const SUPABASE_URL = DRY_RUN ? '' : need('SUPABASE_URL', 'VITE_SUPABASE_URL')
const SERVICE_KEY = DRY_RUN ? '' : need('SUPABASE_SERVICE_ROLE_KEY')
// Either IMPORT_USER_ID (a UUID) or IMPORT_USER_EMAIL (looked up, created if missing).
const USER_ID_ENV = process.env.IMPORT_USER_ID?.trim() || ''
const USER_EMAIL = process.env.IMPORT_USER_EMAIL?.trim() || ''
if (!DRY_RUN && !USER_ID_ENV && !USER_EMAIL) {
  console.error('Set IMPORT_USER_ID or IMPORT_USER_EMAIL in .env.local')
  process.exit(2)
}
let USER_ID = DRY_RUN ? 'dry-run' : USER_ID_ENV

const supabase = DRY_RUN
  ? null
  : createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: SCHEMA },
    })

function db() {
  if (!supabase) throw new Error('no Supabase client in dry run')
  return supabase
}

/** Resolve IMPORT_USER_EMAIL to a user id, inviting the address if it has no account yet. */
async function resolveUser(): Promise<string> {
  if (USER_ID) return USER_ID
  const admin = db().auth.admin
  let page = 1
  for (;;) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`auth: ${error.message}`)
    const hit = data.users.find(u => u.email?.toLowerCase() === USER_EMAIL.toLowerCase())
    if (hit) return hit.id
    if (data.users.length < 200) break
    page++
  }
  const { data, error } = await admin.createUser({ email: USER_EMAIL, email_confirm: true })
  if (error || !data.user) throw new Error(`auth: could not create ${USER_EMAIL}: ${error?.message ?? 'unknown'}`)
  console.log(`Created user ${USER_EMAIL} (${data.user.id}); sign in with a magic link to that address.`)
  return data.user.id
}

// ---------------------------------------------------------------------------
// Read the vault

function readNotes(dir: string): { path: string; rel: string; md: string }[] {
  if (!existsSync(dir)) {
    console.error(`Folder not found: ${dir}`)
    process.exit(2)
  }
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => ({ path: join(dir, f), rel: `${dir.slice(VAULT_ROOT.length + 1).replace(/\\/g, '/')}/${f}`, md: readFileSync(join(dir, f), 'utf8') }))
}

// Notes the app itself exported (scripts/export-vault.ts) carry `source: iron-master`
// and are skipped, so the import never overwrites app rows with their own echo.
const notExported = (md: string) => parseFrontmatter(md).source !== 'iron-master'

const allSessionNotes = readNotes(join(VAULT_ROOT, 'Health', 'Physique-Log')).filter(
  n => parseFrontmatter(n.md).type === 'physique-session' && notExported(n.md),
)
// Walks and other non-lifting sessions (day: Walk) have no program slot and no
// place in `sessions`, whose day is one of the four lifting days. Skip and report them.
const isLiftingDay = (md: string) => parseDay(parseFrontmatter(md).day) !== null
const sessionNotes = allSessionNotes.filter(n => isLiftingDay(n.md))
const skippedSessions = allSessionNotes.filter(n => !isLiftingDay(n.md)).map(n => `${n.rel} (day: ${parseFrontmatter(n.md).day ?? ''})`)
const nutritionNotes = readNotes(join(VAULT_ROOT, 'Health', 'Nutrition-Log')).filter(
  n => parseFrontmatter(n.md).type === 'nutrition-day' && notExported(n.md),
)

const parsedSessions = sessionNotes.map(n => parseSessionNote(n.md, n.rel))
const nutritionDays = nutritionNotes.map(n => parseNutritionNote(n.md, n.rel))
const decided = decideSessions(parsedSessions)

const unread = [...parsedSessions.flatMap(s => s.unread), ...nutritionDays.flatMap(d => d.unread)]
const mealCount = nutritionDays.reduce((n, d) => n + d.meals.length, 0)
const totals = sessionTotals(parsedSessions)
const verdicts = countVerdicts(decided)
const disagree = disagreements(decided)

// ---------------------------------------------------------------------------
// Upsert helpers that count inserted / changed / unchanged

type Row = Record<string, unknown>
const counts = { inserted: 0, changed: 0, unchanged: 0 }

/** Stable JSON: Postgres jsonb reorders object keys, so compare with sorted keys. */
function canon(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canon).join(',')}]`
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>
    return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`
  }
  return JSON.stringify(x)
}

function same(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b)
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b
  if (typeof a === 'object' || typeof b === 'object') return canon(a) === canon(b)
  return a === b
}

function differs(existing: Row, incoming: Row): boolean {
  return Object.keys(incoming).some(k => !same(incoming[k], existing[k]))
}

async function upsertRows(table: string, keyOf: (r: Row) => string, existing: Row[], incoming: Row[], onConflict: string) {
  const byKey = new Map(existing.map(r => [keyOf(r), r]))
  const toWrite: Row[] = []
  for (const row of incoming) {
    const cur = byKey.get(keyOf(row))
    if (!cur) {
      counts.inserted++
      toWrite.push(row)
    } else if (differs(cur, row)) {
      counts.changed++
      toWrite.push({ ...row, id: cur.id })
    } else {
      counts.unchanged++
    }
  }
  if (toWrite.length && !DRY_RUN) {
    // PostgREST fills keys missing from some rows of a bulk upsert with null,
    // so a batch mixing new rows (no id) and changed rows (with id) would write
    // id = null. Send the two groups separately.
    const fresh = toWrite.filter(r => r.id === undefined)
    const changed = toWrite.filter(r => r.id !== undefined)
    for (const batch of [fresh, changed]) {
      if (!batch.length) continue
      const { error } = await db().from(table).upsert(batch, { onConflict })
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }
}

interface QueryResult {
  data: unknown
  error: { message: string } | null
}

async function rowsOf(table: string, query: PromiseLike<QueryResult>): Promise<Row[]> {
  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data as Row[] | null) ?? []
}

function existingFor(table: string): Promise<Row[]> {
  if (DRY_RUN) return Promise.resolve([])
  return rowsOf(table, db().from(table).select('*').eq('user_id', USER_ID))
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  console.log(`Iron Master · vault import${DRY_RUN ? ' (dry run)' : ''}`)
  console.log(`  vault:  ${VAULT_ROOT}`)
  console.log(`  schema: ${SCHEMA}`)
  if (!DRY_RUN) {
    USER_ID = await resolveUser()
    console.log(`  user:   ${USER_ID}`)
  }
  console.log('')
  console.log(`Parsed ${totals.sessions} sessions, ${totals.exercises} exercises, ${totals.sets} sets, ${totals.reps} reps`)
  if (skippedSessions.length) {
    console.log(`Skipped ${skippedSessions.length} non-lifting session${skippedSessions.length === 1 ? '' : 's'}:`)
    for (const s of skippedSessions) console.log(`  ${s}`)
  }
  console.log(`Engine: ${verdicts.push} push · ${verdicts.stay} stay · ${verdicts.progress_bw} bodyweight progression`)
  console.log(`Nutrition: ${nutritionDays.length} days (${nutritionDays.filter(d => d.status === 'done').length} done, ${nutritionDays.filter(d => d.status === 'in-progress').length} in progress), ${mealCount} meals`)
  console.log(`Meal library: ${MEAL_LIBRARY.length} seed meals`)
  if (disagree.length) {
    console.log(`Verdict disagreements: ${disagree.length}`)
    for (const e of disagree) console.log(`  ${e.exercise_key}: note says ${e.logged_verdict}, engine says ${e.decision.verdict}`)
  } else {
    console.log('Verdict disagreements: 0')
  }
  if (unread.length) {
    console.log(`Unread lines: ${unread.length}`)
    for (const u of unread) console.log(`  ${u}`)
  } else {
    console.log('Unread lines: 0')
  }
  console.log('')

  // program_slots
  const existingSlots = await existingFor('program_slots')
  await upsertRows(
    'program_slots',
    r => `${r.day}/${r.position}`,
    existingSlots,
    PROGRAM_SLOTS.map(s => ({ user_id: USER_ID, ...s })),
    'user_id,day,position',
  )

  // sessions
  const existingSessions = await existingFor('sessions')
  await upsertRows(
    'sessions',
    r => `${r.date}/${r.day}`,
    existingSessions,
    decided.map(s => ({ user_id: USER_ID, date: s.date, day: s.day, source: 'vault', source_path: s.path })),
    'user_id,date,day',
  )
  const sessionsNow = await existingFor('sessions')
  const sessionId = new Map(sessionsNow.map(s => [`${s.date}/${s.day}`, s.id as string]))
  if (DRY_RUN) for (const s of decided) sessionId.set(`${s.date}/${s.day}`, `dry-${s.date}-${s.day}`)

  // session_exercises
  const ids = [...sessionId.values()]
  const existingEx =
    ids.length && !DRY_RUN
      ? await rowsOf('session_exercises', db().from('session_exercises').select('*').in('session_id', ids))
      : []
  const incomingEx: Row[] = []
  for (const s of decided) {
    const sid = sessionId.get(`${s.date}/${s.day}`)
    if (!sid) throw new Error(`session ${s.date} ${s.day} missing after upsert`)
    for (const e of s.exercises) {
      incomingEx.push({
        session_id: sid,
        position: e.position,
        exercise_key: e.exercise_key,
        raw_name: e.raw_name,
        load_text: e.load_text,
        load_kg: e.load_kg,
        implements: e.implements,
        sets: e.sets,
        programmed_sets: e.programmed_sets,
        rep_min: e.rep_min,
        rep_max: e.rep_max,
        target_reps: e.decision.target,
        logged_verdict: e.logged_verdict,
        logged_next: e.logged_next,
        next_aim: e.next_aim,
        verdict: e.decision.verdict,
        next_load_text: e.decision.nextLoadText || null,
        reason: e.decision.reason,
        above_range: e.decision.aboveRange,
      })
    }
  }
  await upsertRows('session_exercises', r => `${r.session_id}/${r.position}`, existingEx, incomingEx, 'session_id,position')

  // nutrition_days
  const existingDays = await existingFor('nutrition_days')
  await upsertRows(
    'nutrition_days',
    r => String(r.date),
    existingDays,
    nutritionDays.map(d => ({
      user_id: USER_ID,
      date: d.date,
      training: d.training,
      kcal: d.kcal,
      protein_g: d.protein_g,
      fiber_g: d.fiber_g,
      sleep_h: d.sleep_h,
      status: d.status,
      source_path: d.path,
    })),
    'user_id,date',
  )

  // meals (under their nutrition day)
  const daysNow = await existingFor('nutrition_days')
  const dayId = new Map(daysNow.map(d => [String(d.date), d.id as string]))
  if (DRY_RUN) for (const d of nutritionDays) dayId.set(d.date, `dry-${d.date}`)
  const dayIds = [...dayId.values()]
  const existingMeals =
    dayIds.length && !DRY_RUN
      ? await rowsOf('meals', db().from('meals').select('*').in('nutrition_day_id', dayIds))
      : []
  const incomingMeals: Row[] = []
  for (const d of nutritionDays) {
    const id = dayId.get(d.date)
    if (!id) throw new Error(`nutrition day ${d.date} missing after upsert`)
    for (const m of d.meals) {
      incomingMeals.push({
        nutrition_day_id: id,
        position: m.position,
        slot: m.slot,
        name: m.name,
        items: m.items,
        kcal: m.kcal,
        protein_g: m.protein_g,
        fiber_g: m.fiber_g,
        accuracy: m.accuracy,
        source: 'vault',
        raw_text: m.raw_text,
      })
    }
  }
  await upsertRows('meals', r => `${r.nutrition_day_id}/${r.position}`, existingMeals, incomingMeals, 'nutrition_day_id,position')

  // meal_library (seed from the facts sheet; app-added rows are left alone)
  const existingLib = await existingFor('meal_library')
  await upsertRows(
    'meal_library',
    r => String(r.name),
    existingLib.filter(r => r.source === 'sheet'),
    MEAL_LIBRARY.map(m => ({
      user_id: USER_ID,
      name: m.name,
      category: m.category,
      portion: m.portion,
      kcal: m.kcal,
      protein_g: m.protein_g,
      fiber_g: m.fiber_g,
      accuracy: m.accuracy,
      items: m.items,
      notes: m.notes,
      source: 'sheet',
    })),
    'user_id,name',
  )

  console.log(
    DRY_RUN
      ? `Would write ${counts.inserted} rows (dry run, nothing compared against the database)`
      : `Rows: ${counts.inserted} inserted · ${counts.changed} changed · ${counts.unchanged} unchanged`,
  )
  if (unread.length) {
    console.error('\nSome lines could not be read. Fix the notes or the parser, then rerun.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
