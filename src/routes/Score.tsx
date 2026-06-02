/**
 * Pulse — Wave
 *
 * Your practice rendered as a pulse signal. Each day creates a peak on the
 * waveform — tall for full alignment, smaller for partial, flat for missed.
 * The current week's trace sits at the front, vivid and full-sized. Past
 * weeks recede behind it as quieter, smaller traces.
 *
 * Below the wave: the personal weekly letter from Pulse.
 *
 * Never shows streaks, scores, or percentages.
 *
 * Props: none. Reads from AppContext.
 */

import { useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const COLORS: Record<CategoryKey, string> = {
  physical:  '#1D9E75',
  mental:    '#7F77DD',
  spiritual: '#D85A30',
}

const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const SVG_W = 320
const SVG_H = 246

// All rows use the same peak height — differentiated by opacity/weight only.
// This means a 3-win day looks identical regardless of which week it's in.
// Baselines are evenly spaced with 46px between them.
const W_BASELINE   = [52,  98, 144, 190, 236]
const W_MAX_H      = [32,  32,  32,  32,  32]
const W_STROKE     = [0.7, 0.9, 1.1, 1.5, 2.0]
const W_OPACITY    = [0.10, 0.20, 0.35, 0.58, 1.0]
const W_FILL_ALPHA = [0.015, 0.03, 0.045, 0.07, 0.11]

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function isFuture(d: Date): boolean {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return d > today
}

function getLastNWeeks(n: number): Date[][] {
  const today = new Date()
  const dow = (today.getDay() + 6) % 7  // days since Monday

  const weeks: Date[][] = []
  for (let w = n - 1; w >= 0; w--) {
    weeks.push(
      Array.from({ length: 7 }, (_, d) => {
        const date = new Date(today)
        date.setDate(today.getDate() - dow - w * 7 + d)
        return date
      })
    )
  }
  return weeks
}

// ── Stats ─────────────────────────────────────────────────────────────────────

type WeekStats = {
  logged: Record<CategoryKey, number>
  reflections: Record<CategoryKey, string[]>
  aligned: number
  elapsed: number
}

function getWeekStats(
  days: Record<string, { physical: { text: string; reflection?: string } | null; mental: { text: string; reflection?: string } | null; spiritual: { text: string; reflection?: string } | null }>,
  weekDays: Date[]
): WeekStats {
  const stats: WeekStats = {
    logged: { physical: 0, mental: 0, spiritual: 0 },
    reflections: { physical: [], mental: [], spiritual: [] },
    aligned: 0,
    elapsed: 0,
  }
  for (const d of weekDays) {
    if (isFuture(d)) continue
    stats.elapsed++
    const entry = days[dateKey(d)]
    if (!entry) continue
    let allDone = true
    for (const k of CATEGORIES) {
      if (entry[k] !== null) {
        stats.logged[k]++
        const r = entry[k]?.reflection
        if (r) stats.reflections[k].push(r)
      } else {
        allDone = false
      }
    }
    if (allDone) stats.aligned++
  }
  return stats
}

// ── Letter generator ──────────────────────────────────────────────────────────

function generateLetter(
  stats: WeekStats,
  labels: Record<CategoryKey, { label: string; definition: string }>,
  weekDays: Date[],
  name: string
): string {
  const { logged, reflections, aligned, elapsed } = stats
  const remaining = 7 - elapsed
  const greeting = name ? `Dearest ${name},` : `Dearest you,`

  if (elapsed === 0) {
    return `${greeting}\n\nA new week. The same invitation — three parts of you, one day at a time.\n\nYou don't have to be perfect. You just have to begin.\n\nStill with you.\n\nPulse`
  }

  const strongest = CATEGORIES.reduce((a, b) => logged[a] >= logged[b] ? a : b)
  const weakest   = CATEGORIES.reduce((a, b) => logged[a] <= logged[b] ? a : b)
  const strongestLabel = labels[strongest].label.toLowerCase()
  const weakestLabel   = labels[weakest].label.toLowerCase()
  const allReflections = CATEGORIES.flatMap(k => reflections[k])
  const hardDays       = allReflections.filter(r => r === 'Hard').length
  const meaningfulDays = allReflections.filter(r => r === 'Meaningful').length

  const lines: string[] = [greeting, ``]

  // Opening — tone varies by alignment pattern
  if (aligned === elapsed && elapsed >= 4) {
    lines.push(`Every single day this week, you showed up for all three parts of yourself. That's rare. Most people never find that rhythm — you're living it.`)
  } else if (aligned >= Math.ceil(elapsed * 0.7) && elapsed >= 3) {
    lines.push(`You've been whole more often than not this week. That consistency is the whole point — not perfection, just presence, most days.`)
  } else if (elapsed >= 3 && aligned === 0) {
    lines.push(`This week has been fragmented — pieces here and there, nothing fully complete. That's real life. The week isn't over, and one whole day changes the feeling of all of them.`)
  } else if (elapsed <= 2) {
    lines.push(`You're early in the week. What you build from here is still entirely yours to shape.`)
  } else {
    lines.push(`Some days whole, some days not. That's the honest shape of a real week — and you kept logging it, which means you kept paying attention.`)
  }

  lines.push(``)

  // What's held strong
  if (logged[strongest] === elapsed && elapsed >= 2) {
    lines.push(`Your ${strongestLabel} practice hasn't wavered. Whatever else fell away this week, that held. That's something to trust in yourself.`)
  } else if (logged[strongest] >= 3) {
    lines.push(`Your ${strongestLabel} practice has been your anchor this week — showing up more consistently than anything else.`)
  }

  // What's been quiet — only if meaningfully different and worth naming
  if (logged[weakest] === 0 && elapsed >= 3) {
    lines.push(`Your ${weakestLabel} has gone quiet. Not a failure — but worth sitting with. Sometimes what we avoid is what we most need.`)
  } else if (logged[weakest] < logged[strongest] - 2 && elapsed >= 4) {
    lines.push(`Your ${weakestLabel} has been harder to reach this week. Notice that without judgment — just notice.`)
  }

  lines.push(``)

  // Reflection-based personal note
  if (hardDays >= 3) {
    lines.push(`You showed up on hard days. That's not something everyone does. The practice is easiest when life is easy — what you're building is something that holds when it isn't.`)
  } else if (hardDays >= 1 && meaningfulDays >= 1) {
    lines.push(`Hard days and meaningful ones — you've had both this week. That range is what a real practice looks like.`)
  } else if (meaningfulDays >= 3) {
    lines.push(`So many of your days this week felt meaningful. That's not an accident. That's what showing up for yourself actually does.`)
  } else if (meaningfulDays >= 1) {
    lines.push(`At least one day this week felt truly meaningful to you. Let that be the signal — not the exception.`)
  }

  // Looking ahead or closing
  if (remaining > 0 && remaining <= 3) {
    lines.push(`${remaining === 1 ? 'One day' : `${remaining} days`} left. The week closes however you choose to close it.`)
  } else if (remaining === 0) {
    lines.push(`The week is done. It belongs to you now — all of it.`)
  }

  lines.push(``)
  lines.push(`Still with you.`)
  lines.push(``)
  lines.push(`Pulse`)

  return lines.join('\n')
}

// ── Pulse wave SVG ────────────────────────────────────────────────────────────

type DayData = Record<string, {
  physical: { text: string } | null
  mental: { text: string } | null
  spiritual: { text: string } | null
}>

function winCount(entry: DayData[string] | undefined, future: boolean): number {
  if (future || !entry) return future ? -1 : 0
  return CATEGORIES.filter(k => entry[k] !== null).length
}

function peakHeight(wins: number, maxH: number): number {
  if (wins < 0)  return 0            // future — flat
  if (wins === 0) return 2            // missed — tiny ripple
  if (wins === 1) return maxH * 0.27
  if (wins === 2) return maxH * 0.60
  return maxH
}

function buildPath(
  week: Date[],
  baseline: number,
  maxH: number,
  dayData: DayData
): string {
  const dayW = SVG_W / 7
  const pw = dayW * 0.42  // half-width of each smooth hill

  const segs: string[] = [`M 0,${baseline}`]

  for (let i = 0; i < 7; i++) {
    const cx = dayW * (i + 0.5)
    const x0 = cx - pw
    const x1 = cx + pw
    const future = isFuture(week[i])
    const entry  = dayData[dateKey(week[i])]
    const wins   = winCount(entry, future)
    const h      = peakHeight(wins, maxH)
    const yPeak  = baseline - h

    segs.push(`L ${x0},${baseline}`)

    // Smooth sine-like hill: control points at 60% width, full height
    segs.push(`C ${x0 + pw * 0.6},${baseline} ${cx - pw * 0.2},${yPeak} ${cx},${yPeak}`)
    segs.push(`C ${cx + pw * 0.2},${yPeak} ${x1 - pw * 0.6},${baseline} ${x1},${baseline}`)
  }

  segs.push(`L ${SVG_W},${baseline}`)
  return segs.join(' ')
}

function PulseWaveSVG({ weeks, dayData }: { weeks: Date[][]; dayData: DayData }) {
  // useRef/useEffect kept for potential future use — animation is now SVG-native
  const _ref = useRef<SVGPathElement>(null)
  useEffect(() => {}, [])

  const SWEEP_DUR = '5s'

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#1D9E75" />
          <stop offset="48%"  stopColor="#7F77DD" />
          <stop offset="100%" stopColor="#D85A30" />
        </linearGradient>
        <linearGradient id="wave-grad-fill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#1D9E75" stopOpacity="0.15" />
          <stop offset="48%"  stopColor="#7F77DD" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#D85A30" stopOpacity="0.15" />
        </linearGradient>
        {/* Sweeping clip — grows from 0 to full width then resets, like a monitor */}
        <clipPath id="sweep-clip">
          <rect x="0" y="-300" height="600" width="0">
            <animate
              attributeName="width"
              from="0"
              to={String(SVG_W)}
              dur={SWEEP_DUR}
              repeatCount="indefinite"
              calcMode="linear"
            />
          </rect>
        </clipPath>
      </defs>

      {/* Past week traces */}
      {weeks.slice(0, -1).map((week, i) => {
        const baseline = W_BASELINE[i]
        const maxH     = W_MAX_H[i]
        const basePath = buildPath(week, baseline, maxH, dayData)
        const fillPath = `${basePath} L 0,${baseline} Z`
        return (
          <g key={i} style={{ opacity: W_OPACITY[i] }}>
            <path d={fillPath} fill="rgba(44,44,42,0.06)" stroke="none" />
            <path d={basePath} fill="none" stroke="rgba(44,44,42,1)"
              strokeWidth={W_STROKE[i]} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )
      })}

      {/* Current week — ghost trace + animated sweep */}
      {(() => {
        const i        = weeks.length - 1
        const baseline = W_BASELINE[i]
        const maxH     = W_MAX_H[i]
        const basePath = buildPath(weeks[i], baseline, maxH, dayData)
        const fillPath = `${basePath} L 0,${baseline} Z`
        return (
          <g key="current">
            {/* Ghost fill — always visible, dim */}
            <path d={fillPath} fill="url(#wave-grad-fill)" stroke="none" opacity="0.4" />
            {/* Ghost stroke — always visible, dim */}
            <path d={basePath} fill="none" stroke="url(#wave-grad)"
              strokeWidth={W_STROKE[i]} strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />

            {/* Bright swept portion — revealed by animated clip */}
            <g clipPath="url(#sweep-clip)">
              <path d={fillPath} fill="url(#wave-grad-fill)" stroke="none" />
              <path d={basePath} fill="none" stroke="url(#wave-grad)"
                strokeWidth={W_STROKE[i]} strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Scanning cursor line at leading edge */}
            <line y1="0" y2={SVG_H} stroke="url(#wave-grad)" strokeWidth="1.5" opacity="0.35">
              <animate attributeName="x1" from="0" to={String(SVG_W)} dur={SWEEP_DUR} repeatCount="indefinite" calcMode="linear" />
              <animate attributeName="x2" from="0" to={String(SVG_W)} dur={SWEEP_DUR} repeatCount="indefinite" calcMode="linear" />
            </line>
          </g>
        )
      })()}
    </svg>
  )
}

// ── Day indicator row ─────────────────────────────────────────────────────────

function DayLabels({ week }: { week: Date[] }) {
  const todayStr = dateKey(new Date())
  return (
    <div className="grid grid-cols-7 w-full">
      {week.map((day, i) => {
        const isToday = dateKey(day) === todayStr
        return (
          <div key={i} className="text-center">
            <span className={`font-sans text-xs ${isToday ? 'text-charcoal/60 font-medium' : 'text-charcoal/28'}`}>
              {DAY_LABELS[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Pulse() {
  const { data } = useApp()
  const weeks       = getLastNWeeks(5)
  const currentWeek = weeks[weeks.length - 1]
  const stats       = getWeekStats(data.days, currentWeek)
  const categories  = data.onboarding.categories
  const name        = data.onboarding.name ?? ''
  const letter      = generateLetter(stats, categories, currentWeek, name)

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-28 flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Pulse</p>
        <h1 className="font-serif text-2xl text-charcoal">Your pulse</h1>
      </div>

      {/* Wave */}
      <div className="flex flex-col gap-3">
        <PulseWaveSVG weeks={weeks} dayData={data.days} />
        <DayLabels week={currentWeek} />
      </div>

      {/* Weekly letter */}
      <div className="border-t border-charcoal/10 pt-6 flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/30 mb-3">
          This week
        </p>
        {letter.split('\n').map((line, i) =>
          line === '' ? (
            <div key={i} className="h-2" />
          ) : (
            <p
              key={i}
              className={`font-serif leading-relaxed ${
                line.startsWith('Dear')
                  ? 'text-charcoal text-lg'
                  : line === 'Pulse'
                  ? 'text-charcoal/50 text-base italic'
                  : line === 'Still with you.'
                  ? 'text-charcoal/40 text-sm'
                  : 'text-charcoal/70 text-sm'
              }`}
            >
              {line}
            </p>
          )
        )}
      </div>
    </div>
  )
}
