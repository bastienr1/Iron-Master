/**
 * Train — the session coach. Start the next day in the rotation, log sets as
 * you go (saved on every entry), rest timer with the program's cues, then End
 * computes push-or-stay for every lift.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, ErrorNote, Eyebrow, GhostButton, PrimaryButton, Title, VerdictChip } from '../components/ui.tsx'
import {
  carriedAimFor,
  decideFor,
  deleteSession,
  endSession,
  fetchSessions,
  lastDoneDay,
  startSession,
  toLoggedRecords,
  upsertSessionExercise,
  type SessionRow,
  type SetEntry,
} from '../lib/data.ts'
import { mmss, todayIso } from '../lib/dates.ts'
import { DAY_LABEL, DAYS, type Day } from '../lib/program.ts'
import { CUES, latestByExercise, nextDay, prescribe, slotsFor, type Prescription } from '../lib/sessionPlan.ts'
import { useAsync } from '../lib/useAsync.ts'

export default function Train() {
  const navigate = useNavigate()
  const sessionsState = useAsync(fetchSessions, [])
  const sessions = useMemo(() => sessionsState.data ?? [], [sessionsState.data])
  const live = sessions.find(s => s.status === 'in-progress') ?? null
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (sessionsState.error) return <main className="p-5"><ErrorNote>{sessionsState.error}</ErrorNote></main>
  if (sessionsState.loading) return <main className="p-5 text-muted">Loading…</main>

  if (live) {
    return (
      <Coach
        session={live}
        sessions={sessions}
        onChanged={() => sessionsState.reload()}
        onEnded={() => {
          sessionsState.reload()
          navigate('/train/progress')
        }}
      />
    )
  }

  async function start(day: Day) {
    setBusy(true)
    setErr(null)
    try {
      await startSession(todayIso(), day)
      sessionsState.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return <StartScreen sessions={sessions} busy={busy} error={err} onStart={day => void start(day)} />
}

// ---------------------------------------------------------------------------

function StartScreen({ sessions, busy, error, onStart }: { sessions: SessionRow[]; busy: boolean; error: string | null; onStart: (d: Day) => void }) {
  const [day, setDay] = useState<Day>(() => nextDay(lastDoneDay(sessions)))
  const latest = useMemo(() => latestByExercise(toLoggedRecords(sessions)), [sessions])
  const plan = prescribe(day, latest)
  const suggested = nextDay(lastDoneDay(sessions))
  return (
    <main className="flex-1 flex flex-col gap-3 px-5 pt-7 pb-3">
      <header>
        <Eyebrow>{day === suggested ? 'Next in the rotation' : 'Off rotation'}</Eyebrow>
        <Title>{DAY_LABEL[day]}</Title>
      </header>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Day">
        {DAYS.map(d => (
          <button key={d} type="button" onClick={() => setDay(d)} className={`min-h-11 rounded-xl font-display font-bold text-base uppercase ${d === day ? 'bg-plate-blue text-white' : 'bg-surface text-muted'}`}>
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Card className="flex flex-col divide-y divide-line px-3.5 py-1">
        {plan.map(p => (
          <div key={p.key} className="grid grid-cols-[1fr_auto_auto] gap-2.5 items-center py-2.5 text-sm">
            <span className="flex flex-col">
              <span>{p.name}</span>
              <span className="text-xs text-muted">{p.rangeText}</span>
            </span>
            <span className={`font-mono text-xs ${p.verdict === 'new' ? 'text-muted' : ''}`}>{p.loadKg !== null ? `${p.loadKg} kg` : p.loadText}</span>
            <VerdictChip verdict={p.verdict} />
          </div>
        ))}
      </Card>
      <PrimaryButton onClick={() => onStart(day)} disabled={busy} className="min-h-12 bg-plate-green text-ground font-display font-bold text-lg uppercase tracking-wide">
        {busy ? 'Starting…' : `Start ${DAY_LABEL[day]}`}
      </PrimaryButton>
      <Link to="/train/progress" className="text-center text-[13px] text-[#9fc0ff] py-2">
        See push or stay for every lift
      </Link>
    </main>
  )
}

// ---------------------------------------------------------------------------

function restKey(sessionId: string) {
  return `im.rest.${sessionId}`
}

function Coach({ session, sessions, onChanged, onEnded }: { session: SessionRow; sessions: SessionRow[]; onChanged: () => void; onEnded: () => void }) {
  const others = useMemo(() => sessions.filter(s => s.id !== session.id), [sessions, session.id])
  const latest = useMemo(() => latestByExercise(toLoggedRecords(others)), [others])
  const plan = useMemo(() => prescribe(session.day, latest), [session.day, latest])
  const slots = slotsFor(session.day)

  // Local copy of the logged exercises, keyed by slot position; persisted on every set.
  const [logged, setLogged] = useState<Map<number, { load_kg: number | null; implements: number; sets: SetEntry[] }>>(() => {
    const m = new Map<number, { load_kg: number | null; implements: number; sets: SetEntry[] }>()
    for (const e of session.session_exercises) m.set(e.position, { load_kg: e.load_kg, implements: e.implements, sets: e.sets ?? [] })
    return m
  })
  const firstOpen = slots.findIndex(s => (logged.get(s.position)?.sets.length ?? 0) < s.sets)
  const [index, setIndex] = useState(firstOpen < 0 ? 0 : firstOpen)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [restEnd, setRestEnd] = useState<number | null>(() => {
    const v = localStorage.getItem(restKey(session.id))
    return v ? Number(v) : null
  })
  const [restTotal, setRestTotal] = useState(120)
  // A ticking clock (set only from the interval, never during render).
  const [clock, setClock] = useState<number | null>(null)
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  const slot = slots[index]
  const p: Prescription | undefined = plan[index]
  const cur = logged.get(slot.position) ?? { load_kg: p?.loadKg ?? null, implements: 1, sets: [] }
  const [loadInput, setLoadInput] = useState<string>(cur.load_kg === null ? '' : String(cur.load_kg))
  const [repsInput, setRepsInput] = useState('')
  // When the exercise changes, reset the inputs to that lift's load.
  const [inputsFor, setInputsFor] = useState(index)
  if (inputsFor !== index) {
    setInputsFor(index)
    const c = logged.get(slot.position)
    const v = c ? c.load_kg : (p?.loadKg ?? null)
    setLoadInput(v === null ? '' : String(v))
    setRepsInput('')
  }

  const startedMin = session.started_at && clock !== null ? Math.max(0, Math.round((clock - new Date(session.started_at).getTime()) / 60000)) : 0
  const restLeft = restEnd === null ? 0 : clock === null ? restTotal : Math.max(0, (restEnd - clock) / 1000)
  const restPct = restEnd === null ? 0 : Math.min(100, Math.max(0, 100 - (restLeft / restTotal) * 100))

  async function persist(position: number, next: { load_kg: number | null; implements: number; sets: SetEntry[] }, exerciseKey: string, name: string) {
    setSaving(true)
    setErr(null)
    try {
      await upsertSessionExercise(session, position, { exercise_key: exerciseKey, raw_name: name, load_kg: next.load_kg, implements: next.implements, sets: next.sets }, null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function addSet() {
    const reps = Number(repsInput)
    if (!Number.isInteger(reps) || reps <= 0) return
    const load = loadInput.trim() === '' ? null : Number(loadInput)
    const next = { load_kg: Number.isFinite(load as number) ? load : null, implements: cur.implements, sets: [...cur.sets, { reps }] }
    setLogged(prev => new Map(prev).set(slot.position, next))
    setRepsInput('')
    void persist(slot.position, next, slot.exercise_key, p?.name ?? slot.exercise_key)
    const total = p?.restSeconds ?? 120
    const end = Date.now() + total * 1000
    setRestTotal(total)
    setRestEnd(end)
    localStorage.setItem(restKey(session.id), String(end))
    if (next.sets.length >= slot.sets && index < slots.length - 1) {
      // move on once the programmed sets are in; the user can tap back
      window.setTimeout(() => setIndex(i => (i === index ? i + 1 : i)), 400)
    }
  }

  function undoSet() {
    if (!cur.sets.length) return
    const next = { ...cur, sets: cur.sets.slice(0, -1) }
    setLogged(prev => new Map(prev).set(slot.position, next))
    void persist(slot.position, next, slot.exercise_key, p?.name ?? slot.exercise_key)
  }

  function skipRest() {
    setRestEnd(null)
    localStorage.removeItem(restKey(session.id))
  }

  async function end() {
    setEnding(true)
    setErr(null)
    try {
      const entries = [...logged.entries()].filter(([, v]) => v.sets.length > 0)
      if (entries.length === 0) {
        await deleteSession(session.id)
        localStorage.removeItem(restKey(session.id))
        onChanged()
        return
      }
      for (const [position, v] of entries) {
        const s = slots.find(x => x.position === position)
        if (!s) continue
        const carried = carriedAimFor(others, s.exercise_key, session.date)
        const decided = decideFor(session.day, s.exercise_key, v.sets, v.load_kg, carried)
        await upsertSessionExercise(session, position, { exercise_key: s.exercise_key, raw_name: plan.find(x => x.key === s.exercise_key)?.name ?? null, load_kg: v.load_kg, implements: v.implements, sets: v.sets }, decided)
      }
      await endSession(session.id)
      localStorage.removeItem(restKey(session.id))
      onEnded()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setEnding(false)
    }
  }

  const done = cur.sets.length >= slot.sets
  const cue1 = CUES[index % CUES.length]
  const cue2 = CUES[(index + 1) % CUES.length]

  return (
    <main className="flex-1 flex flex-col gap-3 px-4 pt-7 pb-3">
      <header className="px-1 flex flex-col gap-2.5">
        <div className="flex justify-between items-end">
          <div>
            <Eyebrow>
              Exercise {index + 1} of {slots.length} · {startedMin} min in
            </Eyebrow>
            <Title>{DAY_LABEL[session.day]}</Title>
          </div>
          <GhostButton onClick={() => void end()} disabled={ending}>
            {ending ? 'Ending…' : 'End'}
          </GhostButton>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }} aria-label="Session progress">
          {slots.map((s, i) => {
            const n = logged.get(s.position)?.sets.length ?? 0
            const cls = n >= s.sets ? 'bg-plate-green' : i === index ? 'bg-plate-blue' : n > 0 ? 'bg-plate-blue/50' : 'bg-line'
            return <button key={s.position} type="button" aria-label={`Exercise ${i + 1}`} onClick={() => setIndex(i)} className={`h-1.5 rounded-sm ${cls}`} />
          })}
        </div>
      </header>

      {err && <ErrorNote>{err}</ErrorNote>}

      <Card tone="blue" className="flex flex-col gap-3 rounded-[22px] p-[18px]">
        <div className="flex justify-between items-baseline gap-2">
          <span className="font-display font-extrabold text-[28px] leading-none uppercase">{p?.name ?? slot.exercise_key}</span>
          <span className="font-mono text-[11px]">{p?.rangeText}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <input
            inputMode="decimal"
            value={loadInput}
            onChange={e => setLoadInput(e.target.value)}
            onBlur={() => {
              const load = loadInput.trim() === '' ? null : Number(loadInput)
              if (load === cur.load_kg) return
              const next = { ...cur, load_kg: Number.isFinite(load as number) ? load : null }
              setLogged(prev => new Map(prev).set(slot.position, next))
              if (cur.sets.length) void persist(slot.position, next, slot.exercise_key, p?.name ?? slot.exercise_key)
            }}
            placeholder={p?.verdict === 'new' ? '—' : 'BW'}
            aria-label="Load in kg"
            className="w-[150px] bg-transparent font-display font-extrabold text-[72px] leading-[0.85] tabular-nums outline-none placeholder:text-white/40"
          />
          <span className="font-display font-bold text-[22px]">KG</span>
          <span className="ml-auto">{p && <VerdictChip verdict={p.verdict} size="lg" />}</span>
        </div>
        <span className="text-sm leading-[1.35]">{p?.cue}</span>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${slot.sets}, minmax(0, 1fr))` }}>
          {Array.from({ length: slot.sets }, (_, i) => {
            const s = cur.sets[i]
            const last = p?.lastReps[i]
            const isNext = i === cur.sets.length
            if (s) {
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 bg-white text-[#1e3f8f] rounded-xl py-2">
                  <span className="font-mono text-[10px]">SET {i + 1}</span>
                  <span className="font-display font-extrabold text-[26px] leading-none">{s.reps}</span>
                  <span className="text-[10px]">{last !== undefined ? `last ${last}` : ''}</span>
                </div>
              )
            }
            if (isNext) {
              return (
                <form
                  key={i}
                  onSubmit={e => {
                    e.preventDefault()
                    addSet()
                  }}
                  className="flex flex-col items-center gap-0.5 border-2 border-white rounded-xl py-1.5"
                >
                  <span className="font-mono text-[10px]">SET {i + 1}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={repsInput}
                    onChange={e => setRepsInput(e.target.value)}
                    placeholder={last !== undefined ? String(last) : String(slot.rep_max)}
                    aria-label={`Reps for set ${i + 1}`}
                    enterKeyHint="done"
                    className="w-11 text-center bg-transparent text-white font-display font-extrabold text-[26px] leading-none outline-none placeholder:text-white/40"
                  />
                  <span className="text-[10px]">{last !== undefined ? `last ${last}` : 'tap, enter'}</span>
                </form>
              )
            }
            return (
              <div key={i} className="flex flex-col items-center gap-0.5 bg-white/15 rounded-xl py-2">
                <span className="font-mono text-[10px]">SET {i + 1}</span>
                <span className="font-display font-extrabold text-[26px] leading-none">–</span>
                <span className="text-[10px]">{last !== undefined ? `last ${last}` : ''}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          {!done && (
            <button type="button" onClick={addSet} disabled={!repsInput || saving} className="flex-1 min-h-11 rounded-full bg-white text-[#1e3f8f] font-semibold text-sm disabled:opacity-50">
              Log set {cur.sets.length + 1}
            </button>
          )}
          {cur.sets.length > 0 && (
            <button type="button" onClick={undoSet} className="min-h-11 px-4 rounded-full border border-white/60 text-white text-sm">
              Undo
            </button>
          )}
          {done && index < slots.length - 1 && (
            <button type="button" onClick={() => setIndex(index + 1)} className="flex-1 min-h-11 rounded-full bg-white text-[#1e3f8f] font-semibold text-sm">
              Next exercise
            </button>
          )}
        </div>
      </Card>

      <button type="button" onClick={skipRest} className="grid grid-cols-[96px_1fr] gap-3 items-center bg-surface rounded-[18px] p-3.5 text-left">
        <div className="w-24 h-24 rounded-full grid place-items-center" style={{ background: `conic-gradient(#f2be1a 0 ${restPct}%, #2c3836 ${restPct}% 100%)` }}>
          <div className="w-20 h-20 rounded-full bg-surface grid place-items-center">
            <span className="font-display font-extrabold text-[28px] leading-none tabular-nums">{restEnd === null ? '–:––' : mmss(restLeft)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] leading-[1.35]">
          <span className="font-mono text-[11px] text-plate-yellow uppercase tracking-[0.06em]">
            {restEnd === null ? `Rest · ${Math.round((p?.restSeconds ?? 120) / 60)} min after each set` : restLeft <= 0 ? 'Go' : `Rest · ${Math.round(restTotal / 60)} min`}
          </span>
          <span>{cue1}</span>
          <span>{cue2}</span>
        </div>
      </button>

      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted pb-1">Up next</span>
        {plan.slice(index + 1).map((q, i) => (
          <button key={q.key} type="button" onClick={() => setIndex(index + 1 + i)} className="grid grid-cols-[1fr_auto_auto] gap-2.5 items-center py-2 border-b border-line text-sm text-left">
            <span>
              {q.name}
              {q.slot.rep_min !== q.slot.rep_max && q.slot.rep_min >= 12 ? ` · ${q.slot.rep_min}–${q.slot.rep_max} reps` : ''}
            </span>
            <span className={`font-mono text-xs ${q.verdict === 'new' ? 'text-muted' : ''}`}>{q.loadKg !== null ? `${q.loadKg} kg` : q.loadText}</span>
            <VerdictChip verdict={q.verdict} />
          </button>
        ))}
        {index === slots.length - 1 && <span className="text-sm text-muted py-2">Last one. Tap End when you're done.</span>}
      </div>
    </main>
  )
}
