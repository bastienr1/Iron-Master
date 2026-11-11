/**
 * Exercise registry: one canonical key per movement, how it is loaded, and the
 * aliases the vault notes use for it. Pure: imports nothing.
 *
 * Sprint 2's parser (Claude) will map to the same keys.
 */

export type Loading = 'barbell' | 'dumbbell' | 'kettlebell' | 'bodyweight'

export interface ExerciseDef {
  name: string
  loading: Loading
  aliases: string[]
}

/**
 * Dumbbell weights owned, ascending, in kg. Empty until configured: once it is
 * filled, a dumbbell PUSH names the next weight instead of "next DB jump".
 */
export const DUMBBELLS: readonly number[] = []

export const EXERCISES: Record<string, ExerciseDef> = {
  // Upper A
  bench_press: {
    name: 'Bench press',
    loading: 'barbell',
    aliases: ['barbell bench press', 'bench'],
  },
  pull_up: {
    name: 'Pull-up',
    loading: 'bodyweight',
    aliases: ['weighted pull-up', 'pull up', 'pullup', 'weighted pull up'],
  },
  seated_db_ohp: {
    name: 'Seated DB overhead press',
    loading: 'dumbbell',
    aliases: ['seated db ohp', 'seated dumbbell overhead press', 'seated db press', 'db overhead press'],
  },
  chest_supported_row: {
    name: 'Chest-supported row',
    loading: 'dumbbell',
    aliases: ['chest-supported db row', 'chest supported db row', 'chest supported row', 'cs row'],
  },
  db_lateral_raise: {
    name: 'DB lateral raise',
    loading: 'dumbbell',
    aliases: ['lateral raise', 'lateral raises', 'db lateral raises', 'dumbbell lateral raise'],
  },
  incline_db_curl: {
    name: 'Incline DB curl',
    loading: 'dumbbell',
    aliases: ['incline dumbbell curl', 'incline curl'],
  },
  overhead_db_triceps: {
    name: 'Overhead DB triceps extension',
    loading: 'dumbbell',
    aliases: ['overhead triceps extension', 'overhead db triceps', 'db overhead triceps extension'],
  },

  // Lower A
  front_squat: {
    name: 'Front squat',
    loading: 'barbell',
    aliases: [
      'barbell front squat',
      'db front squat',
      'dumbbell front squat',
      'heel-elevated goblet squat',
      'heel elevated goblet squat',
      'goblet squat',
    ],
  },
  single_leg_db_rdl: {
    name: 'Single-leg DB RDL',
    loading: 'dumbbell',
    aliases: ['single leg db rdl', 'single-leg rdl', 'single-leg db romanian deadlift'],
  },
  bulgarian_split_squat: {
    name: 'Bulgarian split squat',
    loading: 'dumbbell',
    aliases: ['split squat', 'bss'],
  },
  standing_calf_raise: {
    name: 'Standing calf raise',
    loading: 'barbell',
    aliases: ['barbell calf raise', 'standing calf raises'],
  },
  hanging_leg_raise: {
    name: 'Hanging leg raise',
    loading: 'bodyweight',
    aliases: ['hanging leg raises', 'ab wheel'],
  },

  // Upper B
  incline_db_press: {
    name: 'Incline DB press',
    loading: 'dumbbell',
    aliases: ['incline dumbbell press', 'incline press'],
  },
  arnold_press: {
    name: 'Arnold press',
    loading: 'dumbbell',
    aliases: ['db arnold press'],
  },
  rear_delt_fly: {
    name: 'Rear-delt fly',
    loading: 'dumbbell',
    aliases: ['rear delt fly', 'rear-delt flye', 'reverse fly'],
  },
  db_shrug: {
    name: 'DB shrug',
    loading: 'dumbbell',
    aliases: ['dumbbell shrug', 'shrug'],
  },
  hammer_curl: {
    name: 'Hammer curl',
    loading: 'dumbbell',
    aliases: ['db hammer curl', 'hammer curls'],
  },
  close_grip_bench: {
    name: 'Close-grip bench',
    loading: 'barbell',
    aliases: ['close grip bench', 'close-grip bench press', 'close grip bench press'],
  },

  // Lower B
  db_rdl: {
    name: 'DB Romanian deadlift',
    loading: 'dumbbell',
    aliases: ['db rdl', 'dumbbell romanian deadlift', 'dumbbell rdl'],
  },
  db_walking_lunge: {
    name: 'DB walking lunge',
    loading: 'dumbbell',
    aliases: ['walking lunge', 'walking lunges', 'db walking lunges', 'dumbbell walking lunge'],
  },
  single_leg_calf_raise: {
    name: 'Single-leg calf raise',
    loading: 'kettlebell',
    aliases: ['single leg calf raise', 'single-leg calf raises'],
  },
  dead_bug: {
    name: 'Dead bug',
    loading: 'bodyweight',
    aliases: ['dead bugs', 'deadbug'],
  },
  // Lower B from 11 Nov 2026: barbell RDL (logged under db_rdl since 4 Nov),
  // barbell forward lunge in place of the DB walking lunge, ab wheel in place
  // of the dead bug. The older keys stay for the history.
  barbell_rdl: {
    name: 'Barbell Romanian deadlift',
    loading: 'barbell',
    aliases: ['barbell rdl', 'barbell romanian deadlifts', 'bb rdl'],
  },
  barbell_forward_lunge: {
    name: 'Barbell forward lunge',
    loading: 'barbell',
    aliases: ['barbell lunge', 'barbell lunges', 'barbell forward lunges', 'forward lunge', 'forward lunges'],
  },
  ab_wheel: {
    name: 'Ab wheel rollout',
    loading: 'bodyweight',
    aliases: ['ab wheel', 'ab wheel rollouts', 'ab rollout', 'ab rollouts', 'kneeling ab wheel'],
  },
}

/** Normalise a raw cell: drop links and parentheticals, lower-case, collapse spaces. */
export function normaliseExerciseName(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/\([^)]*\)/g, ' ') // anything in parentheses
    .replace(/\*\*/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const [key, def] of Object.entries(EXERCISES)) {
    m.set(def.name.toLowerCase(), key)
    for (const a of def.aliases) m.set(a.toLowerCase(), key)
  }
  return m
})()

/** Map a note's exercise cell to a registry key, or null when unknown. Never guesses. */
export function resolveExercise(raw: string): string | null {
  const n = normaliseExerciseName(raw)
  if (!n) return null
  const direct = INDEX.get(n)
  if (direct) return direct
  // Hyphen / space variants ("chest supported" vs "chest-supported").
  const dehyphenated = n.replace(/-/g, ' ')
  for (const [alias, key] of INDEX) {
    if (alias.replace(/-/g, ' ') === dehyphenated) return key
  }
  return null
}

export function exerciseName(key: string): string {
  return EXERCISES[key]?.name ?? key
}

export function exerciseLoading(key: string): Loading {
  return EXERCISES[key]?.loading ?? 'dumbbell'
}
