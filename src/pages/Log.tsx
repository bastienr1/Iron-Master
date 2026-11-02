/**
 * Log — talk to log. You say it, Claude turns it into cards, nothing saves
 * until you confirm each card.
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import TalkBar from '../components/TalkBar.tsx'
import { AccuracyDot, AccuracyLegend, ErrorNote, Eyebrow, GhostButton, PrimaryButton, Title, VerdictChip } from '../components/ui.tsx'
import {
  addActivity,
  addMeal,
  addWater,
  buildParseContext,
  bumpLibrary,
  carriedAimFor,
  dayTotals,
  decideFor,
  fetchDay,
  fetchLibrary,
  fetchLogEntries,
  fetchSessions,
  inferDay,
  insertLogEntry,
  parseLog,
  saveSetCard,
  updateLogEntry,
  upsertWeighIn,
  type LogEntryRow,
  type SessionRow,
} from '../lib/data.ts'
import { todayIso } from '../lib/dates.ts'
import { EXERCISES, exerciseName } from '../lib/exercises.ts'
import { findSlot } from '../lib/program.ts'
import { activityText, mealTotals, validateParseResponse, type LogCard, type MealCard, type ParseResponse, type SetCard } from '../lib/logCards.ts'
import { rangeText } from '../lib/sessionPlan.ts'
import { useAsync } from '../lib/useAsync.ts'

const KEYS = new Set(Object.keys(EXERCISES))

interface CardState {
  card: LogCard
  status: 'pending' | 'saved' | 'discarded' | 'error'
  error?: string
  savedText?: string
}

interface EntryView {
  row: LogEntryRow
  cards: CardState[]
  reply: string
  busy: boolean
  error?: string
}

function fromRow(row: LogEntryRow): EntryView {
  const parsed = row.card ? validateParseResponse(row.card, KEYS) : { cards: [], reply: '' }
  const statusAll = row.status === 'pending' ? 'pending' : row.status === 'saved' ? 'saved' : row.status === 'discarded' ? 'discarded' : 'error'
  return { row, cards: parsed.cards.map(card => ({ card, status: statusAll })), reply: parsed.reply, busy: false, error: row.error ?? undefined }
}

export default function Log() {
  const location = useLocation()
  const date = todayIso()
  const [text, setText] = useState('')
  const [entries, setEntries] = useState<EntryView[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoSent = useRef(false)

  const base = useAsync(async () => {
    const [rows, sessions, library, day] = await Promise.all([fetchLogEntries(), fetchSessions(), fetchLibrary(), fetchDay(date)])
    return { rows, sessions, library, day }
  }, [date])

  // Seed the conversation from the stored entries once they arrive (and again
  // only when the rows themselves are refetched).
  const [seededRows, setSeededRows] = useState<LogEntryRow[] | null>(null)
  if (base.data && base.data.rows !== seededRows) {
    setSeededRows(base.data.rows)
    setEntries(base.data.rows.map(fromRow))
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [entries.length, sending])

  const incoming = (location.state as { text?: string } | null)?.text
  useEffect(() => {
    if (incoming && base.data && !autoSent.current) {
      autoSent.current = true
      void send(incoming)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, base.data])

  function patchEntry(id: string, fn: (e: EntryView) => EntryView) {
    setEntries(prev => prev.map(e => (e.row.id === id ? fn(e) : e)))
  }

  async function send(raw: string) {
    const msg = raw.trim()
    if (!msg || !base.data) return
    setSending(true)
    setError(null)
    setText('')
    let row: LogEntryRow
    try {
      row = await insertLogEntry(msg)
    } catch (e) {
      setSending(false)
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    setEntries(prev => [...prev, { row, cards: [], reply: '', busy: true }])
    try {
      const ctx = buildParseContext({ sessions: base.data.sessions, library: base.data.library, today: dayTotals(base.data.day) })
      const res: ParseResponse = await parseLog(msg, ctx)
      const kind = res.cards[0]?.kind ?? 'unknown'
      await updateLogEntry(row.id, { kind, card: res, status: res.cards.length ? 'pending' : 'saved' })
      patchEntry(row.id, e => ({ ...e, busy: false, reply: res.reply, cards: res.cards.map(card => ({ card, status: 'pending' as const })) }))
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      await updateLogEntry(row.id, { status: 'error', error: m }).catch(() => undefined)
      patchEntry(row.id, en => ({ ...en, busy: false, error: m }))
    } finally {
      setSending(false)
    }
  }

  async function saveCard(entry: EntryView, index: number) {
    if (!base.data) return
    const cs = entry.cards[index]
    try {
      let savedText = 'Saved'
      switch (cs.card.kind) {
        case 'set': {
          const r = await saveSetCard(cs.card, base.data.sessions)
          savedText = `Saved to ${r.session.day.replace('_', ' ').toUpperCase()} · ${r.decided.verdict.toUpperCase()}`
          const sessions = await fetchSessions()
          base.setData(prev => (prev ? { ...prev, sessions } : prev))
          break
        }
        case 'meal': {
          await addMeal(date, { slot: cs.card.slot, name: cs.card.name, items: cs.card.items, raw_text: entry.row.text })
          if (cs.card.library_match) {
            const lib = base.data.library.find(l => l.name === cs.card.kind && l.name === (cs.card as MealCard).library_match)
            if (lib) await bumpLibrary(lib, date)
          }
          savedText = 'Saved to today'
          break
        }
        case 'weigh_in':
          await upsertWeighIn(date, cs.card.kg)
          savedText = 'Weigh-in saved'
          break
        case 'water': {
          const total = await addWater(date, cs.card.ml)
          savedText = `Water: ${(total / 1000).toFixed(1)} L today`
          break
        }
        case 'activity':
          await addActivity(date, cs.card, entry.row.text)
          savedText = 'Saved to today'
          break
        case 'note':
          savedText = 'Kept'
          break
      }
      const cards = entry.cards.map((c, i) => (i === index ? { ...c, status: 'saved' as const, savedText } : c))
      const allDone = cards.every(c => c.status !== 'pending')
      if (allDone) await updateLogEntry(entry.row.id, { status: cards.some(c => c.status === 'saved') ? 'saved' : 'discarded' })
      patchEntry(entry.row.id, e => ({ ...e, cards }))
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      patchEntry(entry.row.id, en => ({ ...en, cards: en.cards.map((c, i) => (i === index ? { ...c, status: 'error', error: m } : c)) }))
    }
  }

  async function discardCard(entry: EntryView, index: number) {
    const cards = entry.cards.map((c, i) => (i === index ? { ...c, status: 'discarded' as const } : c))
    if (cards.every(c => c.status !== 'pending')) await updateLogEntry(entry.row.id, { status: cards.some(c => c.status === 'saved') ? 'saved' : 'discarded' })
    patchEntry(entry.row.id, e => ({ ...e, cards }))
  }

  function editCard(entry: EntryView, index: number, card: LogCard) {
    patchEntry(entry.row.id, e => ({ ...e, cards: e.cards.map((c, i) => (i === index ? { ...c, card } : c)) }))
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="px-5 pt-7 pb-2.5 flex justify-between items-end border-b border-line">
        <div>
          <Eyebrow>Connected to Claude · saves to Supabase</Eyebrow>
          <Title>Log</Title>
        </div>
        <span className={`font-mono text-[11px] ${base.error ? 'text-plate-red' : 'text-mint'}`}>● {base.error ? 'offline' : 'synced'}</span>
      </header>

      <div className="flex-1 flex flex-col gap-3 px-4 py-3.5">
        {base.error && <ErrorNote>{base.error}</ErrorNote>}
        {error && <ErrorNote>{error}</ErrorNote>}
        {!base.loading && entries.length === 0 && (
          <p className="text-muted text-sm px-1">
            Say a set or a meal in your own words. "Front squat 47.5 for 10, 10, 9, 9." "Hao Liao bowl, no sauce." "Weighed 75.4 this morning."
          </p>
        )}
        {entries.map(entry => (
          <div key={entry.row.id} className="flex flex-col gap-3">
            <div className="self-end max-w-[80%] bg-surface-2 rounded-[18px_18px_4px_18px] px-3.5 py-2.5 text-sm leading-[1.4]">{entry.row.text}</div>
            {entry.busy && <div className="self-start text-muted text-sm px-1 animate-pulse">Claude is reading that…</div>}
            {entry.error && (
              <div className="flex flex-col gap-2 items-start">
                <ErrorNote>{entry.error}</ErrorNote>
                <GhostButton onClick={() => void send(entry.row.text)} disabled={sending || base.loading}>
                  Try again
                </GhostButton>
              </div>
            )}
            {entry.cards.map((cs, i) => (
              <CardView
                key={i}
                state={cs}
                sessions={base.data?.sessions ?? []}
                onSave={() => void saveCard(entry, i)}
                onDiscard={() => void discardCard(entry, i)}
                onEdit={card => editCard(entry, i, card)}
              />
            ))}
            {entry.reply && !entry.busy && <div className="self-start max-w-[85%] text-sm text-muted px-1">{entry.reply}</div>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-[88px] px-4 pb-2.5 bg-ground">
        <TalkBar value={text} onChange={setText} onSubmit={() => void send(text)} busy={sending || base.loading} />
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------

function CardView({ state, sessions, onSave, onDiscard, onEdit }: { state: CardState; sessions: SessionRow[]; onSave: () => void; onDiscard: () => void; onEdit: (c: LogCard) => void }) {
  const [editing, setEditing] = useState(false)
  const { card, status } = state
  const footer =
    status === 'pending' ? (
      <div className="flex gap-2">
        <PrimaryButton onClick={onSave} className="flex-1">
          {card.kind === 'meal' ? 'Save to today' : card.kind === 'set' ? 'Save set' : card.kind === 'note' ? 'Keep' : 'Save'}
        </PrimaryButton>
        {(card.kind === 'meal' || card.kind === 'set') && <GhostButton onClick={() => setEditing(v => !v)}>{editing ? 'Done' : 'Edit'}</GhostButton>}
        <GhostButton onClick={onDiscard} className="text-muted">
          ✕
        </GhostButton>
      </div>
    ) : (
      <span className={`font-mono text-[11px] ${status === 'saved' ? 'text-mint' : status === 'error' ? 'text-plate-red' : 'text-muted'}`}>
        {status === 'saved' ? `● ${state.savedText ?? 'Saved'}` : status === 'error' ? `● ${state.error}` : '○ Discarded'}
      </span>
    )

  if (card.kind === 'meal') return <MealCardView card={card} editing={editing} onEdit={onEdit} footer={footer} />
  if (card.kind === 'set') return <SetCardView card={card} sessions={sessions} editing={editing} onEdit={onEdit} footer={footer} />
  return (
    <div className="bg-surface border border-line-2 rounded-[18px] p-3.5 flex flex-col gap-2.5">
      <span className="font-display font-bold text-lg uppercase">
        {card.kind === 'weigh_in' && `Weigh-in · ${card.kg} kg`}
        {card.kind === 'water' && `Water · ${card.ml} ml`}
        {card.kind === 'activity' && activityText(card)}
        {card.kind === 'note' && 'Note'}
      </span>
      {card.kind === 'note' && <p className="text-sm">{card.text}</p>}
      {card.kind !== 'note' && card.note && <p className="text-xs text-muted">{card.note}</p>}
      {footer}
    </div>
  )
}

function MealCardView({ card, editing, onEdit, footer }: { card: MealCard; editing: boolean; onEdit: (c: LogCard) => void; footer: React.ReactNode }) {
  const t = mealTotals(card.items)
  function setItem(i: number, patch: Partial<MealCard['items'][number]>) {
    onEdit({ ...card, items: card.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
  }
  return (
    <div className="bg-surface border border-line-2 rounded-[18px] p-3.5 flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline gap-2">
        {editing ? (
          <input value={card.name} onChange={e => onEdit({ ...card, name: e.target.value })} className="flex-1 bg-transparent border-b border-line font-display font-bold text-lg uppercase outline-none" />
        ) : (
          <span className="font-display font-bold text-lg uppercase">{[card.slot, card.name].filter(Boolean).join(' · ')}</span>
        )}
        <span className="font-mono text-[10px] text-muted">{t.accuracy}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-[13px] tabular-nums">
        <span className="font-mono text-[10px] text-muted">ITEM</span>
        <span className="font-mono text-[10px] text-muted text-right">KCAL</span>
        <span className="font-mono text-[10px] text-muted text-right">PROT</span>
        {card.items.map((it, i) => (
          <MealItemRow key={i} it={it} editing={editing} onChange={p => setItem(i, p)} />
        ))}
        <span className="font-bold border-t border-line-2 pt-1.5">Total{t.fiber_g !== null ? ` · ${t.fiber_g} g fiber` : ''}</span>
        <span className="font-bold text-right border-t border-line-2 pt-1.5">{t.kcal}</span>
        <span className="font-bold text-right border-t border-line-2 pt-1.5">{t.protein_g} g</span>
      </div>
      <AccuracyLegend />
      {card.note && <p className="text-xs text-muted">{card.note}</p>}
      {footer}
    </div>
  )
}

function MealItemRow({ it, editing, onChange }: { it: MealCard['items'][number]; editing: boolean; onChange: (p: Partial<MealCard['items'][number]>) => void }) {
  if (!editing) {
    return (
      <>
        <span>
          <AccuracyDot accuracy={it.accuracy} /> {it.name}
          {it.grams ? <span className="text-muted"> {it.grams} g</span> : null}
        </span>
        <span className="text-right">{it.kcal}</span>
        <span className="text-right">{it.protein_g} g</span>
      </>
    )
  }
  const num = 'w-16 bg-ground border border-line rounded px-1.5 py-1 text-right font-mono text-[13px] outline-none'
  return (
    <>
      <input value={it.name} onChange={e => onChange({ name: e.target.value })} className="bg-ground border border-line rounded px-1.5 py-1 text-[13px] outline-none min-w-0" />
      <input type="number" inputMode="numeric" value={it.kcal} onChange={e => onChange({ kcal: Number(e.target.value) })} className={num} />
      <input type="number" inputMode="decimal" step="0.5" value={it.protein_g} onChange={e => onChange({ protein_g: Number(e.target.value) })} className={num} />
    </>
  )
}

function SetCardView({ card, sessions, editing, onEdit, footer }: { card: SetCard; sessions: SessionRow[]; editing: boolean; onEdit: (c: LogCard) => void; footer: React.ReactNode }) {
  const day = inferDay(card.exercise_key, sessions)
  const slot = findSlot(day, card.exercise_key)
  const carried = carriedAimFor(sessions, card.exercise_key, todayIso())
  const d = decideFor(day, card.exercise_key, card.sets, card.load_kg, carried)
  const loadText = card.load_kg === null ? 'bodyweight' : `${card.implements > 1 ? `${card.implements} × ` : ''}${card.load_kg} kg`
  const tone = d.verdict === 'push' ? 'bg-plate-green text-ground' : 'bg-plate-blue text-white'
  const headline = d.verdict === 'push' ? 'PUSH' : d.verdict === 'progress_bw' ? 'BW UP' : 'STAY'
  const explain =
    d.verdict === 'push'
      ? `Every set hit your target of ${d.target_reps}. Next time ${d.next_load_text}.`
      : d.verdict === 'progress_bw'
        ? 'All sets at the top. Slow the tempo or add a light load next time.'
        : d.reason === 'straight sets first'
          ? 'Rest-paused set counted as not done. Straight sets first.'
          : d.reason === 'finish all sets'
            ? `Only ${card.sets.length} of ${slot?.sets ?? '?'} sets. Finish all sets first.`
            : `Same weight next time. Get all ${slot?.sets ?? card.sets.length} sets to ${d.target_reps}.`
  return (
    <div className="bg-surface border border-line-2 rounded-[18px] p-3.5 flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline gap-2">
        <span className="font-display font-bold text-lg uppercase">
          {exerciseName(card.exercise_key)} · {loadText}
        </span>
        <span className="font-mono text-[10px] text-muted">{slot ? `range ${rangeText(slot)}` : 'not in today’s day'}</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {card.sets.map((s, i) =>
          editing ? (
            <input
              key={i}
              type="number"
              inputMode="numeric"
              value={s.reps}
              onChange={e => onEdit({ ...card, sets: card.sets.map((x, j) => (j === i ? { ...x, reps: Number(e.target.value) } : x)) })}
              className="w-12 text-center py-1.5 rounded-lg bg-ground border border-line font-mono text-sm outline-none"
            />
          ) : (
            <span key={i} className={`min-w-10 text-center py-1.5 px-2 rounded-lg font-mono text-sm font-semibold ${s.reps >= d.target_reps ? 'bg-plate-green text-ground' : 'bg-line text-ink'}`}>
              {s.reps}
              {s.rest_pause ? '*' : ''}
            </span>
          ),
        )}
        {editing && (
          <>
            <button type="button" onClick={() => onEdit({ ...card, sets: [...card.sets, { reps: card.sets[card.sets.length - 1]?.reps ?? 10 }] })} className="min-w-10 px-2 rounded-lg border border-line text-sm">
              + set
            </button>
            <label className="flex items-center gap-1 text-xs text-muted ml-1">
              kg
              <input type="number" inputMode="decimal" step="0.5" value={card.load_kg ?? ''} onChange={e => onEdit({ ...card, load_kg: e.target.value === '' ? null : Number(e.target.value) })} className="w-16 bg-ground border border-line rounded px-1.5 py-1 font-mono text-[13px] outline-none" />
            </label>
          </>
        )}
      </div>
      <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${tone}`}>
        <span className="font-display font-extrabold text-[26px] leading-none">{headline}</span>
        <span className="text-[13px] leading-[1.3] font-semibold">{explain}</span>
      </div>
      {card.note && <p className="text-xs text-muted">{card.note}</p>}
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <VerdictChip verdict={d.verdict} /> counts toward {day.replace('_', ' ').toUpperCase()}
      </div>
      {footer}
    </div>
  )
}
