/**
 * Usuals — the things eaten most days, one tap each.
 *
 * Two routine blocks are fixed; they mirror the Routines table in the vault's
 * Meals Nutritional Facts Sheet. Every other chip is ranked from the meal
 * history: on how many of the last 21 days a library meal was eaten.
 * Pure: no Supabase, no clock.
 */

import type { Accuracy, MealItem } from './logCards.ts'

export const USUALS_WINDOW_DAYS = 21
/** A meal is a "usual" once it shows up on this many days of the window. */
export const USUALS_MIN_DAYS = 2
export const USUALS_MAX_SINGLES = 6

export interface UsualLibraryRow {
  id: string
  name: string
  category: string | null
  portion: string | null
  kcal: number
  protein_g: number | string
  fiber_g: number | string | null
  accuracy: Accuracy | null
  items: MealItem[]
}

export interface UsualMeal {
  name: string
  items?: { name: string }[] | null
}

export interface UsualDay {
  date: string
  meals: UsualMeal[]
}

interface BlockDef {
  id: 'morning' | 'session'
  label: string
  parts: readonly { library: string; slot: string }[]
  /** Water and workout drinks that come with the block. */
  water_ml: number
}

export const ROUTINE_BLOCKS: readonly BlockDef[] = [
  {
    id: 'morning',
    label: 'Morning routine',
    parts: [
      { library: 'Usual breakfast', slot: 'Breakfast' },
      { library: 'Supplements', slot: 'Supplements' },
    ],
    water_ml: 500,
  },
  {
    id: 'session',
    label: 'Session drinks + shake',
    parts: [
      { library: 'Workout drinks', slot: 'Workout' },
      { library: 'Post-workout shake', slot: 'Post-workout shake' },
    ],
    water_ml: 1650,
  },
]

/**
 * How a library meal is recognised in a logged meal's text. Vault rows carry
 * the note's wording ("1 scoop ON whey + 250 ml Pauls full cream milk"), app
 * rows the library name. A library meal without a pattern matches by its name.
 */
const PATTERNS: Record<string, RegExp> = {
  'Usual breakfast': /usual breakfast/,
  Supplements: /supplements|cell-tech|omega-3/,
  'Post-workout shake': /post-workout shake|1 scoop on (gold standard )?whey \+ 250 ml/,
  'Double shake': /double shake|2 scoops on (gold standard )?whey \+ 250 ml/,
  'Shake lunch': /shake lunch|2 scoops on (gold standard )?whey \+ 400 ml/,
  'Workout drinks': /workout drinks|100plus/,
  Banana: /\bbanana/,
  '1 apple': /\bapple/,
  'Chihuahua wrap': /chihuahua wrap/,
  'Chihuahua bowl': /chihuahua bowl/,
  'Muscle Beach bowl': /muscle beach/,
  'Hao Liao bowl': /hao liao/,
  'Barebells bar': /barebells/,
  'Greek yogurt 250 g': /^250 g greek yogurt|greek yogurt 250 g/,
}

function mealText(meal: UsualMeal): string {
  return [meal.name, ...(meal.items ?? []).map(i => i.name)].join(' | ').toLowerCase()
}

export function matchesLibrary(libraryName: string, meal: UsualMeal): boolean {
  const text = mealText(meal)
  const pattern = PATTERNS[libraryName]
  return pattern ? pattern.test(text) : text.includes(libraryName.toLowerCase())
}

function isoMinusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10)
}

/** Days in the window before `today` on which the library meal was eaten. */
export function daysEaten(libraryName: string, days: UsualDay[], today: string, windowDays = USUALS_WINDOW_DAYS): { count: number; last: string | null } {
  const from = isoMinusDays(today, windowDays)
  let count = 0
  let last: string | null = null
  for (const day of days) {
    if (day.date >= today || day.date < from) continue
    if (!day.meals.some(m => matchesLibrary(libraryName, m))) continue
    count++
    if (last === null || day.date > last) last = day.date
  }
  return { count, last }
}

/** The slot a library meal lands in when logged with one tap. */
export function defaultSlot(category: string | null, hour: number): string {
  switch (category) {
    case 'breakfast':
      return 'Breakfast'
    case 'shake':
      return 'Shake'
    case 'lunch':
      return 'Lunch'
    case 'dinner':
      return 'Dinner'
    case 'supplement':
      return 'Supplements'
    case 'drink':
      return 'Workout'
    case 'fiber':
    case 'snack':
      return hour >= 19 ? 'Evening' : 'Snack'
    default:
      return hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 20 ? 'Dinner' : 'Evening'
  }
}

/** A library meal as loggable items: its own breakdown, or one line for the whole meal. */
export function libraryItems(row: UsualLibraryRow): MealItem[] {
  if (row.items?.length) return row.items
  return [
    {
      name: row.portion ?? row.name,
      grams: null,
      kcal: row.kcal,
      protein_g: Number(row.protein_g),
      fiber_g: row.fiber_g === null ? null : Number(row.fiber_g),
      accuracy: row.accuracy ?? 'estimated',
    },
  ]
}

export interface UsualChip<L extends UsualLibraryRow = UsualLibraryRow> {
  kind: 'block' | 'meal'
  id: string
  label: string
  /** What one tap logs. For a block, only the parts not logged yet today. */
  parts: { row: L; slot: string }[]
  kcal: number
  protein_g: number
  water_ml: number
  /** Already logged today. A done meal stays visible, a done block is dropped. */
  doneToday: boolean
  /** Days eaten in the window; 0 for blocks. */
  days: number
}

export interface UsualsInput<L extends UsualLibraryRow> {
  library: L[]
  days: UsualDay[]
  today: string
  hour: number
  /** A lifting session exists today (in progress or done). */
  sessionToday: boolean
}

const BLOCK_ONLY_CATEGORIES = new Set(['breakfast', 'supplement', 'drink'])

export function usualChips<L extends UsualLibraryRow>({ library, days, today, hour, sessionToday }: UsualsInput<L>): UsualChip<L>[] {
  const byName = new Map(library.map(r => [r.name, r]))
  const todayMeals = days.find(d => d.date === today)?.meals ?? []
  const loggedToday = (name: string) => todayMeals.some(m => matchesLibrary(name, m))
  const chips: UsualChip<L>[] = []
  const inActiveBlock = new Set<string>()

  for (const block of ROUTINE_BLOCKS) {
    if (block.id === 'session' && !sessionToday) continue
    for (const p of block.parts) inActiveBlock.add(p.library)
    const all = block.parts.map(p => ({ row: byName.get(p.library), slot: p.slot }))
    if (all.some(p => !p.row)) continue
    const parts = (all as { row: L; slot: string }[]).filter(p => !loggedToday(p.row.name))
    if (parts.length === 0) continue
    chips.push({
      kind: 'block',
      id: block.id,
      label: block.label,
      parts,
      kcal: parts.reduce((n, p) => n + p.row.kcal, 0),
      protein_g: parts.reduce((n, p) => n + Number(p.row.protein_g), 0),
      // The block's fluids go in once: not again when part of it is already logged.
      water_ml: parts.length === all.length ? block.water_ml : 0,
      doneToday: false,
      days: 0,
    })
  }

  const singles = library
    .filter(r => !inActiveBlock.has(r.name) && !BLOCK_ONLY_CATEGORIES.has(r.category ?? ''))
    .map(row => ({ row, ...daysEaten(row.name, days, today) }))
    .filter(x => x.count >= USUALS_MIN_DAYS)
    .sort((a, b) => b.count - a.count || (b.last ?? '').localeCompare(a.last ?? '') || a.row.name.localeCompare(b.row.name))
    .slice(0, USUALS_MAX_SINGLES)

  for (const { row, count } of singles) {
    chips.push({
      kind: 'meal',
      id: row.id,
      label: row.name,
      parts: [{ row, slot: defaultSlot(row.category, hour) }],
      kcal: row.kcal,
      protein_g: Number(row.protein_g),
      water_ml: 0,
      doneToday: loggedToday(row.name),
      days: count,
    })
  }
  return chips
}
