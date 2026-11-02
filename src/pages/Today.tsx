import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TalkBar from '../components/TalkBar.tsx'
import { Bar, Card, Empty, ErrorNote, Eyebrow, SectionTitle, Title } from '../components/ui.tsx'
import { dayTotals, fetchActivities, fetchDay, fetchSessions, lastDoneDay, type ActivityRow, type SessionRow } from '../lib/data.ts'
import { shortDate, timeHm, todayIso } from '../lib/dates.ts'
import { formatKcal, periodOf, remaining, restOfDayPlan } from '../lib/fuel.ts'
import { activityText } from '../lib/logCards.ts'
import { DAY_LABEL } from '../lib/program.ts'
import { nextDay, slotsFor } from '../lib/sessionPlan.ts'
import { programWeek, TARGETS } from '../lib/targets.ts'
import { useAsync } from '../lib/useAsync.ts'

function sessionStats(s: SessionRow) {
  let reps = 0
  let ups = 0
  for (const e of s.session_exercises) {
    for (const st of e.sets ?? []) reps += st.reps
    if (e.verdict === 'push') ups++
  }
  return { exercises: s.session_exercises.length, reps, ups }
}

export default function Today() {
  const date = todayIso()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const { data, error, loading } = useAsync(async () => {
    const [sessions, day, activities] = await Promise.all([fetchSessions(), fetchDay(date), fetchActivities(date)])
    return { sessions, day, activities }
  }, [date])

  const sessions = data?.sessions ?? []
  const day = data?.day ?? null
  const doneToday = sessions.find(s => s.date === date && s.status === 'done') ?? null
  const liveToday = sessions.find(s => s.status === 'in-progress') ?? null
  const upcoming = nextDay(lastDoneDay(sessions))
  const totals = dayTotals(day)
  const rem = remaining(totals)
  const plan = restOfDayPlan(totals, periodOf(new Date().getHours()))
  const lastMeal = day?.meals.length ? day.meals[day.meals.length - 1] : null
  const moved = movementSummary(data?.activities ?? [])

  return (
    <main className="flex-1 flex flex-col gap-3.5 px-5 pt-7 pb-3">
      <header className="flex justify-between items-end">
        <div>
          <Eyebrow>
            {shortDate(date)} · Lean bulk · Week {programWeek(date)}
          </Eyebrow>
          <Title>Today</Title>
        </div>
        <div className="flex gap-1 items-end" aria-hidden="true">
          <span className="w-[9px] h-[34px] rounded-[3px] bg-plate-red" />
          <span className="w-[9px] h-[30px] rounded-[3px] bg-plate-blue" />
          <span className="w-[9px] h-[26px] rounded-[3px] bg-plate-yellow" />
          <span className="w-[9px] h-[22px] rounded-[3px] bg-plate-green" />
        </div>
      </header>

      {error && <ErrorNote>Couldn't load today: {error}</ErrorNote>}

      {doneToday ? (
        <Link to="/train/progress" className="no-underline">
          <Card tone="green" className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
              Session done{doneToday.ended_at ? ` · ${timeHm(new Date(doneToday.ended_at))}` : ''}
            </span>
            <span className="font-display font-extrabold text-3xl leading-none uppercase">{DAY_LABEL[doneToday.day]}</span>
            {(() => {
              const st = sessionStats(doneToday)
              return (
                <span className="flex gap-4 text-sm font-semibold">
                  <span>{st.exercises} exercises</span>
                  <span>{st.reps} reps</span>
                  <span>{st.ups} lifts go up</span>
                </span>
              )
            })()}
            <span className="text-[13px] underline">See push or stay</span>
          </Card>
        </Link>
      ) : liveToday ? (
        <Link to="/train" className="no-underline">
          <Card tone="blue" className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em]">Session in progress</span>
            <span className="font-display font-extrabold text-3xl leading-none uppercase">{DAY_LABEL[liveToday.day]}</span>
            <span className="text-sm font-semibold">
              {liveToday.session_exercises.length} of {slotsFor(liveToday.day).length} exercises logged
            </span>
            <span className="text-[13px] underline">Back to the coach</span>
          </Card>
        </Link>
      ) : (
        !loading && (
          <Link to="/train" className="no-underline">
            <Card tone="outline" className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Next session</span>
              <span className="font-display font-extrabold text-3xl leading-none uppercase">{DAY_LABEL[upcoming]}</span>
              <span className="text-sm text-muted">{slotsFor(upcoming).length} exercises · tap to start the coach</span>
            </Card>
          </Link>
        )
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <SectionTitle>Fuel so far</SectionTitle>
          <span className="font-mono text-[11px] text-muted">{lastMeal ? `after ${(lastMeal.slot ?? lastMeal.name).toLowerCase()}` : 'nothing logged yet'}</span>
        </div>
        <Row label="Calories" value={`${formatKcal(totals.kcal)} / ${formatKcal(TARGETS.kcal)}`} tone={rem.kcalOver ? 'text-plate-red' : ''}>
          <Bar value={totals.kcal} max={TARGETS.kcal} color="#e5483d" />
        </Row>
        <Row label="Protein" value={rem.proteinMet ? `${totals.protein_g} g · target met` : `${totals.protein_g} / ${TARGETS.protein_min_g} g`} tone={rem.proteinMet ? 'text-mint' : ''}>
          <Bar value={totals.protein_g} max={TARGETS.protein_min_g} color="#4a7be0" />
        </Row>
        <Row label="Fiber" value={`${Math.round(totals.fiber_g)} / ${TARGETS.fiber_min_g} g`} tone={rem.fiberMet ? 'text-mint' : 'text-plate-yellow'}>
          <Bar value={totals.fiber_g} max={TARGETS.fiber_min_g} color="#f2be1a" />
        </Row>
        <Row label="Water" value={`~${(totals.water_ml / 1000).toFixed(1)} / ${TARGETS.water_ml / 1000} L`}>
          <Bar value={totals.water_ml} max={TARGETS.water_ml} color="#8fd3e8" />
        </Row>
        {moved && (
          <Row label="Moved" value={moved.text} tone="text-mint">
            {moved.steps !== null ? <Bar value={moved.steps} max={TARGETS.steps} color="#2fae64" /> : null}
          </Row>
        )}
      </Card>

      <Card tone="outline" className="flex flex-col gap-2.5">
        <div className="flex gap-2 items-center">
          <span className="w-[22px] h-[22px] rounded-full bg-ink text-ground grid place-items-center font-bold text-xs" aria-hidden="true">
            C
          </span>
          <SectionTitle>Rest of today</SectionTitle>
        </div>
        {plan.length === 0 ? (
          <Empty>All targets met. Nothing else to do today.</Empty>
        ) : (
          <div className="grid grid-cols-[70px_1fr] gap-x-2.5 gap-y-1.5 text-sm leading-[1.35]">
            {plan.map(l => (
              <PlanLine key={l.label} label={l.label} text={l.text} />
            ))}
          </div>
        )}
      </Card>

      {doneToday && (
        <Link to="/train" className="flex justify-between items-center py-1 px-0.5 no-underline text-ink">
          <span className="flex flex-col">
            <span className="font-mono text-[11px] text-muted uppercase tracking-[0.08em]">Next session</span>
            <span className="font-display font-bold text-[22px] uppercase">
              {DAY_LABEL[upcoming]} · {slotsFor(upcoming).length} exercises
            </span>
          </span>
          <span className="text-[13px] text-[#9fc0ff]">Preview</span>
        </Link>
      )}

      <div className="mt-auto pt-2">
        <TalkBar
          value={text}
          onChange={setText}
          placeholder="Tell Claude what you ate or lifted"
          onSubmit={() => navigate('/log', { state: { text } })}
        />
      </div>
    </main>
  )
}

/** One line for today's walks and steps: bouts joined, steps summed. */
function movementSummary(activities: ActivityRow[]): { text: string; steps: number | null } | null {
  if (activities.length === 0) return null
  const steps = activities.reduce((n, a) => n + (a.steps ?? 0), 0)
  const bouts = activities.filter(a => a.kind !== 'steps' || a.minutes !== null || a.km !== null).map(a => activityText({ ...a, activity: a.kind, steps: null }))
  const parts = bouts.filter(Boolean)
  if (steps > 0) parts.push(`${steps.toLocaleString('en-US')} steps`)
  return { text: parts.join(' + '), steps: steps > 0 ? steps : null }
}

function Row({ label, value, tone = '', children }: { label: string; value: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[13px]">
        <span>{label}</span>
        <span className={`font-mono ${tone}`}>{value}</span>
      </div>
      {children}
    </div>
  )
}

function PlanLine({ label, text }: { label: string; text: string }) {
  return (
    <>
      <span className="font-mono text-xs text-muted">{label}</span>
      <span>{text}</span>
    </>
  )
}
