/**
 * Recap — the week at a glance, plus the link to the Sunday story.
 */
import { useMemo, useState } from 'react'
import { Card, ErrorNote, Eyebrow, GhostButton, SectionTitle, Title } from '../components/ui.tsx'
import { signOut } from '../lib/auth.ts'
import { fetchDays, fetchSessions, fetchWeighIns } from '../lib/data.ts'
import { dayMonth, todayIso } from '../lib/dates.ts'
import { formatKcal } from '../lib/fuel.ts'
import { buildRecap, formatRange } from '../lib/recap.ts'
import { TARGETS } from '../lib/targets.ts'
import { useAsync } from '../lib/useAsync.ts'

const STORY_URL = 'https://claude.ai/artifact/9RP67WjhdGqnCZae1ndGuZ'

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10)
}

export default function Recap() {
  const [anchor, setAnchor] = useState(todayIso())
  const state = useAsync(async () => {
    const [sessions, days, weighIns] = await Promise.all([fetchSessions(), fetchDays(), fetchWeighIns()])
    return { sessions, days, weighIns }
  }, [])

  const recap = useMemo(() => {
    if (!state.data) return null
    const sessions = state.data.sessions
      .filter(s => s.status === 'done')
      .map(s => ({ date: s.date, day: s.day, exercises: s.session_exercises.map(e => ({ verdict: e.verdict, sets: e.sets ?? [] })) }))
    const days = state.data.days.map(d => ({ date: d.date, kcal: d.kcal, protein_g: d.protein_g, fiber_g: d.fiber_g, status: d.status }))
    return buildRecap(anchor, sessions, days, state.data.weighIns)
  }, [state.data, anchor])

  const maxBar = Math.max(TARGETS.kcal * 1.1, ...(recap?.bars.map(b => b.kcal ?? 0) ?? [0]))
  const targetPct = (TARGETS.kcal / maxBar) * 100

  return (
    <main className="flex-1 flex flex-col gap-3.5 px-4 pt-7 pb-3">
      <header className="px-1 flex justify-between items-end">
        <div>
          <Eyebrow>Built every Sunday at 17:12</Eyebrow>
          <Title>Recap</Title>
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous week" onClick={() => setAnchor(a => shiftDays(a, -7))} className="min-w-11 min-h-11 rounded-full border border-line text-muted">
            ‹
          </button>
          <button type="button" aria-label="Next week" onClick={() => setAnchor(a => shiftDays(a, 7))} disabled={anchor >= todayIso()} className="min-w-11 min-h-11 rounded-full border border-line text-muted disabled:opacity-40">
            ›
          </button>
        </div>
      </header>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      {recap && (
        <>
          <div className="rounded-[22px] p-[3px]" style={{ background: 'linear-gradient(160deg, #e5483d 0 30%, #4a7be0 30% 58%, #f2be1a 58% 80%, #2fae64 80%)' }}>
            <div className="bg-ground rounded-[19px] p-[18px] flex flex-col gap-3.5">
              <div>
                <Eyebrow>
                  Week {recap.week.isoWeek} · {formatRange(recap.week)}
                </Eyebrow>
                <span className="font-display font-extrabold text-3xl leading-none uppercase">{recap.headline}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Sessions" value={`${recap.sessions}/${recap.sessionsPlanned}`} />
                <Stat label="Reps" value={String(recap.reps)} />
                <Stat label="Level ups" value={String(recap.levelUps)} />
                <Stat label="Avg kcal" value={recap.avgKcal === null ? '–' : formatKcal(recap.avgKcal)} />
              </div>
              <a href={STORY_URL} target="_blank" rel="noreferrer" className="min-h-12 rounded-full bg-ink text-ground flex items-center justify-center gap-2 font-bold text-[15px] no-underline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#101615" aria-hidden="true">
                  <path d="M7 4v16l13-8z" />
                </svg>
                Play your week
              </a>
            </div>
          </div>

          <Card className="flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <SectionTitle>Calories by day</SectionTitle>
              <span className="font-mono text-[11px] text-muted">--- {formatKcal(TARGETS.kcal)}</span>
            </div>
            <div className="relative grid grid-cols-7 gap-2 items-end h-[124px]">
              <div className="absolute left-0 right-0 border-t-2 border-dashed border-muted" style={{ bottom: `${targetPct}%` }} aria-hidden="true" />
              {recap.bars.map(b => {
                const h = b.kcal === null ? 30 : Math.max(4, (b.kcal / maxBar) * 124)
                return (
                  <div key={b.date} className="flex flex-col items-center gap-1 font-mono text-[10px] text-muted" title={b.kcal === null ? dayMonth(b.date) : `${dayMonth(b.date)} · ${formatKcal(b.kcal)} kcal`}>
                    <div
                      className="w-full rounded-t"
                      style={
                        b.status === 'none'
                          ? { height: h, borderRadius: 4, background: 'repeating-linear-gradient(45deg, #34413e 0 4px, transparent 4px 8px)' }
                          : { height: h, background: '#e5483d', opacity: b.status === 'in-progress' ? 0.45 : 1 }
                      }
                    />
                    {b.label}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 text-xs text-muted">
              <span>Protein avg {recap.avgProtein ?? '–'} g</span>
              <span>Fiber avg {recap.avgFiber ?? '–'} g</span>
              <span>{recap.daysLogged} days closed</span>
            </div>
          </Card>

          {recap.bodyweight.unlocked ? (
            <Card className="flex flex-col gap-1.5">
              <Eyebrow>Bodyweight trend</Eyebrow>
              <span className="font-display font-extrabold text-2xl uppercase">
                {recap.bodyweight.latest?.kg} kg · {recap.bodyweight.perWeekKg! >= 0 ? '+' : ''}
                {recap.bodyweight.perWeekKg} kg / week
              </span>
              <span className="text-[13px] text-[#c9d4d2] leading-[1.4]">
                Target +0.06 to +0.12 kg a week (0.25–0.5 kg a month). {recap.bodyweight.count} weigh-ins so far
                {recap.bodyweight.latest ? `, last on ${dayMonth(recap.bodyweight.latest.date)}` : ''}.
              </span>
            </Card>
          ) : (
            <div className="border border-dashed border-[#4a5654] rounded-[18px] p-4 flex flex-col gap-1.5">
              <Eyebrow>Bodyweight trend</Eyebrow>
              <span className="font-display font-extrabold text-2xl uppercase">Unlocks after 3 weigh-ins</span>
              <span className="text-[13px] text-[#c9d4d2] leading-[1.4]">
                Say "weighed 75.4 this morning" in Log. {recap.bodyweight.count} of 3 logged. Last known: 75 kg on 16 Oct. Target gain 0.25–0.5 kg a month.
              </span>
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex justify-center">
        <GhostButton onClick={() => void signOut()} className="text-muted">
          Sign out
        </GhostButton>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] text-muted uppercase">{label}</span>
      <span className="font-display font-extrabold text-[32px] leading-none">{value}</span>
    </div>
  )
}
