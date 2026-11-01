/**
 * Push or stay. One row per lift from its latest session, plus the program
 * slots never logged.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorNote, Eyebrow, Title } from '../components/ui.tsx'
import { fetchSessions, toLoggedRecords } from '../lib/data.ts'
import { buildProgressRows, countRows, formatDateShort, type ProgressFilter } from '../lib/progressRows.ts'
import { useAsync } from '../lib/useAsync.ts'

const FILTERS: { key: ProgressFilter; label: string; active: string }[] = [
  { key: 'push', label: 'Push', active: 'bg-plate-green text-ground' },
  { key: 'stay', label: 'Stay', active: 'bg-plate-blue text-white' },
  { key: 'new', label: 'New', active: 'bg-plate-yellow text-[#1a1a12]' },
]

export default function Progress() {
  const [filter, setFilter] = useState<ProgressFilter>('push')
  const state = useAsync(fetchSessions, [])
  const rows = useMemo(() => (state.data ? buildProgressRows(toLoggedRecords(state.data)) : null), [state.data])
  const counts = useMemo(() => (rows ? countRows(rows) : { push: 0, stay: 0, new: 0 }), [rows])
  const visible = useMemo(() => (rows ?? []).filter(r => r.filter === filter), [rows, filter])

  return (
    <main className="flex-1 flex flex-col gap-3 px-4 pt-7 pb-3">
      <header className="px-1 flex flex-col gap-3">
        <div>
          <Eyebrow>Double progression · from your last sessions</Eyebrow>
          <Title>Push or stay</Title>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Filter">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              aria-pressed={f.key === filter}
              onClick={() => setFilter(f.key)}
              className={`min-h-11 rounded-xl font-display text-lg uppercase ${f.key === filter ? `font-extrabold ${f.active}` : 'font-bold bg-surface text-ink'}`}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>
      </header>

      {state.error && <ErrorNote>Couldn't load your sessions: {state.error}</ErrorNote>}
      {!state.error && rows === null && <Empty>Loading your lifts…</Empty>}
      {rows && rows.length === 0 && <Empty>No sessions yet. Start one from Train, or run the vault import.</Empty>}
      {rows && rows.length > 0 && visible.length === 0 && (
        <Empty>
          {filter === 'push' && 'Nothing to push yet. Hit the top of the range on every set first.'}
          {filter === 'stay' && 'Nothing to hold. Every logged lift is ready to move up.'}
          {filter === 'new' && 'Every lift in the program has been logged.'}
        </Empty>
      )}

      {visible.length > 0 && (
        <ul className="bg-surface rounded-[18px] px-3.5 py-1.5 flex flex-col divide-y divide-line">
          {visible.map(r => (
            <li key={r.key} className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 py-2.5 min-h-11">
              <span className="text-sm font-semibold">{r.name}</span>
              {r.filter === 'push' && (
                <span className="font-mono text-[13px] text-right">
                  {r.loadText} → <b className="text-mint">{r.nextLoadText}</b>
                </span>
              )}
              {r.filter === 'stay' && <span className="font-mono text-[13px] text-right text-[#8fb0f5]">{r.bodyweight ? 'tempo / light load' : r.reason}</span>}
              {r.filter === 'new' && <span className="font-mono text-[11px] text-right text-plate-yellow uppercase">New</span>}
              <span className="text-xs text-muted">
                {r.dayLabel}
                {r.date ? ` · ${formatDateShort(r.date)}` : ''}
                {r.reps.length ? ` · ${r.reps.join(' · ')}` : r.filter === 'new' ? ' · in the program, never logged' : ''}
                {r.aboveRange && r.filter === 'push' ? ' · above range' : ''}
              </span>
              <span className="text-xs text-muted text-right">{r.bodyweight ? 'bodyweight' : r.filter === 'stay' && r.loadText ? `${r.loadText} kg` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/train" className="text-[13px] text-[#9fc0ff] py-1">
        Back to Train
      </Link>
    </main>
  )
}
