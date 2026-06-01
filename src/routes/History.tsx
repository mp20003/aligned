/**
 * History
 *
 * Renders a 30-day grid of daily alignment states. Each cell is a circle
 * coloured by whether the day was balanced (all 3 wins), partial (1–2 wins),
 * or missed (0 wins). One insight sentence is derived from the pattern.
 *
 * Never shows streaks, percentages, or counts. Missed days are data, not
 * failure. The insight is observational, never judgmental.
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

type DayState = 'balanced' | 'partial' | 'missed' | 'future'

function getDayState(days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>, date: Date): DayState {
  const key = dateKey(date)
  const entry = days[key]
  if (!entry) return 'missed'
  const done = CATEGORIES.filter(k => entry[k] !== null).length
  if (done === 3) return 'balanced'
  if (done > 0) return 'partial'
  return 'missed'
}

const CELL_STYLE: Record<DayState, string> = {
  balanced: 'bg-charcoal',
  partial: 'bg-charcoal/30',
  missed: 'bg-charcoal/10',
  future: 'bg-transparent',
}

function generateInsight(
  days30: Date[],
  dayData: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  labels: Record<CategoryKey, { label: string; definition: string }>
): string {
  const totalDays = days30.length
  const categoryCounts: Record<CategoryKey, number> = { physical: 0, mental: 0, spiritual: 0 }
  let balancedCount = 0
  let missedCount = 0

  for (const d of days30) {
    const key = dateKey(d)
    const entry = dayData[key]
    if (!entry) { missedCount++; continue }
    const done = CATEGORIES.filter(k => entry[k] !== null).length
    if (done === 3) balancedCount++
    else if (done === 0) missedCount++
    CATEGORIES.forEach(k => { if (entry[k] !== null) categoryCounts[k]++ })
  }

  // Find weakest category
  const weakest = CATEGORIES.reduce((a, b) => categoryCounts[a] <= categoryCounts[b] ? a : b)
  const weakestCount = categoryCounts[weakest]
  const weakestLabel = labels[weakest].label.toLowerCase()

  if (balancedCount === 0 && missedCount === totalDays) {
    return 'No wins logged yet. Today is a good day to start.'
  }
  if (balancedCount === totalDays) {
    return 'You were fully aligned every day this month. Rare.'
  }

  // Check if weakest category is skipped on weekends
  const weekendMisses = days30.filter(d => {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    if (!isWeekend) return false
    const entry = dayData[dateKey(d)]
    return !entry || entry[weakest] === null
  }).length
  const weekends = days30.filter(d => d.getDay() === 0 || d.getDay() === 6).length

  if (weekends > 0 && weekendMisses / weekends >= 0.6 && weakestCount < totalDays * 0.5) {
    return `You tend to skip ${weakestLabel} on weekends — is that intentional?`
  }

  // Check if weakest category is skipped on weekdays
  const weekdayMisses = days30.filter(d => {
    const isWeekday = d.getDay() !== 0 && d.getDay() !== 6
    if (!isWeekday) return false
    const entry = dayData[dateKey(d)]
    return !entry || entry[weakest] === null
  }).length
  const weekdays = days30.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length

  if (weekdays > 0 && weekdayMisses / weekdays >= 0.6 && weakestCount < totalDays * 0.5) {
    return `${weakestLabel.charAt(0).toUpperCase() + weakestLabel.slice(1)} tends to slip on weekdays — your busiest days.`
  }

  if (weakestCount < totalDays * 0.4) {
    return `${weakestLabel.charAt(0).toUpperCase() + weakestLabel.slice(1)} is your least consistent category this month.`
  }

  if (missedCount > totalDays * 0.5) {
    return 'More missed days than not this month. What got in the way?'
  }

  return `${balancedCount} fully aligned ${balancedCount === 1 ? 'day' : 'days'} in the last 30.`
}

export default function History() {
  const { data } = useApp()
  const days30 = getLast30Days()

  // Pad to start on Monday
  const firstDay = days30[0]
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7 // 0=Mon
  const paddedDays: (Date | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...days30,
  ]
  // Pad end to complete last row
  while (paddedDays.length % 7 !== 0) paddedDays.push(null)

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7))
  }

  const insight = generateInsight(days30, data.days, data.onboarding.categories)
  const todayKey = dateKey(new Date())

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-16 flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">History</p>
        <h1 className="font-serif text-2xl text-charcoal">Last 30 days</h1>
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((d, i) => (
            <div key={i} className="text-center font-sans text-xs text-charcoal/30">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-2">
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const state = getDayState(data.days, day)
              const isToday = dateKey(day) === todayKey
              return (
                <div key={di} className="flex items-center justify-center">
                  <div
                    className={`w-7 h-7 rounded-full transition-colors ${CELL_STYLE[state]} ${
                      isToday ? 'ring-2 ring-charcoal/30 ring-offset-2 ring-offset-beige' : ''
                    }`}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-5">
        {(['balanced', 'partial', 'missed'] as DayState[]).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${CELL_STYLE[s]}`} />
            <span className="font-sans text-xs text-charcoal/40 capitalize">{s}</span>
          </div>
        ))}
      </div>

      {/* Insight */}
      <p className="font-serif text-base text-charcoal/60 leading-relaxed border-t border-charcoal/10 pt-6">
        {insight}
      </p>
    </div>
  )
}
