/**
 * Today's fuel: totals against targets, what's left, and a deterministic plan
 * for the rest of the day. Pure: imports only program constants.
 *
 * The plan follows the rules the daily notes already apply by hand:
 *   - protein first until the minimum is met, then it only needs topping up;
 *   - fiber short → vegetables at dinner, fruit or psyllium in the evening;
 *   - calories left split between dinner and evening;
 *   - water: finish the 3 L.
 */

import { FIBER_FIXERS, TARGETS } from './targets.ts'

export interface DayTotals {
  kcal: number
  protein_g: number
  fiber_g: number
  water_ml: number
}

export interface MealLike {
  kcal: number
  protein_g: number
  fiber_g: number | null
}

export function sumMeals(meals: MealLike[], water_ml = 0): DayTotals {
  let kcal = 0
  let protein = 0
  let fiber = 0
  for (const m of meals) {
    kcal += m.kcal
    protein += Number(m.protein_g)
    fiber += Number(m.fiber_g ?? 0)
  }
  return { kcal: Math.round(kcal), protein_g: Math.round(protein), fiber_g: Math.round(fiber * 10) / 10, water_ml }
}

export interface Remaining {
  kcal: number
  protein_g: number
  fiber_g: number
  water_ml: number
  proteinMet: boolean
  fiberMet: boolean
  kcalOver: boolean
}

export function remaining(t: DayTotals): Remaining {
  return {
    kcal: TARGETS.kcal - t.kcal,
    protein_g: Math.max(0, TARGETS.protein_min_g - t.protein_g),
    fiber_g: Math.max(0, TARGETS.fiber_min_g - t.fiber_g),
    water_ml: Math.max(0, TARGETS.water_ml - t.water_ml),
    proteinMet: t.protein_g >= TARGETS.protein_min_g,
    fiberMet: t.fiber_g >= TARGETS.fiber_min_g,
    kcalOver: t.kcal > TARGETS.kcal,
  }
}

export type Period = 'morning' | 'afternoon' | 'evening' | 'night'

export function periodOf(hour: number): Period {
  if (hour < 11) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

export interface PlanLine {
  label: string
  text: string
}

function round50(n: number): number {
  return Math.round(n / 50) * 50
}

/** The "Rest of today" card: what to do with what's left. */
export function restOfDayPlan(t: DayTotals, period: Period): PlanLine[] {
  const r = remaining(t)
  const lines: PlanLine[] = []

  if (r.kcal <= 0) {
    lines.push({ label: 'Food', text: `Target reached (${Math.abs(r.kcal)} kcal over). Only fiber and water from here.` })
  } else {
    const mealsLeft = period === 'morning' ? ['Lunch', 'Dinner'] : period === 'afternoon' ? ['Dinner', 'Evening'] : period === 'evening' ? ['Dinner', 'Evening'] : ['Evening']
    const proteinNeed = r.proteinMet ? '20–30 g protein' : `${Math.max(30, Math.min(60, r.protein_g))} g+ protein`
    if (mealsLeft.length === 2) {
      const first = round50(r.kcal * 0.75)
      const second = Math.max(0, round50(r.kcal - first))
      const veg = r.fiberMet ? '' : ', 150 g+ vegetables with brown rice'
      lines.push({ label: mealsLeft[0], text: `~${first} kcal, ${proteinNeed}${veg}` })
      if (second > 0) {
        const fruit = r.fiberMet ? 'Greek yogurt or a shake if hungry' : '2 apples or 3 mandarins for +5–8 g fiber'
        lines.push({ label: mealsLeft[1], text: `~${second} kcal · ${fruit}` })
      }
    } else {
      lines.push({ label: mealsLeft[0], text: `~${round50(r.kcal)} kcal, ${proteinNeed}` })
    }
  }

  if (!r.fiberMet) {
    const short = Math.ceil(r.fiber_g)
    const fix = FIBER_FIXERS.map(f => `${f.name} (+${f.fiber_g} g)`).join(', ')
    lines.push({ label: 'Fiber', text: `${short} g short. ${fix}` })
  }

  if (r.water_ml > 0) {
    const l = Math.round(r.water_ml / 100) / 10
    lines.push({ label: 'Water', text: period === 'night' ? `${l} L still to go, sip until bed` : `${l} L more before bed` })
  }
  return lines
}

/** Bar fill 0–1 for the fuel card. */
export function fill(value: number, target: number): number {
  if (target <= 0) return 0
  return Math.max(0, Math.min(1, value / target))
}

export function formatKcal(n: number): string {
  return n.toLocaleString('en-US')
}
