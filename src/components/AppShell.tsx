import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const TABS: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  {
    to: '/',
    label: 'Today',
    end: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    to: '/log',
    label: 'Log',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5h16v11H8l-4 4z" />
      </svg>
    ),
  },
  {
    to: '/train',
    label: 'Train',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />
      </svg>
    ),
  },
  {
    to: '/meals',
    label: 'Meals',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 3c-2 2-2 6 0 8v10" />
      </svg>
    ),
  },
  {
    to: '/recap',
    label: 'Recap',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
]

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ground text-ink flex flex-col max-w-md mx-auto">
      <div className="flex-1 flex flex-col pb-24">{children}</div>
      <nav aria-label="Main" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md grid grid-cols-5 border-t border-line bg-ground px-1.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        {TABS.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 min-h-11 text-[11px] font-sans ${isActive ? 'text-ink font-semibold' : 'text-muted'}`
            }
          >
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
