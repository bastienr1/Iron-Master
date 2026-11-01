/**
 * Vault note parser: markdown string in, structured data out. Pure: no React,
 * Supabase, Node or DOM. Anything it cannot read lands in `unread`; it never
 * guesses.
 *
 * Expected shapes (as of 1 Nov 2026):
 *   Session notes  — frontmatter `type: physique-session`, `date`, `day`, then a
 *                    table whose header starts `Exercise | Weight (kg) | Sets × reps`
 *                    with optional `Program range` and `Next session` columns.
 *                    Upper B also has a `## Lateral raises` table
 *                    (`Set | Style | Weight (kg) | Reps`) that becomes ONE exercise.
 *   Nutrition notes — frontmatter only: `date`, `training`, `kcal`, `protein_g`,
 *                    `fiber_g`, `sleep_h`, `status`.
 */

import { resolveExercise } from './exercises.ts'
import { findSlot, parseDay, type Day } from './program.ts'

export type LoggedVerdict = 'push' | 'stay'

export interface ParsedSet {
  reps: number
  load_kg?: number
  rest_pause?: boolean
}

export interface ParsedExercise {
  position: number
  exercise_key: string
  raw_name: string
  load_text: string
  load_kg: number | null
  implements: number
  sets: ParsedSet[]
  programmed_sets: number
  rep_min: number
  rep_max: number
  logged_verdict: LoggedVerdict | null
  logged_next: string | null
  /** "aim for 10 per set" → 10, carried to the next session of the same exercise. */
  next_aim: number | null
}

export interface ParsedSession {
  date: string
  day: Day
  path: string
  exercises: ParsedExercise[]
  unread: string[]
}

export interface ParsedNutritionDay {
  date: string
  path: string
  training: string | null
  kcal: number | null
  protein_g: number | null
  fiber_g: number | null
  sleep_h: number | null
  status: 'in-progress' | 'done' | null
}

// ---------------------------------------------------------------------------
// Frontmatter

export function parseFrontmatter(markdown: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = markdown.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return out
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '---') break
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1')
  }
  return out
}

function numberOrNull(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Tables

interface Table {
  header: string[]
  rows: { cells: string[]; line: string }[]
  /** The nearest `## heading` above the table, lower-cased, or ''. */
  section: string
}

function splitRow(line: string): string[] {
  const t = line.trim()
  const inner = t.startsWith('|') ? t.slice(1) : t
  const body = inner.endsWith('|') ? inner.slice(0, -1) : inner
  return body.split('|').map(c => c.trim())
}

function isSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}/.test(line) && /^[\s|:-]+$/.test(line)
}

export function extractTables(markdown: string): Table[] {
  const lines = markdown.split(/\r?\n/)
  const tables: Table[] = []
  let section = ''
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const h = /^##\s+(.*)$/.exec(line)
    if (h) section = h[1].trim().toLowerCase()
    if (line.trim().startsWith('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = splitRow(line)
      const rows: Table['rows'] = []
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push({ cells: splitRow(lines[i]), line: lines[i] })
        i++
      }
      tables.push({ header, rows, section })
      continue
    }
    i++
  }
  return tables
}

function col(header: string[], name: string): number {
  const want = name.toLowerCase()
  return header.findIndex(h => h.toLowerCase().replace(/\*\*/g, '').trim() === want)
}

// ---------------------------------------------------------------------------
// Cells

export interface ParsedLoad {
  load_text: string
  load_kg: number | null
  implements: number
}

export function parseLoadCell(cell: string): ParsedLoad | null {
  const text = cell.trim()
  const plain = text.replace(/\*\*/g, '').replace(/\s*kg\s*$/i, '').trim()
  let m = /^(\d+(?:\.\d+)?)$/.exec(plain)
  if (m) return { load_text: text, load_kg: Number(m[1]), implements: 1 }
  m = /^(\d+)\s*[×x]\s*(\d+(?:\.\d+)?)(?:\s*\(.*\))?$/.exec(plain)
  if (m) return { load_text: text, load_kg: Number(m[2]), implements: Number(m[1]) }
  if (/^(bodyweight|bw)\b/i.test(plain)) {
    const add = /\+\s*(\d+(?:\.\d+)?)\s*kg/i.exec(plain)
    return { load_text: text, load_kg: add ? Number(add[1]) : null, implements: 1 }
  }
  return null
}

export function parseRepsCell(cell: string): ParsedSet[] | null {
  let text = cell.trim()
  const sets: ParsedSet[] = []
  const bonus: ParsedSet[] = []
  const bonusRe = /\+\s*bonus set of (\d+)/gi
  let b: RegExpExecArray | null
  while ((b = bonusRe.exec(text))) bonus.push({ reps: Number(b[1]) })
  text = text.replace(bonusRe, '')
  text = text.replace(/\([^)]*\)/g, ' ')
  for (const tokenRaw of text.split(',')) {
    const token = tokenRaw.trim()
    if (!token) continue
    let m = /^(\d+)\s*\+\s*(\d+)$/.exec(token)
    if (m) {
      sets.push({ reps: Number(m[1]) + Number(m[2]), rest_pause: true })
      continue
    }
    m = /^(\d+)(?:\s+[A-Za-z].*)?$/.exec(token)
    if (m) {
      sets.push({ reps: Number(m[1]) })
      continue
    }
    return null
  }
  if (sets.length === 0) return null
  return [...sets, ...bonus]
}

export interface ParsedRange {
  sets: number
  rep_min: number
  rep_max: number
}

export function parseRangeCell(cell: string): ParsedRange | null {
  const m = /(\d+)\s*[×x]\s*(\d+)(?:\s*[–—-]\s*(\d+))?/.exec(cell)
  if (!m) return null
  const min = Number(m[2])
  return { sets: Number(m[1]), rep_min: min, rep_max: m[3] ? Number(m[3]) : min }
}

export function parseLoggedVerdict(cell: string): LoggedVerdict | null {
  if (cell.includes('⬆')) return 'push' // ⬆
  if (cell.includes('➡')) return 'stay' // ➡
  return null
}

/**
 * "aim for 10 per set" → 10; "aim 8–10" → 10; "aim 8, 8, 7, 7" (per-set plan)
 * → null. The `(?!\d)` stops "aim 10, 8" from backtracking to 1.
 */
const AIM_RE = /aim(?: for)? (\d+)(?:[–-](\d+))?(?!\d)(?!\s*,)/i

export function parseAim(cell: string): number | null {
  const m = AIM_RE.exec(cell)
  if (!m) return null
  return Number(m[2] ?? m[1])
}

// ---------------------------------------------------------------------------
// Notes

export function parseSessionNote(markdown: string, path: string): ParsedSession {
  const fm = parseFrontmatter(markdown)
  const unread: string[] = []
  const day = parseDay(fm.day)
  const date = fm.date ?? ''
  if (!day) unread.push(`${path}: frontmatter day "${fm.day ?? ''}" not recognised`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) unread.push(`${path}: frontmatter date "${date}" not recognised`)
  const exercises: ParsedExercise[] = []
  if (!day) return { date, day: 'upper_a', path, exercises, unread }

  let position = 0
  for (const table of extractTables(markdown)) {
    const cEx = col(table.header, 'Exercise')
    const cSet = col(table.header, 'Set')
    if (cEx >= 0) {
      const cLoad = col(table.header, 'Weight (kg)')
      const cReps = col(table.header, 'Sets × reps')
      const cRange = col(table.header, 'Program range')
      const cNext = col(table.header, 'Next session')
      if (cLoad < 0 || cReps < 0) {
        unread.push(`${path}: table header missing Weight (kg) / Sets × reps: ${table.header.join(' | ')}`)
        continue
      }
      for (const row of table.rows) {
        const rawName = row.cells[cEx] ?? ''
        if (/^\*\*?total/i.test(rawName)) continue
        const key = resolveExercise(rawName)
        const load = parseLoadCell(row.cells[cLoad] ?? '')
        const sets = parseRepsCell(row.cells[cReps] ?? '')
        const rangeText = cRange >= 0 ? row.cells[cRange] ?? '' : ''
        let range = rangeText ? parseRangeCell(rangeText) : null
        if (!range && key) {
          const slotDef = findSlot(day, key)
          if (slotDef) range = { sets: slotDef.sets, rep_min: slotDef.rep_min, rep_max: slotDef.rep_max }
        }
        const problems: string[] = []
        if (!key) problems.push(`exercise "${rawName}"`)
        if (!load) problems.push(`weight "${row.cells[cLoad] ?? ''}"`)
        if (!sets) problems.push(`reps "${row.cells[cReps] ?? ''}"`)
        if (!range) problems.push(`range "${rangeText}" (no program slot either)`)
        if (!key || !load || !sets || !range) {
          unread.push(`${path}: could not read ${problems.join(', ')} — ${row.line.trim()}`)
          continue
        }
        const next = cNext >= 0 ? (row.cells[cNext] ?? '').trim() : ''
        position++
        exercises.push({
          position,
          exercise_key: key,
          raw_name: rawName,
          load_text: load.load_text,
          load_kg: load.load_kg,
          implements: load.implements,
          sets,
          programmed_sets: range.sets,
          rep_min: range.rep_min,
          rep_max: range.rep_max,
          logged_verdict: next ? parseLoggedVerdict(next) : null,
          logged_next: next || null,
          next_aim: next ? parseAim(next) : null,
        })
      }
    } else if (cSet >= 0 && table.section) {
      // A per-set table under a heading that names the exercise ("## Lateral raises").
      const key = resolveExercise(table.section)
      const cLoad = col(table.header, 'Weight (kg)')
      const cReps = col(table.header, 'Reps')
      if (!key || cLoad < 0 || cReps < 0) {
        unread.push(`${path}: per-set table under "${table.section}" not understood`)
        continue
      }
      const sets: ParsedSet[] = []
      let ok = true
      for (const row of table.rows) {
        const load = Number(row.cells[cLoad])
        const reps = Number(row.cells[cReps])
        if (!Number.isFinite(load) || !Number.isInteger(reps)) {
          unread.push(`${path}: could not read set row — ${row.line.trim()}`)
          ok = false
          continue
        }
        sets.push({ reps, load_kg: load })
      }
      if (!ok || sets.length === 0) continue
      const slotDef = findSlot(day, key)
      if (!slotDef) {
        unread.push(`${path}: no program slot for ${key} on ${day}`)
        continue
      }
      const loads = sets.map(s => s.load_kg as number)
      const lo = Math.min(...loads)
      const hi = Math.max(...loads)
      position++
      exercises.push({
        position,
        exercise_key: key,
        raw_name: table.section,
        load_text: lo === hi ? String(lo) : `${lo}–${hi}`,
        load_kg: null,
        implements: 1,
        sets,
        programmed_sets: slotDef.sets,
        rep_min: slotDef.rep_min,
        rep_max: slotDef.rep_max,
        logged_verdict: null,
        logged_next: null,
        next_aim: null,
      })
    }
  }
  return { date, day, path, exercises, unread }
}

export function parseNutritionNote(markdown: string, path: string): ParsedNutritionDay {
  const fm = parseFrontmatter(markdown)
  const status = fm.status === 'done' || fm.status === 'in-progress' ? fm.status : null
  return {
    date: fm.date ?? '',
    path,
    training: fm.training?.trim() || null,
    kcal: numberOrNull(fm.kcal),
    protein_g: numberOrNull(fm.protein_g),
    fiber_g: numberOrNull(fm.fiber_g),
    sleep_h: numberOrNull(fm.sleep_h),
    status,
  }
}

/** Convenience totals for summaries and tests. */
export function sessionTotals(sessions: ParsedSession[]) {
  let exercises = 0
  let sets = 0
  let reps = 0
  for (const s of sessions) {
    exercises += s.exercises.length
    for (const e of s.exercises) {
      sets += e.sets.length
      for (const st of e.sets) reps += st.reps
    }
  }
  return { sessions: sessions.length, exercises, sets, reps }
}
