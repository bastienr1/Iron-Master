/**
 * Deload weeks. The program deloads every 5th week: half the sets at lighter
 * loads, nothing near failure (Physique-Program-Lean-Bulk, "Deload every 5th
 * week"). The weeks live in `deload_weeks`; a session logged inside one is
 * flagged `deload` and never becomes the record the coach prescribes from, so
 * the week after picks up exactly where the week before left off. Pure.
 */

import { DUMBBELLS, type Loading } from './exercises.ts'

/** Share of the last working load used on a deload. */
export const DELOAD_FRACTION = 0.8

/**
 * Barbell deload loads land on a 5 kg grid, rounded down: light is the safe
 * side of a deload, and 5 kg steps need no small plates.
 */
export const DELOAD_BARBELL_STEP_KG = 5

/** An empty bar. A barbell deload never goes below it. */
const BAR_KG = 20

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** True when the date falls in a deload week (Monday `week_start` to the Sunday after). */
export function isDeloadDate(dateIso: string, weekStarts: readonly string[]): boolean {
  return weekStarts.some(start => dateIso >= start && dateIso <= addDays(start, 6))
}

/** Half the programmed sets, rounded up, never below one. */
export function deloadSets(programmedSets: number): number {
  return Math.max(1, Math.ceil(programmedSets / 2))
}

/**
 * About 80% of the last working load, rounded down to what the rack allows.
 * Bodyweight lifts stay at bodyweight (the half sets are the deload).
 */
export function deloadLoad(lastLoadKg: number | null, loading: Loading): number | null {
  if (lastLoadKg === null || loading === 'bodyweight') return null
  const raw = lastLoadKg * DELOAD_FRACTION
  if (loading === 'barbell') {
    return Math.max(BAR_KG, Math.floor(raw / DELOAD_BARBELL_STEP_KG) * DELOAD_BARBELL_STEP_KG)
  }
  if (loading === 'dumbbell' && DUMBBELLS.length > 0) {
    const below = DUMBBELLS.filter(w => w <= raw)
    return below.length ? below[below.length - 1] : DUMBBELLS[0]
  }
  // Dumbbells not configured, or a kettlebell: whole kilos, rounded down.
  return Math.max(1, Math.floor(raw))
}
