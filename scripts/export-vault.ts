/**
 * Writes sessions and nutrition days logged in the app back into the vault,
 * in the same note format the hand-written logs use, so the Obsidian
 * dashboards and the Sunday recap keep working.
 *
 *   npm run export:vault            # writes new notes
 *   npm run export:vault -- --dry-run
 *
 * Rules: only finished sessions (status done) and closed days (status done)
 * with source 'app' are written; an existing file is never overwritten; each
 * note carries `source: iron-master` so the import script skips it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { exerciseName } from '../src/lib/exercises.ts'
import { DAY_LABEL, findSlot, type Day } from '../src/lib/program.ts'
import { activityText, type ActivityKind } from '../src/lib/logCards.ts'

function loadDotEnv(file: string) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, '$1')
  }
}
loadDotEnv(resolve(process.cwd(), '.env.local'))

const DRY_RUN = process.argv.includes('--dry-run')
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const vault = process.env.VAULT_ROOT
const email = process.env.IMPORT_USER_EMAIL
const userIdEnv = process.env.IMPORT_USER_ID
if (!url || !key || !vault || (!email && !userIdEnv)) {
  console.error('Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAULT_ROOT and IMPORT_USER_EMAIL (or IMPORT_USER_ID) in .env.local')
  process.exit(2)
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function userId(): Promise<string> {
  if (userIdEnv) return userIdEnv
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (error) throw new Error(error.message)
  const u = data.users.find(x => x.email?.toLowerCase() === email!.toLowerCase())
  if (!u) throw new Error(`no user ${email}`)
  return u.id
}

const FOCUS: Record<Day, string> = {
  upper_a: 'heavy',
  lower_a: 'heavy',
  upper_b: 'size — shoulders and arms',
  lower_b: 'volume',
}

interface Ex {
  position: number
  exercise_key: string
  raw_name: string | null
  load_text: string | null
  sets: { reps: number; rest_pause?: boolean }[]
  programmed_sets: number | null
  rep_min: number | null
  rep_max: number | null
  verdict: 'push' | 'stay' | 'progress_bw' | null
  next_load_text: string | null
  reason: string | null
  target_reps: number | null
}

interface Session {
  id: string
  date: string
  day: Day
  status: string
  source: string
  source_path: string | null
  session_exercises: Ex[]
}

interface Meal {
  position: number
  slot: string | null
  name: string
  raw_text: string | null
  items: { name: string; grams: number | null }[]
  kcal: number
  protein_g: number
}

interface NDay {
  id: string
  date: string
  training: string | null
  kcal: number | null
  protein_g: number | null
  fiber_g: number | null
  sleep_h: number | null
  water_ml: number
  status: string | null
  source_path: string | null
  meals: Meal[]
}

interface Activity {
  id: string
  date: string
  kind: ActivityKind
  minutes: number | null
  km: number | null
  steps: number | null
  note: string | null
}

function activityLines(acts: Activity[]): string {
  return acts.map(a => `- ${activityText({ ...a, activity: a.kind, km: a.km === null ? null : Number(a.km) })}${a.note ? ` — ${a.note}` : ''}`).join('\n')
}

function repsCell(sets: Ex['sets']): string {
  return sets.map(s => (s.rest_pause ? `${s.reps} (rest-pause)` : String(s.reps))).join(', ')
}

function rangeCell(e: Ex, day: Day): string {
  const slot = findSlot(day, e.exercise_key)
  const sets = e.programmed_sets ?? slot?.sets ?? e.sets.length
  const min = e.rep_min ?? slot?.rep_min
  const max = e.rep_max ?? slot?.rep_max
  if (min === undefined || min === null) return ''
  const reps = min === max ? `${min}` : `${min}–${max}`
  return `${sets} × ${reps}${slot?.per_side ? ' per side' : ''}`
}

function nextCell(e: Ex): string {
  switch (e.verdict) {
    case 'push':
      return `⬆️ Top of range hit: ${e.next_load_text ?? 'add load'}${e.target_reps ? `, aim for ${e.target_reps} per set` : ''}`
    case 'stay':
      return `➡️ Same weight, ${e.reason ?? 'beat last time first'}`
    case 'progress_bw':
      return 'Slow the tempo or add a light weight'
    default:
      return ''
  }
}

function sessionNote(s: Session): string {
  const rows = s.session_exercises
    .sort((a, b) => a.position - b.position)
    .map(e => `| ${e.raw_name ?? exerciseName(e.exercise_key)} | ${e.load_text ?? ''} | ${repsCell(e.sets)} | ${rangeCell(e, s.day)} | ${nextCell(e)} |`)
    .join('\n')
  return `---
type: physique-session
date: ${s.date}
day: ${DAY_LABEL[s.day]}
focus: ${FOCUS[s.day]}
status: done
source: iron-master
---

# ${DAY_LABEL[s.day]} — ${s.date}

Part of [[Physique-Program-Lean-Bulk]]. Logged in Iron Master. Nutrition: [[${s.date}]].

| Exercise | Weight (kg) | Sets × reps | Program range | Next session |
|---|---|---|---|---|
${rows}

## Notes

- Logged set by set in the Iron Master session coach. Verdicts from the double-progression engine.
`
}

function nutritionNote(d: NDay, trainingLabel: string | null, acts: Activity[]): string {
  const rows = d.meals
    .sort((a, b) => a.position - b.position)
    .map(m => `| ${m.slot ?? ''} | ${m.raw_text ?? (m.items.map(i => (i.grams ? `${i.name} ${i.grams} g` : i.name)).join(', ') || m.name)} | ${m.kcal} | ${m.protein_g} |`)
    .join('\n')
  const kcal = d.kcal ?? d.meals.reduce((n, m) => n + m.kcal, 0)
  const prot = d.protein_g ?? Math.round(d.meals.reduce((n, m) => n + Number(m.protein_g), 0))
  return `---
type: nutrition-day
date: ${d.date}
training: ${trainingLabel ?? d.training ?? 'Rest day'}
kcal: ${kcal}
protein_g: ${prot}
fiber_g: ${d.fiber_g ?? ''}
water_ml: ${d.water_ml}
${d.sleep_h !== null ? `sleep_h: ${d.sleep_h}\n` : ''}status: ${d.status ?? 'done'}
source: iron-master
---

# Nutrition — ${d.date}

Part of [[Physique-Program-Lean-Bulk]]. Targets: ~2,750 kcal · 150–165 g protein · 30+ g fiber. Logged in Iron Master.

| Meal | Food | kcal | Protein (g) |
|---|---|---|---|
${rows}
| **Total** | | **~${kcal.toLocaleString('en-US')}** | **~${prot}** |

${acts.length ? `## Activity

${activityLines(acts)}

` : ''}## Notes

- Figures are estimates unless taken from a label. Accuracy per item is kept in the app.
`
}

async function main() {
  const uid = await userId()
  const { data: sData, error: sErr } = await supabase
    .from('sessions')
    .select('id, date, day, status, source, source_path, session_exercises(*)')
    .eq('user_id', uid)
    .eq('source', 'app')
    .eq('status', 'done')
    .is('source_path', null)
  if (sErr) throw new Error(sErr.message)
  const { data: dData, error: dErr } = await supabase
    .from('nutrition_days')
    .select('id, date, training, kcal, protein_g, fiber_g, sleep_h, water_ml, status, source_path, meals(*)')
    .eq('user_id', uid)
    .is('source_path', null)
  if (dErr) throw new Error(dErr.message)
  const { data: aData, error: aErr } = await supabase
    .from('activities')
    .select('id, date, kind, minutes, km, steps, note')
    .eq('user_id', uid)
    .eq('source', 'app')
    .is('source_path', null)
    .order('logged_at')
  if (aErr) throw new Error(aErr.message)
  const sessions = (sData ?? []) as unknown as Session[]
  const days = (dData ?? []) as unknown as NDay[]
  const activities = (aData ?? []) as unknown as Activity[]

  const physDir = join(vault!, 'Health', 'Physique-Log')
  const nutDir = join(vault!, 'Health', 'Nutrition-Log')
  if (!DRY_RUN) {
    mkdirSync(physDir, { recursive: true })
    mkdirSync(nutDir, { recursive: true })
  }
  let written = 0
  let skipped = 0

  for (const s of sessions) {
    const rel = `Health/Physique-Log/${s.date} ${DAY_LABEL[s.day]}.md`
    const file = join(vault!, rel)
    if (existsSync(file)) {
      console.log(`skip (exists)  ${rel}`)
      skipped++
      continue
    }
    console.log(`${DRY_RUN ? 'would write' : 'write'}  ${rel}  (${s.session_exercises.length} exercises)`)
    if (!DRY_RUN) {
      writeFileSync(file, sessionNote(s), 'utf8')
      await supabase.from('sessions').update({ source_path: rel }).eq('id', s.id)
    }
    written++
  }

  for (const d of days) {
    if (d.status !== 'done') {
      console.log(`skip (in progress) Health/Nutrition-Log/${d.date}.md`)
      skipped++
      continue
    }
    const rel = `Health/Nutrition-Log/${d.date}.md`
    const file = join(vault!, rel)
    if (existsSync(file)) {
      console.log(`skip (exists)  ${rel}`)
      skipped++
      continue
    }
    const trainedDay = sessions.find(s => s.date === d.date)
    const acts = activities.filter(a => a.date === d.date)
    console.log(`${DRY_RUN ? 'would write' : 'write'}  ${rel}  (${d.meals.length} meals${acts.length ? `, ${acts.length} activities` : ''})`)
    if (!DRY_RUN) {
      writeFileSync(file, nutritionNote(d, trainedDay ? DAY_LABEL[trainedDay.day] : null, acts), 'utf8')
      await supabase.from('nutrition_days').update({ source_path: rel }).eq('id', d.id)
      if (acts.length) await supabase.from('activities').update({ source_path: rel }).in('id', acts.map(a => a.id))
    }
    written++
  }
  console.log(`${DRY_RUN ? 'Would write' : 'Wrote'} ${written} note(s), skipped ${skipped}.`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
