/**
 * The push-or-stay engine. Pure, deterministic, tested against the real logs.
 * Claude parses; this code decides. It never calls Claude.
 *
 * Double progression (Physique-Program-Lean-Bulk): when every programmed set
 * hits the top of the range, add weight next session (+2.5 kg barbell, next
 * jump on dumbbells). Refinements proven against the 1 Nov 2026 logs:
 *   1. Only the programmed sets count; bonus sets are ignored.
 *   2. A rest-paused set is not a full set.
 *   3. An "aim" from the previous session of the same exercise carries forward.
 *   4. Bodyweight lifts at the top progress by tempo or a light load.
 */

import { DUMBBELLS, exerciseLoading, type Loading } from './exercises.ts'
import type { ParsedExercise, ParsedSession } from './vaultParse.ts'

export type Verdict = 'push' | 'stay' | 'progress_bw'

export interface Decision {
  verdict: Verdict
  target: number
  aboveRange: boolean
  nextLoadText: string
  reason: string
}

export interface DecideInput {
  sets: { reps: number; rest_pause?: boolean; load_kg?: number }[]
  programmedSets: number
  repMin: number
  repMax: number
  /** next_aim from the previous session of the same exercise_key, any day. */
  carriedAim: number | null
  loading: Loading
  loadKg: number | null
}

export function formatKg(kg: number): string {
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace(/\.0$/, '')} kg`
}

function nextDumbbell(loadKg: number | null): string {
  if (loadKg !== null && DUMBBELLS.length > 0) {
    const next = DUMBBELLS.find(w => w > loadKg)
    if (next !== undefined) return formatKg(next)
  }
  return 'next DB jump'
}

export function decide(input: DecideInput): Decision {
  const { programmedSets, carriedAim, repMax, loading, loadKg } = input
  const counted = input.sets.slice(0, programmedSets)
  const target = carriedAim ?? repMax

  if (counted.length < programmedSets) {
    return { verdict: 'stay', target, aboveRange: false, nextLoadText: '', reason: 'finish all sets' }
  }
  if (counted.some(s => s.rest_pause)) {
    return { verdict: 'stay', target, aboveRange: false, nextLoadText: '', reason: 'straight sets first' }
  }
  const allAtTarget = counted.every(s => s.reps >= target)
  if (allAtTarget) {
    const aboveRange = counted.every(s => s.reps > target)
    if (loading === 'bodyweight') {
      return {
        verdict: 'progress_bw',
        target,
        aboveRange,
        nextLoadText: 'slow the tempo or add a light load',
        reason: 'all sets at the top: progress by tempo or a light load',
      }
    }
    let nextLoadText: string
    if (loading === 'barbell') nextLoadText = loadKg === null ? '+2.5 kg' : formatKg(loadKg + 2.5)
    else if (loading === 'dumbbell') nextLoadText = nextDumbbell(loadKg)
    else nextLoadText = 'heavier KB'
    return {
      verdict: 'push',
      target,
      aboveRange,
      nextLoadText,
      reason: aboveRange ? 'above range: add load' : 'top of range hit: add load',
    }
  }
  return {
    verdict: 'stay',
    target,
    aboveRange: false,
    nextLoadText: '',
    reason: `get all ${programmedSets} sets to ${target}`,
  }
}

export interface DecidedExercise extends ParsedExercise {
  carried_aim: number | null
  decision: Decision
}

export interface DecidedSession extends Omit<ParsedSession, 'exercises'> {
  exercises: DecidedExercise[]
}

/**
 * Decide every exercise of every session, oldest first, feeding each one the
 * previous session's `next_aim` for the same exercise_key.
 */
export function decideSessions(sessions: ParsedSession[]): DecidedSession[] {
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const lastAim = new Map<string, number | null>()
  return ordered.map(session => {
    const exercises = session.exercises.map(ex => {
      const carried = lastAim.get(ex.exercise_key) ?? null
      const decision = decide({
        sets: ex.sets,
        programmedSets: ex.programmed_sets,
        repMin: ex.rep_min,
        repMax: ex.rep_max,
        carriedAim: carried,
        loading: exerciseLoading(ex.exercise_key),
        loadKg: ex.load_kg,
      })
      return { ...ex, carried_aim: carried, decision }
    })
    // Update aims after the whole session so two rows of the same lift in one
    // session don't feed each other.
    for (const ex of exercises) lastAim.set(ex.exercise_key, ex.next_aim)
    return { ...session, exercises }
  })
}

export function countVerdicts(sessions: DecidedSession[]): Record<Verdict, number> {
  const out: Record<Verdict, number> = { push: 0, stay: 0, progress_bw: 0 }
  for (const s of sessions) for (const e of s.exercises) out[e.decision.verdict]++
  return out
}

/** Exercises whose logged ⬆️/➡️ disagrees with the engine. Empty means trust earned. */
export function disagreements(sessions: DecidedSession[]): DecidedExercise[] {
  const out: DecidedExercise[] = []
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.logged_verdict && e.logged_verdict !== e.decision.verdict) out.push(e)
    }
  }
  return out
}
