/**
 * Builds the rows the Push-or-stay screen shows: one per exercise from its
 * latest session, plus a New row for every program slot never logged.
 * Pure: works on plain records so both the screen (Supabase rows) and the tests
 * (fixtures) can use it.
 */

import { exerciseName } from './exercises.ts'
import { DAY_LABEL, PROGRAM_SLOTS, type Day } from './program.ts'
import type { Verdict } from './progression.ts'

export interface LoggedExerciseRecord {
  exercise_key: string
  date: string // YYYY-MM-DD
  day: Day
  load_text: string
  sets: { reps: number; load_kg?: number; rest_pause?: boolean }[]
  verdict: Verdict
  next_load_text: string | null
  reason: string | null
  target_reps: number | null
  above_range: boolean | null
}

export type ProgressFilter = 'push' | 'stay' | 'new'

export interface ProgressRow {
  key: string
  name: string
  filter: ProgressFilter
  verdict: Verdict | null
  bodyweight: boolean
  day: Day
  dayLabel: string
  date: string | null
  loadText: string | null
  nextLoadText: string | null
  reason: string | null
  reps: number[]
  aboveRange: boolean
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]}`
}

export function buildProgressRows(records: LoggedExerciseRecord[]): ProgressRow[] {
  const latest = new Map<string, LoggedExerciseRecord>()
  for (const r of records) {
    const cur = latest.get(r.exercise_key)
    if (!cur || r.date > cur.date) latest.set(r.exercise_key, r)
  }
  const rows: ProgressRow[] = []
  for (const [key, r] of latest) {
    const bodyweight = r.verdict === 'progress_bw'
    rows.push({
      key,
      name: exerciseName(key),
      filter: r.verdict === 'push' ? 'push' : 'stay',
      verdict: r.verdict,
      bodyweight,
      day: r.day,
      dayLabel: DAY_LABEL[r.day],
      date: r.date,
      loadText: r.load_text,
      nextLoadText: r.next_load_text,
      reason: r.reason,
      reps: r.sets.map(s => s.reps),
      aboveRange: Boolean(r.above_range),
    })
  }
  const seenNew = new Set<string>()
  for (const s of PROGRAM_SLOTS) {
    if (latest.has(s.exercise_key) || seenNew.has(s.exercise_key)) continue
    seenNew.add(s.exercise_key)
    rows.push({
      key: s.exercise_key,
      name: exerciseName(s.exercise_key),
      filter: 'new',
      verdict: null,
      bodyweight: false,
      day: s.day,
      dayLabel: DAY_LABEL[s.day],
      date: null,
      loadText: null,
      nextLoadText: null,
      reason: null,
      reps: [],
      aboveRange: false,
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows
}

export function countRows(rows: ProgressRow[]): Record<ProgressFilter, number> {
  const out: Record<ProgressFilter, number> = { push: 0, stay: 0, new: 0 }
  for (const r of rows) out[r.filter]++
  return out
}
