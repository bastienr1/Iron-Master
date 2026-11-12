/**
 * Meals — your own weighed and labelled meals, one tap to log, plus fiber fixers.
 */
import { useMemo, useState } from 'react'
import { AccuracyDot, AccuracyLegend, Card, ErrorNote, Eyebrow, Title } from '../components/ui.tsx'
import { addMeal, bumpLibrary, dayTotals, fetchDays, fetchLibrary, type LibraryRow } from '../lib/data.ts'
import { hourNow, todayIso } from '../lib/dates.ts'
import { remaining } from '../lib/fuel.ts'
import { FIBER_FIXERS } from '../lib/targets.ts'
import { useAsync } from '../lib/useAsync.ts'
import { daysEaten, defaultSlot, libraryItems } from '../lib/usuals.ts'

const SLOTS = ['Breakfast', 'Shake', 'Lunch', 'Snack', 'Dinner', 'Evening', 'Supplements', 'Workout']

export default function Meals() {
  const date = todayIso()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [slot, setSlot] = useState('Lunch')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const state = useAsync(async () => {
    const [library, days] = await Promise.all([fetchLibrary(), fetchDays()])
    return { library, days }
  }, [date])

  const library = useMemo(() => state.data?.library ?? [], [state.data])
  const days = useMemo(() => state.data?.days ?? [], [state.data])
  const rem = remaining(dayTotals(days.find(d => d.date === date) ?? null))
  // How often each meal was eaten over the last three weeks, from the meal
  // history itself, so meals logged through the vault count too.
  const eaten = useMemo(() => new Map(library.map(r => [r.id, daysEaten(r.name, days, date).count])), [library, days, date])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = library.filter(r => r.category !== 'fiber').sort((a, b) => (eaten.get(b.id) ?? 0) - (eaten.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    if (!needle) return rows
    return rows.filter(r => `${r.name} ${r.portion ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(needle))
  }, [library, q, eaten])

  async function logRow(row: LibraryRow, chosenSlot: string) {
    setBusy(true)
    setErr(null)
    try {
      await addMeal(date, { slot: chosenSlot, name: row.name, items: libraryItems(row), raw_text: null })
      await bumpLibrary(row, date)
      setToast(`${row.name} logged as ${chosenSlot.toLowerCase()} · ${row.kcal} kcal`)
      setOpen(null)
      state.reload()
      window.setTimeout(() => setToast(null), 3500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function fixer(name: string) {
    const row = library.find(r => r.name === name)
    if (row) return void logRow(row, hourNow() >= 19 ? 'Evening' : 'Snack')
    const f = FIBER_FIXERS.find(x => x.name === name)
    if (!f) return
    setBusy(true)
    addMeal(date, { slot: hourNow() >= 19 ? 'Evening' : 'Snack', name: f.name, items: [{ name: f.name, grams: f.grams, kcal: f.kcal, protein_g: f.protein_g, fiber_g: f.fiber_g, accuracy: 'estimated' }], raw_text: null })
      .then(() => {
        setToast(`${f.name} logged · +${f.fiber_g} g fiber`)
        state.reload()
      })
      .catch(e => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }

  return (
    <main className="flex-1 flex flex-col gap-2.5 px-4 pt-7 pb-3">
      <header className="px-1 flex flex-col gap-3">
        <div>
          <Eyebrow>From your Meals Nutritional Facts Sheet</Eyebrow>
          <Title>Meal facts</Title>
        </div>
        <div className="flex items-center gap-2 bg-surface rounded-xl px-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9fb0ad" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label htmlFor="mealSearch" className="sr-only">
            Search meals
          </label>
          <input id="mealSearch" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search your meals" className="flex-1 min-h-11 bg-transparent text-[15px] outline-none min-w-0" />
        </div>
      </header>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {err && <ErrorNote>{err}</ErrorNote>}
      {toast && <p className="rounded-lg bg-plate-green text-ground px-3 py-2 text-sm font-semibold">{toast}</p>}

      <div className="grid grid-cols-[1fr_52px_48px_40px] gap-x-2 px-3 font-mono text-[10px] text-muted">
        <span>MEAL</span>
        <span className="text-right">KCAL</span>
        <span className="text-right">PROT</span>
        <span className="text-right">FIB</span>
      </div>

      {filtered.map(row => {
        const isOpen = open === row.id
        return (
          <div key={row.id} className="bg-surface rounded-[14px]">
            <button
              type="button"
              onClick={() => {
                setOpen(isOpen ? null : row.id)
                setSlot(defaultSlot(row.category, hourNow()))
              }}
              className="w-full grid grid-cols-[1fr_52px_48px_40px] gap-x-2 gap-y-0.5 items-baseline px-3 py-[11px] text-left tabular-nums"
            >
              <span className="text-sm font-semibold">{row.name}</span>
              <span className="text-right font-semibold">{row.kcal.toLocaleString('en-US')}</span>
              <span className="text-right">{Number(row.protein_g)} g</span>
              <span className="text-right text-plate-yellow">{row.fiber_g === null ? '–' : `${Number(row.fiber_g)} g`}</span>
              <span className="col-span-4 text-xs text-muted">
                <AccuracyDot accuracy={row.accuracy} /> {row.notes ?? row.portion ?? ''}
                {eaten.get(row.id) ? ` · ${eaten.get(row.id)} of the last 21 days` : ''}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 flex flex-col gap-2 border-t border-line pt-2.5">
                <div className="flex gap-1.5 overflow-x-auto">
                  {SLOTS.map(s => (
                    <button key={s} type="button" onClick={() => setSlot(s)} className={`shrink-0 min-h-9 px-3 rounded-full text-xs font-semibold ${s === slot ? 'bg-ink text-ground' : 'border border-line text-muted'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <button type="button" disabled={busy} onClick={() => void logRow(row, slot)} className="min-h-11 rounded-full bg-plate-green text-ground font-semibold text-sm disabled:opacity-50">
                  Log {row.name} as {slot.toLowerCase()}
                </button>
              </div>
            )}
          </div>
        )
      })}
      {!state.loading && filtered.length === 0 && <p className="text-muted text-sm px-1">No meal matches. Describe it in Log and Claude will build the card.</p>}

      <Card tone="yellow" className="flex flex-col gap-2 mt-1">
        <div className="flex justify-between items-baseline">
          <span className="font-display font-extrabold text-[22px] uppercase">Fiber fixers</span>
          <span className="font-mono text-[11px]">{rem.fiberMet ? 'target met today' : `${Math.ceil(rem.fiber_g)} g short today`}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {FIBER_FIXERS.map(f => (
            <button key={f.name} type="button" disabled={busy} onClick={() => fixer(f.name)} className="min-h-14 rounded-xl bg-[#1a1a12] text-plate-yellow text-xs font-semibold flex flex-col items-center justify-center gap-0.5 disabled:opacity-50">
              <b className="font-display font-extrabold text-xl">+{f.fiber_g} g</b>
              {f.name}
            </button>
          ))}
        </div>
      </Card>
      <AccuracyLegend />
    </main>
  )
}
