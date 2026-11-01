/**
 * The lean-bulk program as typed data: seeded into `program_slots`, and the
 * fallback rep range when a session note has no "Program range" column.
 *
 * Source of truth: Health/Physique-Program-Lean-Bulk.md in the vault. The note
 * is prose plus Dataview, so it is transcribed here rather than parsed.
 * Pure data: imports nothing.
 */

export type Day = 'upper_a' | 'lower_a' | 'upper_b' | 'lower_b'

export const DAYS: readonly Day[] = ['upper_a', 'lower_a', 'upper_b', 'lower_b']

export const DAY_LABEL: Record<Day, string> = {
  upper_a: 'Upper A',
  lower_a: 'Lower A',
  upper_b: 'Upper B',
  lower_b: 'Lower B',
}

export interface ProgramSlot {
  day: Day
  position: number
  exercise_key: string
  sets: number
  rep_min: number
  rep_max: number
  per_side: boolean
}

const slot = (
  day: Day,
  position: number,
  exercise_key: string,
  sets: number,
  rep_min: number,
  rep_max: number,
  per_side = false,
): ProgramSlot => ({ day, position, exercise_key, sets, rep_min, rep_max, per_side })

export const PROGRAM_SLOTS: readonly ProgramSlot[] = [
  slot('upper_a', 1, 'bench_press', 4, 6, 10),
  slot('upper_a', 2, 'pull_up', 4, 6, 10),
  slot('upper_a', 3, 'seated_db_ohp', 3, 8, 10),
  slot('upper_a', 4, 'chest_supported_row', 3, 8, 10),
  slot('upper_a', 5, 'db_lateral_raise', 4, 12, 20),
  slot('upper_a', 6, 'incline_db_curl', 3, 8, 12),
  slot('upper_a', 7, 'overhead_db_triceps', 3, 10, 15),

  slot('lower_a', 1, 'front_squat', 4, 8, 12),
  slot('lower_a', 2, 'single_leg_db_rdl', 3, 10, 10, true),
  slot('lower_a', 3, 'bulgarian_split_squat', 3, 8, 12, true),
  slot('lower_a', 4, 'standing_calf_raise', 4, 10, 15),
  slot('lower_a', 5, 'hanging_leg_raise', 3, 10, 15),

  slot('upper_b', 1, 'incline_db_press', 4, 8, 12),
  slot('upper_b', 2, 'chest_supported_row', 4, 10, 12),
  slot('upper_b', 3, 'arnold_press', 3, 8, 12),
  slot('upper_b', 4, 'db_lateral_raise', 4, 15, 25),
  slot('upper_b', 5, 'rear_delt_fly', 3, 15, 20),
  slot('upper_b', 6, 'db_shrug', 3, 12, 15),
  slot('upper_b', 7, 'hammer_curl', 3, 10, 12),
  slot('upper_b', 8, 'close_grip_bench', 3, 10, 12),

  slot('lower_b', 1, 'db_rdl', 3, 8, 10),
  slot('lower_b', 2, 'front_squat', 3, 10, 12),
  slot('lower_b', 3, 'db_walking_lunge', 3, 10, 12, true),
  slot('lower_b', 4, 'single_leg_calf_raise', 3, 12, 15, true),
  slot('lower_b', 5, 'dead_bug', 3, 10, 10, true),
]

export function findSlot(day: Day, exerciseKey: string): ProgramSlot | null {
  return PROGRAM_SLOTS.find(s => s.day === day && s.exercise_key === exerciseKey) ?? null
}

/** Parse a note's `day` frontmatter ("Upper B") into a key ("upper_b"). */
export function parseDay(raw: string | null | undefined): Day | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (DAYS as readonly string[]).includes(key) ? (key as Day) : null
}
