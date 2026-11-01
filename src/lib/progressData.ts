/**
 * Loads the logged exercises for the signed-in user and shapes them for
 * buildProgressRows. The join goes through sessions so RLS applies.
 */
import { supabase } from './supabase.ts'
import type { Day } from './program.ts'
import type { Verdict } from './progression.ts'
import type { LoggedExerciseRecord } from './progressRows.ts'

interface ExerciseRow {
  exercise_key: string
  load_text: string | null
  sets: { reps: number; load_kg?: number; rest_pause?: boolean }[] | null
  verdict: Verdict | null
  next_load_text: string | null
  reason: string | null
  target_reps: number | null
  above_range: boolean | null
  sessions: { date: string; day: Day } | null
}

export async function loadLoggedExercises(): Promise<LoggedExerciseRecord[]> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('exercise_key, load_text, sets, verdict, next_load_text, reason, target_reps, above_range, sessions!inner(date, day)')
    .order('position')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as ExerciseRow[]
  return rows
    .filter(r => r.sessions && r.verdict)
    .map(r => ({
      exercise_key: r.exercise_key,
      date: r.sessions!.date,
      day: r.sessions!.day,
      load_text: r.load_text ?? '',
      sets: r.sets ?? [],
      verdict: r.verdict as Verdict,
      next_load_text: r.next_load_text,
      reason: r.reason,
      target_reps: r.target_reps,
      above_range: r.above_range,
    }))
}
