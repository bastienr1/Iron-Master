/**
 * Daily nutrition targets and program constants, from
 * Health/Physique-Program-Lean-Bulk.md frontmatter and the Nutrition table.
 * Pure data.
 */

export const TARGETS = {
  kcal: 2750,
  protein_min_g: 150,
  protein_max_g: 165,
  fiber_min_g: 30,
  water_ml: 3000,
  /** Rest-day step floor from the weekly split ("Rest + 8–10k steps"). */
  steps: 8000,
} as const

/** Program start, for the "Week N" eyebrow. */
export const PROGRAM_START = '2026-10-16'

/** Monday-to-Sunday rotation from the program's weekly split. */
export const WEEKLY_SPLIT = {
  1: 'upper_a',
  2: 'lower_a',
  4: 'upper_b',
  5: 'lower_b',
} as const

/** Quick fiber adds, from the Meals Nutritional Facts Sheet and the daily notes. */
export const FIBER_FIXERS: readonly { name: string; grams: number; fiber_g: number; kcal: number; protein_g: number }[] = [
  { name: 'Psyllium 10 g', grams: 10, fiber_g: 8, kcal: 20, protein_g: 0 },
  { name: '1 apple', grams: 180, fiber_g: 4.5, kcal: 95, protein_g: 0.5 },
  { name: '3 mandarins', grams: 240, fiber_g: 5, kcal: 135, protein_g: 2 },
]

/** Program week number for a date (week 1 starts on PROGRAM_START). */
export function programWeek(dateIso: string): number {
  const start = Date.UTC(2026, 9, 16)
  const [y, m, d] = dateIso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d)
  return Math.max(1, Math.floor((t - start) / (7 * 86400000)) + 1)
}
