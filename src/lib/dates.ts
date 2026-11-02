/**
 * Date helpers for the screens. The app runs on Singapore time whatever the
 * device clock says, so "today" and the hour of day never drift when a phone
 * is set to another zone.
 */

export const APP_TIME_ZONE = 'Asia/Singapore'

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function clockParts(date: Date): Record<string, string> {
  return Object.fromEntries(PARTS.formatToParts(date).map(p => [p.type, p.value]))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function todayIso(now = new Date()): string {
  const p = clockParts(now)
  return `${p.year}-${p.month}-${p.day}`
}

/** "Sun 1 Nov" */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DOW[dt.getDay()]} ${d} ${MONTHS[m - 1]}`
}

/** "1 Nov" */
export function dayMonth(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

export function timeHm(date = new Date()): string {
  const p = clockParts(date)
  return `${p.hour}:${p.minute}`
}

/** Hour of day, 0–23, on the app clock. */
export function hourNow(date = new Date()): number {
  return Number(clockParts(date).hour)
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
