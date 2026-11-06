/**
 * The structured cards Claude returns for a Log message, and their validation.
 * The Edge Function constrains Claude to this shape with a JSON schema; the
 * app re-validates before showing or saving anything. Pure.
 */

import { isWeighInContext, type WeighInContext } from './weighIns.ts'

export type Accuracy = 'label' | 'weighed' | 'estimated'

export interface SetCard {
  kind: 'set'
  exercise_key: string
  /** How the user named it, for the card title. */
  raw_name: string
  load_kg: number | null
  implements: number
  sets: { reps: number; load_kg?: number; rest_pause?: boolean }[]
  note: string | null
}

export interface MealItem {
  name: string
  grams: number | null
  kcal: number
  protein_g: number
  fiber_g: number | null
  accuracy: Accuracy
}

export interface MealCard {
  kind: 'meal'
  name: string
  slot: string | null
  items: MealItem[]
  /** Set when the sentence matched a library meal by name. */
  library_match: string | null
  note: string | null
}

export interface WeighInCard {
  kind: 'weigh_in'
  kg: number
  /** When the reading was taken. Only a fasted morning reading feeds the trend. */
  context: WeighInContext
  note: string | null
}

export interface WaterCard {
  kind: 'water'
  ml: number
  note: string | null
}

export type ActivityKind = 'walk' | 'run' | 'cycle' | 'swim' | 'steps' | 'other'

/** A walk, run or step count. The program wants walks and 8–10k steps on rest days. */
export interface ActivityCard {
  kind: 'activity'
  activity: ActivityKind
  minutes: number | null
  km: number | null
  steps: number | null
  note: string | null
}

export interface NoteCard {
  kind: 'note'
  text: string
}

export type LogCard = SetCard | MealCard | WeighInCard | WaterCard | ActivityCard | NoteCard

export interface ParseResponse {
  cards: LogCard[]
  /** One line back to the user, in plain words. */
  reply: string
}

function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

function numOrNull(x: unknown): number | null {
  return isNum(x) ? x : null
}

function strOrNull(x: unknown): string | null {
  return typeof x === 'string' && x.trim() ? x.trim() : null
}

const ACC: Accuracy[] = ['label', 'weighed', 'estimated']
const ACTIVITY_KINDS: ActivityKind[] = ['walk', 'run', 'cycle', 'swim', 'steps', 'other']

export function validateCard(raw: unknown, knownExerciseKeys: ReadonlySet<string>): LogCard | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  switch (o.kind) {
    case 'set': {
      if (typeof o.exercise_key !== 'string' || !knownExerciseKeys.has(o.exercise_key)) return null
      if (!Array.isArray(o.sets) || o.sets.length === 0) return null
      const sets: SetCard['sets'] = []
      for (const s of o.sets) {
        if (!s || typeof s !== 'object') return null
        const so = s as Record<string, unknown>
        if (!isNum(so.reps) || so.reps <= 0 || so.reps > 100) return null
        const set: SetCard['sets'][number] = { reps: Math.round(so.reps) }
        if (isNum(so.load_kg)) set.load_kg = so.load_kg
        if (so.rest_pause === true) set.rest_pause = true
        sets.push(set)
      }
      const implementsN = isNum(o.implements) && o.implements >= 1 ? Math.round(o.implements) : 1
      return {
        kind: 'set',
        exercise_key: o.exercise_key,
        raw_name: strOrNull(o.raw_name) ?? o.exercise_key,
        load_kg: numOrNull(o.load_kg),
        implements: implementsN,
        sets,
        note: strOrNull(o.note),
      }
    }
    case 'meal': {
      const name = strOrNull(o.name)
      if (!name || !Array.isArray(o.items) || o.items.length === 0) return null
      const items: MealItem[] = []
      for (const it of o.items) {
        if (!it || typeof it !== 'object') return null
        const io = it as Record<string, unknown>
        const iname = strOrNull(io.name)
        if (!iname || !isNum(io.kcal) || !isNum(io.protein_g)) return null
        items.push({
          name: iname,
          grams: numOrNull(io.grams),
          kcal: Math.round(io.kcal),
          protein_g: Math.round(io.protein_g * 10) / 10,
          fiber_g: isNum(io.fiber_g) ? Math.round(io.fiber_g * 10) / 10 : null,
          accuracy: ACC.includes(io.accuracy as Accuracy) ? (io.accuracy as Accuracy) : 'estimated',
        })
      }
      return { kind: 'meal', name, slot: strOrNull(o.slot), items, library_match: strOrNull(o.library_match), note: strOrNull(o.note) }
    }
    case 'weigh_in': {
      if (!isNum(o.kg) || o.kg < 30 || o.kg > 200) return null
      // Cards saved before contexts existed have none: they were all morning readings.
      const context: WeighInContext = isWeighInContext(o.context) ? o.context : 'fasted'
      return { kind: 'weigh_in', kg: Math.round(o.kg * 10) / 10, context, note: strOrNull(o.note) }
    }
    case 'water': {
      if (!isNum(o.ml) || o.ml <= 0 || o.ml > 5000) return null
      return { kind: 'water', ml: Math.round(o.ml), note: strOrNull(o.note) }
    }
    case 'activity': {
      const activity = ACTIVITY_KINDS.includes(o.activity as ActivityKind) ? (o.activity as ActivityKind) : 'other'
      const minutes = isNum(o.minutes) && o.minutes > 0 && o.minutes <= 1440 ? Math.round(o.minutes) : null
      const km = isNum(o.km) && o.km > 0 && o.km <= 200 ? Math.round(o.km * 10) / 10 : null
      const steps = isNum(o.steps) && o.steps > 0 && o.steps <= 100000 ? Math.round(o.steps) : null
      if (minutes === null && km === null && steps === null) return null
      return { kind: 'activity', activity, minutes, km, steps, note: strOrNull(o.note) }
    }
    case 'note': {
      const text = strOrNull(o.text)
      return text ? { kind: 'note', text } : null
    }
    default:
      return null
  }
}

export function validateParseResponse(raw: unknown, knownExerciseKeys: ReadonlySet<string>): ParseResponse {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cards: LogCard[] = []
  if (Array.isArray(o.cards)) {
    for (const c of o.cards) {
      const v = validateCard(c, knownExerciseKeys)
      if (v) cards.push(v)
    }
  }
  return { cards, reply: strOrNull(o.reply) ?? '' }
}

export function mealTotals(items: MealItem[]): { kcal: number; protein_g: number; fiber_g: number | null; accuracy: Accuracy } {
  let kcal = 0
  let protein = 0
  let fiber = 0
  let anyFiber = false
  let worst: Accuracy = 'label'
  for (const it of items) {
    kcal += it.kcal
    protein += it.protein_g
    if (it.fiber_g !== null) {
      fiber += it.fiber_g
      anyFiber = true
    }
    if (it.accuracy === 'estimated') worst = 'estimated'
    else if (it.accuracy === 'weighed' && worst === 'label') worst = 'weighed'
  }
  return { kcal: Math.round(kcal), protein_g: Math.round(protein * 10) / 10, fiber_g: anyFiber ? Math.round(fiber * 10) / 10 : null, accuracy: worst }
}

/** Accuracy legend colours, from the design: label green, weighed yellow, estimated orange. */
export const ACCURACY_LABEL: Record<Accuracy, string> = {
  label: 'from a label',
  weighed: 'weighed, values estimated',
  estimated: 'estimated',
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
  swim: 'Swim',
  steps: 'Steps',
  other: 'Activity',
}

/** "Walk · 60 min · 5 km", "6,200 steps". Shared by Log, Today and the vault export. */
export function activityText(a: Pick<ActivityCard, 'activity' | 'minutes' | 'km' | 'steps'>): string {
  const parts: string[] = []
  if (a.activity !== 'steps') parts.push(ACTIVITY_LABEL[a.activity])
  if (a.minutes !== null) parts.push(`${a.minutes} min`)
  if (a.km !== null) parts.push(`${a.km} km`)
  if (a.steps !== null) parts.push(`${a.steps.toLocaleString('en-US')} steps`)
  return parts.join(' · ')
}
