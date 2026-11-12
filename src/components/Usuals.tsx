/**
 * Usuals — one tap for the things eaten most days. The two routine blocks come
 * first, then the meals eaten most often over the last three weeks. Every tap
 * can be undone, and a block disappears once it is logged, so a second tap
 * cannot double it.
 */
import { useState } from 'react'
import { Card, ErrorNote, SectionTitle } from './ui.tsx'
import { addMeal, addWater, deleteMeal, type DayRow, type LibraryRow, type MealRow } from '../lib/data.ts'
import { formatKcal } from '../lib/fuel.ts'
import { libraryItems, usualChips, type UsualChip } from '../lib/usuals.ts'

interface Logged {
  label: string
  meals: MealRow[]
  water_ml: number
}

interface Props {
  date: string
  hour: number
  library: LibraryRow[]
  days: DayRow[]
  sessionToday: boolean
  /** Called after a tap or an undo has been written, to refetch the day. */
  onChanged: () => void
}

function summary(chip: UsualChip): string {
  const parts = [`${formatKcal(chip.kcal)} kcal`]
  if (chip.water_ml) parts.push(`${chip.water_ml.toLocaleString('en-US')} ml`)
  return parts.join(' · ')
}

export default function Usuals({ date, hour, library, days, sessionToday, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<Logged | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chips = usualChips({ library, days, today: date, hour, sessionToday })

  async function log(chip: UsualChip<LibraryRow>) {
    setBusy(true)
    setError(null)
    const made: MealRow[] = []
    let water = 0
    try {
      for (const p of chip.parts) {
        made.push(await addMeal(date, { slot: p.slot, name: p.row.name, items: libraryItems(p.row), raw_text: null }))
      }
      if (chip.water_ml) {
        await addWater(date, chip.water_ml)
        water = chip.water_ml
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      // Whatever was written can be undone, also after a failure part-way.
      setLast(made.length || water ? { label: chip.label, meals: made, water_ml: water } : null)
      setBusy(false)
      onChanged()
    }
  }

  async function undo() {
    if (!last) return
    setBusy(true)
    setError(null)
    try {
      for (const m of last.meals) await deleteMeal(m)
      if (last.water_ml) await addWater(date, -last.water_ml)
      setLast(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      onChanged()
    }
  }

  if (chips.length === 0 && !last && !error) return null

  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline">
        <SectionTitle>Usuals</SectionTitle>
        <span className="font-mono text-[11px] text-muted">one tap · last 3 weeks</span>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {last && (
        <p className="flex items-center justify-between gap-3 rounded-lg bg-plate-green text-ground px-3 py-1.5 text-sm font-semibold" role="status">
          <span>{last.label} logged</span>
          <button type="button" disabled={busy} onClick={() => void undo()} className="min-h-9 px-2 underline disabled:opacity-50">
            Undo
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {chips.map(chip => (
          <button
            key={`${chip.kind}-${chip.id}`}
            type="button"
            disabled={busy}
            onClick={() => void log(chip)}
            aria-label={`Log ${chip.label}, ${summary(chip)}${chip.doneToday ? ', already logged today' : ''}`}
            className={`min-h-11 px-3.5 py-1.5 rounded-2xl flex flex-col items-start justify-center text-left disabled:opacity-50 ${
              chip.kind === 'block' ? 'bg-ink text-ground' : chip.doneToday ? 'border border-line text-muted' : 'border border-line-2 text-ink'
            }`}
          >
            <span className="text-[13px] font-semibold leading-tight">
              {chip.doneToday ? '✓ ' : ''}
              {chip.label}
            </span>
            <span className={`font-mono text-[10px] leading-tight ${chip.kind === 'block' ? 'text-ground/70' : 'text-muted'}`}>
              {chip.kind === 'block' ? chip.parts.map(p => p.row.name.toLowerCase()).join(' + ') + ' · ' : ''}
              {summary(chip)}
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}
