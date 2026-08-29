/**
 * Pulse
 *
 * Your practice rendered as a live ECG heartbeat — beating continuously,
 * shaped by your actual data. Strong beats = aligned days, weaker = partial,
 * near-flat = missed. Below: three vital stat readouts (one per category)
 * showing this week's count, plus a single sharp insight sentence.
 *
 * Never shows streaks, scores, or percentages.
 *
 * Props: none. Reads from AppContext.
 */

import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const ACCENT_TEXT: Record<CategoryKey, string> = {
  physical: 'text-physical',
  mental: 'text-mental',
  spiritual: 'text-spiritual',
}
const ACCENT_BG: Record<CategoryKey, string> = {
  physical: 'bg-physical',
  mental: 'bg-mental',
  spiritual: 'bg-spiritual',
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function isFuture(d: Date): boolean {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return d > today
}

function getCurrentWeek(): Date[] {
  const today = new Date()
  const dow = (today.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - dow + i)
    return d
  })
}

function getLast30Days(): Date[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 29 + i)
    return d
  })
}

// ── Stats ──────────────────────────────────────────────────────────────────────

function getWeekCounts(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  week: Date[]
): Record<CategoryKey, number> {
  const counts: Record<CategoryKey, number> = { physical: 0, mental: 0, spiritual: 0 }
  for (const d of week) {
    if (isFuture(d)) continue
    const entry = days[dateKey(d)]
    if (!entry) continue
    CATEGORIES.forEach(k => { if (entry[k] !== null) counts[k]++ })
  }
  return counts
}

// ── ECG heartbeat SVG ──────────────────────────────────────────────────────────

type DayData = Record<string, {
  physical: unknown; mental: unknown; spiritual: unknown
}>

function winCount(entry: DayData[string] | undefined, future: boolean): number {
  if (future || !entry) return future ? -1 : 0
  return CATEGORIES.filter(k => entry[k] !== null).length
}

function buildECGPath(days30: Date[], dayData: DayData, W: number, H: number): string {
  const segW = W / days30.length
  const baseline = H * 0.72
  const maxPeak = H * 0.58

  const points: [number, number][] = days30.map((d, i) => {
    const cx = segW * i + segW / 2
    const future = isFuture(d)
    const entry = dayData[dateKey(d)]
    const wins = winCount(entry, future)
    let y = baseline
    if (wins === 3) y = baseline - maxPeak
    else if (wins === 2) y = baseline - maxPeak * 0.55
    else if (wins === 1) y = baseline - maxPeak * 0.22
    else if (wins === 0) y = baseline - 4
    else y = baseline // future
    return [cx, y]
  })

  // Build smooth path through points using catmull-rom-like control points
  let path = `M 0,${baseline}`
  for (let i = 0; i < points.length; i++) {
    const [cx, cy] = points[i]
    const x0 = cx - segW * 0.35
    const x1 = cx + segW * 0.35
    const prevY = i > 0 ? points[i - 1][1] : baseline
    const nextY = i < points.length - 1 ? points[i + 1][1] : baseline

    path += ` L ${x0},${prevY}`
    path += ` C ${x0 + segW * 0.15},${prevY} ${cx - segW * 0.1},${cy} ${cx},${cy}`
    path += ` C ${cx + segW * 0.1},${cy} ${x1 - segW * 0.15},${nextY} ${x1},${nextY}`
  }
  path += ` L ${W},${baseline}`
  return path
}

function ECGMonitor({ days30, dayData }: { days30: Date[]; dayData: DayData }) {
  const W = 340
  const H = 160
  const baseline = H * 0.72
  const ecgPath = buildECGPath(days30, dayData, W, H)
  const fillPath = `${ecgPath} L ${W},${baseline} L 0,${baseline} Z`
  const animDur = '3s'

  return (
    <div className="relative rounded-2xl bg-charcoal/4 border border-charcoal/8 overflow-hidden px-2 py-4">
      {/* Subtle scan line */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="ecg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#1D9E75" />
            <stop offset="48%"  stopColor="#7F77DD" />
            <stop offset="100%" stopColor="#D85A30" />
          </linearGradient>
          <linearGradient id="ecg-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#7F77DD" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#7F77DD" stopOpacity="0" />
          </linearGradient>
          <clipPath id="ecg-sweep">
            <rect x="0" y="0" height={H} width="0">
              <animate attributeName="width" from="0" to={String(W)} dur={animDur} repeatCount="indefinite" calcMode="linear" />
            </rect>
          </clipPath>
          <filter id="ecg-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Baseline grid line */}
        <line x1="0" y1={baseline} x2={W} y2={baseline} stroke="rgba(44,44,42,0.08)" strokeWidth="1" />

        {/* Ghost fill + stroke always visible */}
        <path d={fillPath} fill="url(#ecg-fill)" stroke="none" opacity="0.4" />
        <path d={ecgPath} fill="none" stroke="url(#ecg-grad)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />

        {/* Swept bright portion */}
        <g clipPath="url(#ecg-sweep)">
          <path d={fillPath} fill="url(#ecg-fill)" stroke="none" />
          <path d={ecgPath} fill="none" stroke="url(#ecg-grad)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" filter="url(#ecg-glow)" />
        </g>

        {/* Scanning cursor */}
        <line y1="0" y2={H} stroke="url(#ecg-grad)" strokeWidth="1" opacity="0.5">
          <animate attributeName="x1" from="0" to={String(W)} dur={animDur} repeatCount="indefinite" calcMode="linear" />
          <animate attributeName="x2" from="0" to={String(W)} dur={animDur} repeatCount="indefinite" calcMode="linear" />
        </line>
      </svg>

      {/* Label */}
      <p className="font-sans text-xs text-charcoal/25 uppercase tracking-widest text-right pr-2 mt-1">30 days</p>
    </div>
  )
}

// ── Week dot row ───────────────────────────────────────────────────────────────

function WeekDots({
  week,
  days,
  category,
  elapsed,
}: {
  week: Date[]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>
  category: CategoryKey
  elapsed: number
}) {
  const todayStr = dateKey(new Date())

  return (
    <div className="flex gap-1.5 lg:gap-2">
      {week.map((d, i) => {
        const key = dateKey(d)
        const future = isFuture(d)
        const entry = days[key]
        const logged = !future && entry && entry[category] !== null
        const isToday = key === todayStr
        const isPast = i < elapsed && !isToday

        return (
          <div
            key={i}
            className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              future
                ? 'bg-charcoal/5'
                : logged
                ? `${ACCENT_BG[category]} opacity-90`
                : isPast || isToday
                ? 'bg-charcoal/10'
                : 'bg-charcoal/5'
            }`}
          >
            {isToday && (
              <div className={`w-1.5 h-1.5 rounded-full ${logged ? 'bg-white/60' : 'bg-charcoal/30'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Insight sentence ───────────────────────────────────────────────────────────

function generateInsight(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  labels: Record<CategoryKey, { label: string; definition: string }>,
  week: Date[],
  counts: Record<CategoryKey, number>,
  elapsed: number,
): string {
  if (elapsed === 0) return 'A new week. Three categories, seven days, one question: what will you tend to?'

  const strongest = CATEGORIES.reduce((a, b) => counts[a] >= counts[b] ? a : b)
  const weakest = CATEGORIES.reduce((a, b) => counts[a] <= counts[b] ? a : b)
  const aligned = week.filter(d => {
    if (isFuture(d)) return false
    const e = days[dateKey(d)]
    return e && CATEGORIES.every(k => e[k] !== null)
  }).length

  if (aligned === elapsed && elapsed >= 3) return `${elapsed} days, ${elapsed} fully aligned. You're in it.`
  if (counts[weakest] === 0 && elapsed >= 3) return `Your ${labels[weakest].label.toLowerCase()} practice has gone quiet this week. Worth noticing.`
  if (counts[strongest] === elapsed && elapsed >= 2) return `Your ${labels[strongest].label.toLowerCase()} practice hasn't missed a day. Let that anchor the rest.`
  if (aligned === 0 && elapsed >= 4) return `No fully aligned days yet. One whole day changes the feeling of the whole week.`
  if (elapsed <= 2) return 'Early in the week. What you build from here is still entirely yours to shape.'
  return `Your ${labels[strongest].label.toLowerCase()} is your strongest thread this week. Keep pulling it.`
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function Pulse() {
  const { data } = useApp()
  const week = getCurrentWeek()
  const days30 = getLast30Days()
  const counts = getWeekCounts(data.days, week)
  const categories = data.onboarding.categories
  const todayStr = dateKey(new Date())
  const elapsed = week.filter(d => !isFuture(d)).length
  const insight = generateInsight(data.days, categories, week, counts, elapsed)

  return (
    <div className="min-h-screen bg-beige max-w-md lg:max-w-3xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-8 lg:gap-10">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-charcoal/40">Triova</p>
        <h1 className="font-serif text-2xl lg:text-4xl text-charcoal">Your pulse</h1>
      </div>

      {/* ECG monitor */}
      <ECGMonitor days30={days30} dayData={data.days} />

      {/* Insight */}
      <p className="font-serif text-base lg:text-xl text-charcoal/70 leading-relaxed">{insight}</p>

      {/* Vital stats — one row per category */}
      <div className="flex flex-col gap-5 lg:gap-6">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-charcoal/30">This week</p>

        {CATEGORIES.map(k => {
          const count = counts[k]
          const label = categories[k].label

          return (
            <div key={k} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest font-medium ${ACCENT_TEXT[k]}`}>
                  {label}
                </span>
                <span className="font-sans text-xs lg:text-sm text-charcoal/35">
                  {count} of {elapsed} day{elapsed !== 1 ? 's' : ''}
                </span>
              </div>
              <WeekDots week={week} days={data.days} category={k} elapsed={elapsed} />
              <div className="flex gap-1">
                {DAY_LABELS.map((d, i) => (
                  <div key={i} className="w-7 lg:w-8 text-center">
                    <span className={`font-sans text-xs ${
                      dateKey(week[i]) === todayStr ? 'text-charcoal/50 font-medium' : 'text-charcoal/20'
                    }`}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
