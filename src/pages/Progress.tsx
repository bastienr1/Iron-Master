/**
 * /progress — Push or stay. One row per lift from its latest session, plus the
 * program slots never logged. Phone first (390 px), dark ground.
 */
import { useEffect, useMemo, useState } from 'react'
import { signOut } from '../lib/auth.ts'
import { loadLoggedExercises } from '../lib/progressData.ts'
import { buildProgressRows, countRows, formatDateShort, type ProgressFilter, type ProgressRow } from '../lib/progressRows.ts'

const FILTERS: { key: ProgressFilter; label: string }[] = [
  { key: 'push', label: 'Push' },
  { key: 'stay', label: 'Stay' },
  { key: 'new', label: 'New' },
]

export default function Progress() {
  const [rows, setRows] = useState<ProgressRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ProgressFilter>('push')

  useEffect(() => {
    let cancelled = false
    loadLoggedExercises()
      .then(records => {
        if (!cancelled) setRows(buildProgressRows(records))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your sessions.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => (rows ? countRows(rows) : { push: 0, stay: 0, new: 0 }), [rows])
  const visible = useMemo(() => (rows ?? []).filter(r => r.filter === filter), [rows, filter])

  return (
    <main className="min-h-screen bg-ground text-ink max-w-md mx-auto px-4 pt-6 pb-16">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted">
            Double progression · from your last sessions
          </p>
          <h1 className="font-display font-extrabold text-[44px] leading-[0.95] uppercase mt-1">Push or stay</h1>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-11 min-w-11 px-3 rounded-md border border-line font-sans text-xs text-muted"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </header>

      <div role="tablist" aria-label="Filter" className="mt-6 flex gap-2">
        {FILTERS.map(f => {
          const active = f.key === filter
          const tone =
            f.key === 'push' ? 'text-plate-green border-plate-green' : f.key === 'stay' ? 'text-plate-blue border-plate-blue' : 'text-plate-yellow border-plate-yellow'
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`min-h-11 flex-1 rounded-full border px-3 font-display font-bold text-base uppercase tracking-wide ${
                active ? `${tone} bg-surface` : 'border-line text-muted'
              }`}
            >
              {f.label}
              <span className="ml-2 font-mono text-sm font-medium">{counts[f.key]}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-8 rounded-lg border border-plate-red/40 bg-surface p-4 font-sans text-sm text-plate-red">
          Couldn't load your sessions: {error}
        </p>
      )}

      {!error && rows === null && <p className="mt-8 font-sans text-muted">Loading your lifts…</p>}

      {rows && rows.length === 0 && (
        <p className="mt-8 font-sans text-muted">No sessions yet. Run the vault import, then come back.</p>
      )}

      {rows && rows.length > 0 && visible.length === 0 && (
        <p className="mt-8 font-sans text-muted">
          {filter === 'push' && 'Nothing to push yet. Hit the top of the range on every set first.'}
          {filter === 'stay' && 'Nothing to hold. Every logged lift is ready to move up.'}
          {filter === 'new' && 'Every lift in the program has been logged.'}
        </p>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-line">
        {visible.map(r => (
          <li key={r.key} className="py-4 min-h-11">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display font-bold text-2xl leading-tight">{r.name}</h2>
              {r.filter === 'new' && (
                <span className="shrink-0 rounded-full border border-plate-yellow/60 px-2 py-0.5 font-sans text-[11px] uppercase tracking-wide text-plate-yellow">
                  New
                </span>
              )}
              {r.bodyweight && (
                <span className="shrink-0 rounded-full border border-plate-blue/60 px-2 py-0.5 font-sans text-[11px] uppercase tracking-wide text-plate-blue">
                  Bodyweight
                </span>
              )}
              {r.aboveRange && r.filter === 'push' && (
                <span className="shrink-0 rounded-full border border-plate-green/60 px-2 py-0.5 font-sans text-[11px] uppercase tracking-wide text-plate-green">
                  Above range
                </span>
              )}
            </div>

            {r.filter === 'push' && (
              <p className="mt-1 font-mono text-lg text-plate-green">
                {r.loadText} <span className="text-muted">→</span> {r.nextLoadText}
              </p>
            )}
            {r.filter === 'stay' && (
              <p className="mt-1 font-sans text-base text-plate-blue">
                {r.bodyweight ? r.nextLoadText : r.reason}
                {!r.bodyweight && r.loadText ? <span className="font-mono text-muted"> · {r.loadText} kg</span> : null}
              </p>
            )}
            {r.filter === 'new' && <p className="mt-1 font-sans text-base text-muted">In the program, never logged</p>}

            <p className="mt-1 font-sans text-sm text-muted">
              {r.dayLabel}
              {r.date ? ` · ${formatDateShort(r.date)}` : ''}
              {r.reps.length ? <span className="font-mono"> · {r.reps.join(' · ')}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
