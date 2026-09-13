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

const UNIVERSE_CYCLE_DAYS = 90
const MS_PER_DAY = 86400000

// The Score screen's "Universe" panel runs on a fixed 90-day (~3 month) cycle
// anchored to the day the account was created — cycle N runs from
// accountCreated+(N*90) days up to (but not including) accountCreated+((N+1)*90)
// days. A fixed interval (rather than calendar months) so every cycle is the
// same length regardless of which month it falls in. 90 days (~13 weeks)
// keeps well clear of the Universe panel's real capacity (clusters start
// overlapping past ~25-30 weeks packed into its fixed canvas — see
// getClusterCenters in Score.tsx) while still giving each cycle enough time
// to feel like it's actually building up before it resets. Used to decide
// which weeks' clusters are currently visible and when to play the
// "universe resets" animation.
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
