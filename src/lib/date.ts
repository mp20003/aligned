// Local-calendar-day key, e.g. "2026-08-30". Deliberately NOT toISOString()
// (which is UTC) — that shifts "today" by a day for anyone west/east of UTC
// near midnight or when a date is normalized via setHours(0,0,0,0), which is
// local-midnight, not UTC-midnight. Every place that buckets a Date into a
// day (win storage, week math, "is this today") must use this so the keys
// always agree with each other.
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Monday of the week containing d, at local midnight. Shared so every place
// that identifies a "week" (Score's constellation clusters, Today's weekly
// check-in) agrees on the same boundary.
export function mondayOf(d: Date): Date {
  const day = new Date(d)
  const dow = (day.getDay() + 6) % 7
  day.setDate(day.getDate() - dow)
  day.setHours(0, 0, 0, 0)
  return day
}

export const UNIVERSE_CYCLE_DAYS = 30
const MS_PER_DAY = 86400000

// The Triova screen's real-sky cycle runs a fixed 30-day interval anchored
// to the day the account was created — cycle N runs from
// accountCreated+(N*30) days up to (but not including) accountCreated+((N+1)*30)
// days. A fixed interval (rather than calendar months) so every cycle is the
// same length regardless of which month it falls in — a true "builds over a
// month" cadence. Each completed cycle becomes one archived sky, so there's
// no scaling pressure from cycle length the way there was when this drove
// an ever-denser single canvas (see Score.tsx's archive gallery).
export function getUniverseCycle(accountCreated: Date, now: Date): { index: number; start: Date; end: Date } {
  const anchor = new Date(accountCreated)
  anchor.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const daysSince = Math.floor((today.getTime() - anchor.getTime()) / MS_PER_DAY)
  const index = Math.max(0, Math.floor(daysSince / UNIVERSE_CYCLE_DAYS))
  const start = new Date(anchor.getTime() + index * UNIVERSE_CYCLE_DAYS * MS_PER_DAY)
  const end = new Date(anchor.getTime() + (index + 1) * UNIVERSE_CYCLE_DAYS * MS_PER_DAY)
  return { index, start, end }
}
