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
