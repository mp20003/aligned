/**
 * History
 *
 * 30-day grid of daily alignment states. Each cell is a circle showing the
 * date number, coloured by balanced (all 3 wins), partial (1–2), or missed.
 * One insight sentence derived from the pattern.
 *
 * Never shows streaks, percentages, or counts. Missed days are data, not
 * failure.
 *
 * Props: none. Reads from AppContext days data.
 */

import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']

function dateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function getLast30Days(): Date[] {
  const days: Date[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  return days
}

type DayState = 'balanced' | 'partial' | 'missed'

function getDayState(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  date: Date
): DayState {
  const key = dateKey(date)
  const entry = days[key]
  if (!entry) return 'missed'
  const done = CATEGORIES.filter(k => entry[k] !== null).length
  if (done === 3) return 'balanced'
  if (done > 0) return 'partial'
  return 'missed'
}

function generateInsight(
  days30: Date[],
  dayData: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  labels: Record<CategoryKey, { label: string; definition: string }>
): string {
  const total = days30.length
  const counts: Record<CategoryKey, number> = { physical: 0, mental: 0, spiritual: 0 }
  let balanced = 0
  let missed = 0

  for (const d of days30) {
    const entry = dayData[dateKey(d)]
    if (!entry) { missed++; continue }
    const done = CATEGORIES.filter(k => entry[k] !== null).length
    if (done === 3) balanced++
    else if (done === 0) missed++
    CATEGORIES.forEach(k => { if (entry[k] !== null) counts[k]++ })
  }

  const weakest = CATEGORIES.reduce((a, b) => counts[a] <= counts[b] ? a : b)
  const weakestLabel = labels[weakest].label.toLowerCase()

  if (balanced === 0 && missed === total) return 'No wins logged yet. Today is a good day to start.'
  if (balanced === total) return 'You were fully aligned every day this month. Rare.'

  const weekends = days30.filter(d => d.getDay() === 0 || d.getDay() === 6)
  const weekendMisses = weekends.filter(d => {
    const e = dayData[dateKey(d)]
    return !e || e[weakest] === null
  }).length

  if (weekends.length > 0 && weekendMisses / weekends.length >= 0.6 && counts[weakest] < total * 0.5) {
    return `You tend to skip ${weakestLabel} on weekends — is that intentional?`
  }

  const weekdays = days30.filter(d => d.getDay() !== 0 && d.getDay() !== 6)
  const weekdayMisses = weekdays.filter(d => {
    const e = dayData[dateKey(d)]
    return !e || e[weakest] === null
  }).length

  if (weekdays.length > 0 && weekdayMisses / weekdays.length >= 0.6 && counts[weakest] < total * 0.5) {
    const label = weakestLabel.charAt(0).toUpperCase() + weakestLabel.slice(1)
    return `${label} tends to slip on weekdays — your busiest days.`
  }

  if (counts[weakest] < total * 0.4) {
    const label = weakestLabel.charAt(0).toUpperCase() + weakestLabel.slice(1)
    return `${label} is your least consistent category this month.`
  }

  if (missed > total * 0.5) return 'More missed days than not this month. What got in the way?'

  return `${balanced} fully aligned ${balanced === 1 ? 'day' : 'days'} in the last 30.`
}

export default function History() {
  const { data } = useApp()
  const days30 = getLast30Days()
  const todayStr = dateKey(new Date())

  const firstDayOfWeek = (days30[0].getDay() + 6) % 7
  const padded: (Date | null)[] = [...Array(firstDayOfWeek).fill(null), ...days30]
  while (padded.length % 7 !== 0) padded.push(null)

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  const insight = generateInsight(days30, data.days, data.onboarding.categories)

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-28 flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">History</p>
        <h1 className="font-serif text-2xl text-charcoal">Last 30 days</h1>
      </div>

      <div className="flex flex-col gap-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => (
            <div key={i} className="text-center font-sans text-xs text-charcoal/30">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const state = getDayState(data.days, day)
              const isToday = dateKey(day) === todayStr
              const dayNum = day.getDate()

              return (
                <div key={di} className="flex items-center justify-center">
                  <Cell state={state} dayNum={dayNum} isToday={isToday} />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-5">
        <LegendItem state="balanced" label="Balanced" />
        <LegendItem state="partial" label="Partial" />
        <LegendItem state="missed" label="Missed" />
      </div>

      {/* Insight */}
      <p className="font-serif text-base text-charcoal/60 leading-relaxed border-t border-charcoal/10 pt-6">
        {insight}
      </p>
    </div>
  )
}

function Cell({ state, dayNum, isToday }: { state: DayState; dayNum: number; isToday: boolean }) {
  const base = 'w-9 h-9 rounded-full flex items-center justify-center transition-all'

  if (state === 'balanced') {
    return (
      <div
        className={`${base} ${isToday ? 'ring-2 ring-offset-2 ring-offset-beige ring-charcoal/20' : ''}`}
        style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }}
      >
        <span className="font-sans text-xs font-medium text-white">{dayNum}</span>
      </div>
    )
  }

  if (state === 'partial') {
    return (
      <div className={`${base} bg-charcoal/15 ${isToday ? 'ring-2 ring-offset-2 ring-offset-beige ring-charcoal/20' : ''}`}>
        <span className="font-sans text-xs text-charcoal/50">{dayNum}</span>
      </div>
    )
  }

  return (
    <div className={`${base} bg-charcoal/8 ${isToday ? 'ring-2 ring-offset-2 ring-offset-beige ring-charcoal/20' : ''}`}>
      <span className="font-sans text-xs text-charcoal/25">{dayNum}</span>
    </div>
  )
}

function LegendItem({ state, label }: { state: DayState; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {state === 'balanced' ? (
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }} />
      ) : (
        <div className={`w-3 h-3 rounded-full shrink-0 ${state === 'partial' ? 'bg-charcoal/15' : 'bg-charcoal/8'}`} />
      )}
      <span className="font-sans text-xs text-charcoal/40">{label}</span>
    </div>
  )
}
