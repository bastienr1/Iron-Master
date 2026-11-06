/**
 * Weigh-ins — several readings a day, one trend.
 *
 * The lean-bulk trend only makes sense on comparable readings, so it uses the
 * fasted morning one. A reading after breakfast or after the workout is kept
 * under its own context and never replaces the fasted one: `weigh_ins` is
 * unique on (user_id, date, context), and a save upserts on that key.
 */

export type WeighInContext = 'fasted' | 'pre_workout' | 'post_workout' | 'other'

export const WEIGH_IN_CONTEXTS: readonly WeighInContext[] = ['fasted', 'pre_workout', 'post_workout', 'other']

/** The conflict target of a weigh-in upsert: one row per day and context. */
export const WEIGH_IN_CONFLICT = 'user_id,date,context'

export const WEIGH_IN_CONTEXT_LABEL: Record<WeighInContext, string> = {
  fasted: 'fasted, morning',
  pre_workout: 'pre-workout',
  post_workout: 'post-workout',
  other: 'other time of day',
}

export function isWeighInContext(x: unknown): x is WeighInContext {
  return typeof x === 'string' && (WEIGH_IN_CONTEXTS as readonly string[]).includes(x)
}

export interface WeighInReading {
  date: string
  kg: number
  context: WeighInContext
}

/** Does this reading count for the bodyweight trend? */
export function countsForTrend(r: { context: WeighInContext }): boolean {
  return r.context === 'fasted'
}

/** The readings the trend is built on: fasted ones, oldest first. */
export function trendWeighIns<T extends WeighInReading>(rows: readonly T[]): T[] {
  return rows.filter(countsForTrend).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * What saving `reading` does to a day's rows, mirroring the database upsert:
 * the row with the same date and context is replaced, any other row stays.
 */
export function applyWeighIn<T extends WeighInReading>(rows: readonly T[], reading: T): T[] {
  const i = rows.findIndex(r => r.date === reading.date && r.context === reading.context)
  if (i === -1) return [...rows, reading]
  return rows.map((r, j) => (j === i ? { ...r, ...reading } : r))
}
