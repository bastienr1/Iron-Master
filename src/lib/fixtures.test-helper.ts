/**
 * Shared loader for the fixture vault (fixtures/vault). Tests read the
 * fixtures, never the live vault.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseNutritionNote, parseSessionNote, type ParsedNutritionDay, type ParsedSession } from './vaultParse.ts'

export const FIXTURE_ROOT = join(process.cwd(), 'fixtures', 'vault')

export function loadFixtureSessions(): ParsedSession[] {
  const dir = join(FIXTURE_ROOT, 'Health', 'Physique-Log')
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => parseSessionNote(readFileSync(join(dir, f), 'utf8'), `Health/Physique-Log/${f}`))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function loadFixtureNutrition(): ParsedNutritionDay[] {
  const dir = join(FIXTURE_ROOT, 'Health', 'Nutrition-Log')
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => parseNutritionNote(readFileSync(join(dir, f), 'utf8'), `Health/Nutrition-Log/${f}`))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function bySession<S extends { day: string }>(sessions: S[], day: string): S {
  const s = sessions.find(x => x.day === day)
  if (!s) throw new Error(`no fixture session for ${day}`)
  return s
}

export function exercise<T extends { exercise_key: string }>(session: { exercises: T[] }, key: string): T {
  const e = session.exercises.find(x => x.exercise_key === key)
  if (!e) throw new Error(`no exercise ${key} in session`)
  return e
}
