/** Small shared pieces: header, cards, bars, chips, accuracy dots. */
import type { ReactNode } from 'react'
import type { Accuracy } from '../lib/logCards.ts'
import type { Verdict } from '../lib/progression.ts'

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{children}</p>
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="font-display font-extrabold text-[40px] leading-none uppercase">{children}</h1>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display font-bold text-xl uppercase">{children}</h2>
}

export function Card({ children, className = '', tone = 'surface' }: { children: ReactNode; className?: string; tone?: 'surface' | 'outline' | 'green' | 'blue' | 'yellow' }) {
  const tones = {
    surface: 'bg-surface',
    outline: 'bg-surface border border-line-2',
    green: 'bg-plate-green text-ground',
    blue: 'bg-plate-blue text-white',
    yellow: 'bg-plate-yellow text-[#1a1a12]',
  }
  return <section className={`rounded-[18px] p-4 ${tones[tone]} ${className}`}>{children}</section>
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="h-2 rounded-full bg-line overflow-hidden">
      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function VerdictChip({ verdict, size = 'sm' }: { verdict: Verdict | 'new'; size?: 'sm' | 'lg' }) {
  const map: Record<Verdict | 'new', { label: string; cls: string }> = {
    push: { label: 'PUSH', cls: 'bg-plate-green text-ground' },
    stay: { label: 'STAY', cls: 'bg-plate-blue text-white' },
    progress_bw: { label: 'BW UP', cls: 'bg-plate-blue text-white' },
    new: { label: 'NEW', cls: 'bg-plate-yellow text-[#1a1a12]' },
  }
  const m = map[verdict]
  const sz = size === 'lg' ? 'px-3 py-1 text-xl' : 'px-2 py-0.5 text-[13px]'
  return <span className={`rounded-md font-display font-extrabold ${sz} ${m.cls}`}>{m.label}</span>
}

const ACC_COLOR: Record<Accuracy, string> = { label: '#6fd69a', weighed: '#f2be1a', estimated: '#f29a3d' }

export function AccuracyDot({ accuracy }: { accuracy: Accuracy | null }) {
  return (
    <span aria-hidden="true" style={{ color: ACC_COLOR[accuracy ?? 'estimated'] }}>
      ●
    </span>
  )
}

export function AccuracyLegend() {
  return (
    <p className="text-[11px] text-muted">
      <span style={{ color: ACC_COLOR.label }}>●</span> from a label · <span style={{ color: ACC_COLOR.weighed }}>●</span> weighed, values estimated ·{' '}
      <span style={{ color: ACC_COLOR.estimated }}>●</span> estimated
    </p>
  )
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`min-h-11 rounded-full bg-ink text-ground font-sans font-semibold text-sm px-5 disabled:opacity-50 ${className}`}>
      {children}
    </button>
  )
}

export function GhostButton({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`min-h-11 rounded-full border border-[#4a5654] text-ink font-sans font-semibold text-sm px-4 disabled:opacity-50 ${className}`}>
      {children}
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="font-sans text-muted">{children}</p>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-plate-red/40 bg-surface p-3 font-sans text-sm text-plate-red">{children}</p>
}
