/**
 * Weekly recap maths. Pure. Weeks run Monday to Sunday.
 */

import { TARGETS } from './targets.ts'
import type { Verdict } from './progression.ts'

export interface RecapSession {
  date: string
  day: string
  exercises: { verdict: Verdict | null; sets: { reps: number }[] }[]
}

export interface RecapDay {
  date: string
  kcal: number | null
  protein_g: number | null
  fiber_g: number | null
  status: 'in-progress' | 'done' | null
}

export interface WeighIn {
  date: string
  kg: number
}

export interface WeekRange {
  start: string // Monday
  end: string // Sunday
  isoWeek: number
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

export function weekOf(dateIso: string): WeekRange {
  const t = toUtc(dateIso)
  const dow = (new Date(t).getUTCDay() + 6) % 7 // Monday = 0
  const start = t - dow * 86400000
  const end = start + 6 * 86400000
  // ISO week number
  const d = new Date(t)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const isoWeek = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return { start: fromUtc(start), end: fromUtc(end), isoWeek }
}

export function formatRange(w: WeekRange): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [, sm, sd] = w.start.split('-').map(Number)
  const [, em, ed] = w.end.split('-').map(Number)
  return sm === em ? `${sd}–${ed} ${months[em - 1]}` : `${sd} ${months[sm - 1]} – ${ed} ${months[em - 1]}`
}

export interface DayBar {
  date: string
  label: string // M T W T F S S
  kcal: number | null
  status: 'done' | 'in-progress' | 'none'
}

export interface Recap {
  week: WeekRange
  sessions: number
  sessionsPlanned: number
  reps: number
  levelUps: number
  avgKcal: number | null
  avgProtein: number | null
  avgFiber: number | null
  daysLogged: number
  bars: DayBar[]
  headline: string
  bodyweight: { unlocked: boolean; count: number; latest: WeighIn | null; perWeekKg: number | null }
}

export function buildRecap(dateIso: string, sessions: RecapSession[], days: RecapDay[], weighIns: WeighIn[]): Recap {
  const week = weekOf(dateIso)
  const inWeek = (d: string) => d >= week.start && d <= week.end
  const ws = sessions.filter(s => inWeek(s.date))
  const wd = days.filter(d => inWeek(d.date))

  let reps = 0
  let levelUps = 0
  for (const s of ws) for (const e of s.exercises) {
    for (const st of e.sets) reps += st.reps
    if (e.verdict === 'push') levelUps++
  }

  const done = wd.filter(d => d.status === 'done' && d.kcal !== null)
  const avg = (f: (d: RecapDay) => number | null) => {
    const xs = done.map(f).filter((x): x is number => x !== null)
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
  }
  const avgKcal = avg(d => d.kcal)
  const avgProtein = avg(d => d.protein_g)
  const avgFiber = avg(d => d.fiber_g)

  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const bars: DayBar[] = labels.map((label, i) => {
    const date = fromUtc(toUtc(week.start) + i * 86400000)
    const d = wd.find(x => x.date === date)
    return {
      date,
      label,
      kcal: d?.kcal ?? null,
      status: d ? (d.status === 'done' ? 'done' : 'in-progress') : 'none',
    }
  })

  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.length ? sorted[sorted.length - 1] : null
  let perWeekKg: number | null = null
  if (sorted.length >= 3) {
    const first = sorted[0]
    const span = (toUtc(latest!.date) - toUtc(first.date)) / 86400000
    perWeekKg = span > 0 ? Math.round(((latest!.kg - first.kg) / span) * 7 * 100) / 100 : 0
  }

  const trainingOk = ws.length >= 4
  const fiberShort = avgFiber !== null && avgFiber < TARGETS.fiber_min_g
  const kcalOver = avgKcal !== null && avgKcal > TARGETS.kcal + 150
  const kcalUnder = avgKcal !== null && avgKcal < TARGETS.kcal - 150
  let headline: string
  if (ws.length === 0 && done.length === 0) headline = 'Nothing logged yet this week'
  else if (trainingOk && fiberShort) headline = 'Training on track, fiber short'
  else if (trainingOk && kcalOver) headline = 'Training on track, calories high'
  else if (trainingOk && kcalUnder) headline = 'Training on track, eat a bit more'
  else if (trainingOk) headline = 'Training and fuel on track'
  else if (fiberShort) headline = `${ws.length} of 4 sessions, fiber short`
  else headline = `${ws.length} of 4 sessions so far`

  return {
    week,
    sessions: ws.length,
    sessionsPlanned: 4,
    reps,
    levelUps,
    avgKcal,
    avgProtein,
    avgFiber,
    daysLogged: done.length,
    bars,
    headline,
    bodyweight: { unlocked: sorted.length >= 3, count: sorted.length, latest, perWeekKg },
  }
}
