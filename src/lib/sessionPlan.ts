/**
 * Session planning for the coach: which day is next, and what each slot
 * prescribes given the latest decision for that lift. Pure.
 */

import { exerciseLoading, exerciseName } from './exercises.ts'
import { DAYS, DAY_LABEL, PROGRAM_SLOTS, type Day, type ProgramSlot } from './program.ts'
import type { Verdict } from './progression.ts'
import type { LoggedExerciseRecord } from './progressRows.ts'

const ROTATION: readonly Day[] = ['upper_a', 'lower_a', 'upper_b', 'lower_b']

/** The next day in the rotation after the most recent completed session. */
export function nextDay(lastDay: Day | null): Day {
  if (!lastDay) return 'upper_a'
  const i = ROTATION.indexOf(lastDay)
  return ROTATION[(i + 1) % ROTATION.length]
}

export function slotsFor(day: Day): ProgramSlot[] {
  return PROGRAM_SLOTS.filter(s => s.day === day).sort((a, b) => a.position - b.position)
}

export interface Prescription {
  slot: ProgramSlot
  key: string
  name: string
  verdict: Verdict | 'new'
  /** Load to use today (kg), or null when unknown (new lift / dumbbell jump not configured). */
  loadKg: number | null
  loadText: string
  /** Short line under the load: "Last time 12 · 11 · 11 · 11. Get all four sets to 12, then it goes up." */
  cue: string
  lastReps: number[]
  lastDate: string | null
  rangeText: string
  restSeconds: number
}

const COMPOUNDS = new Set(['bench_press', 'pull_up', 'front_squat', 'db_rdl', 'single_leg_db_rdl', 'bulgarian_split_squat', 'incline_db_press', 'chest_supported_row', 'close_grip_bench', 'db_walking_lunge', 'seated_db_ohp', 'arnold_press'])

export function restFor(key: string): number {
  return COMPOUNDS.has(key) ? 120 : 90
}

export function rangeText(slot: ProgramSlot): string {
  const reps = slot.rep_min === slot.rep_max ? `${slot.rep_min}` : `${slot.rep_min}–${slot.rep_max}`
  return `${slot.sets} × ${reps}${slot.per_side ? ' per side' : ''}`
}

function words(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n)
}

function parseNextLoad(text: string | null): number | null {
  if (!text) return null
  const m = /^(\d+(?:\.\d+)?) kg$/.exec(text)
  return m ? Number(m[1]) : null
}

function loadFromText(loadText: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*$/.exec(loadText.replace(/\(.*\)/, '').trim())
  if (m) return Number(m[1])
  const x = /×\s*(\d+(?:\.\d+)?)/.exec(loadText)
  return x ? Number(x[1]) : null
}

/** Build the per-slot prescription for a day from the latest record per lift. */
export function prescribe(day: Day, latest: Map<string, LoggedExerciseRecord>): Prescription[] {
  return slotsFor(day).map(slot => {
    const key = slot.exercise_key
    const last = latest.get(key)
    const name = exerciseName(key)
    const range = rangeText(slot)
    const rest = restFor(key)
    if (!last) {
      return {
        slot, key, name, verdict: 'new', loadKg: null, loadText: 'pick a weight',
        cue: `First time in the app. Start light, find a load that gets ${slot.rep_min}–${slot.rep_max} with 2 reps in reserve.`,
        lastReps: [], lastDate: null, rangeText: range, restSeconds: rest,
      }
    }
    const lastReps = last.sets.map(s => s.reps)
    const repsText = lastReps.join(' · ')
    const loading = exerciseLoading(key)
    const lastLoad = loadFromText(last.load_text)
    if (last.verdict === 'push') {
      const next = parseNextLoad(last.next_load_text)
      const loadKg = next ?? null
      const loadText = next !== null ? `${next}` : loading === 'dumbbell' ? 'next DB jump' : loading === 'kettlebell' ? 'heavier KB' : last.next_load_text ?? '+ load'
      const target = last.target_reps ?? slot.rep_max
      return {
        slot, key, name, verdict: 'push', loadKg, loadText,
        cue: `Last time ${repsText} at ${last.load_text}. Every set hit ${target}, so go up. Aim ${slot.rep_min}–${target}.`,
        lastReps, lastDate: last.date, rangeText: range, restSeconds: rest,
      }
    }
    if (last.verdict === 'progress_bw') {
      return {
        slot, key, name, verdict: 'progress_bw', loadKg: lastLoad, loadText: last.load_text || 'Bodyweight',
        cue: `Last time ${repsText}. All sets at the top: slow the tempo or add a light load.`,
        lastReps, lastDate: last.date, rangeText: range, restSeconds: rest,
      }
    }
    const target = last.target_reps ?? slot.rep_max
    return {
      slot, key, name, verdict: 'stay', loadKg: lastLoad, loadText: last.load_text,
      cue: `Last time ${repsText}. ${last.reason && /straight sets/.test(last.reason) ? 'Straight sets this time, no rest-pause.' : `Get all ${words(slot.sets)} sets to ${target}, then it goes up.`}`,
      lastReps, lastDate: last.date, rangeText: range, restSeconds: rest,
    }
  })
}

/** Latest record per exercise key from a flat list. */
export function latestByExercise(records: LoggedExerciseRecord[]): Map<string, LoggedExerciseRecord> {
  const m = new Map<string, LoggedExerciseRecord>()
  for (const r of records) {
    const cur = m.get(r.exercise_key)
    if (!cur || r.date > cur.date) m.set(r.exercise_key, r)
  }
  return m
}

export function dayLabel(day: Day): string {
  return DAY_LABEL[day]
}

export function isDay(x: string): x is Day {
  return (DAYS as readonly string[]).includes(x)
}

/** Breathing and effort cues from the program, rotated per exercise. */
export const CUES: readonly string[] = [
  'Exhale through the hard part. No breath-hold.',
  'Stop 2 reps short. No grinders.',
  'Rest 2–3 min on the heavy sets.',
  'No belt. Brace, then breathe out through the press.',
]
