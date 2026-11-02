import { useEffect, useState } from 'react'
import { timeHm } from './dates.ts'

/** The app clock as "HH:MM". Checks every second; only re-renders when the minute changes. */
export function useClockHm(): string {
  const [hm, setHm] = useState(() => timeHm())
  useEffect(() => {
    const id = window.setInterval(() => setHm(timeHm()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return hm
}
