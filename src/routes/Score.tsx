/**
 * Pulse
 *
 * Weekly alignment view. Three concentric rings fill based on how many days
 * each category was logged this week (Mon–Sun). Below the rings, a 7-day dot
 * row shows per-day completion per category. A personal weekly letter is
 * generated from the data — warm, observational, never judgmental.
 *
 * Ring fill = days logged ÷ 7. Consistency only — quality is acknowledged
 * in the letter via reflection words, not in the ring fill.
 *
 * Never shows streaks. Never uses the word "score".
 *
 * Props: none. Reads from AppContext.
 */

import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const COLORS: Record<CategoryKey, string> = {
  physical:  '#1D9E75',
  mental:    '#7F77DD',
  spiritual: '#D85A30',
}

const ACCENT_TEXT: Record<CategoryKey, string> = {
  physical:  'text-physical',
  mental:    'text-mental',
  spiritual: 'text-spiritual',
}

const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function getWeekDays(): Date[] {
  const today = new Date()
  const dow = (today.getDay() + 6) % 7 // 0=Mon
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isFuture(d: Date): boolean {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return d > today
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
  const total = 7

  const greeting = name ? `Dear ${name},` : `Dear you,`

  if (elapsed === 0) {
    return `${greeting}\n\nThe week is just beginning. Three categories, seven days. Show up for one today and see how it feels.\n\nThe practice starts now.\n\nWith you,\nPulse`
  }

  const strongest = CATEGORIES.reduce((a, b) => logged[a] >= logged[b] ? a : b)
  const weakest = CATEGORIES.reduce((a, b) => logged[a] <= logged[b] ? a : b)
  const strongestLabel = labels[strongest].label.toLowerCase()
  const weakestLabel = labels[weakest].label.toLowerCase()

  const allReflections = CATEGORIES.flatMap(k => reflections[k])
  const hardDays = allReflections.filter(r => r === 'Hard').length
  const meaningfulDays = allReflections.filter(r => r === 'Meaningful').length

  const weekStart = weekDays[0].toLocaleDateString('default', { month: 'long', day: 'numeric' })
  const weekEnd = weekDays[6].toLocaleDateString('default', { month: 'long', day: 'numeric' })

  let body = ''

  // Opening
  const lines: string[] = [greeting, ``]

  // Week context
  lines.push(`Week of ${weekStart} – ${weekEnd}.`)
  lines.push(``)

  // Alignment summary
  if (aligned === elapsed && elapsed >= 3) {
    lines.push(`You've been fully aligned every day so far this week — all three categories, every day. That's the practice working.`)
  } else if (aligned >= Math.ceil(elapsed * 0.7)) {
    lines.push(`Most of your days this week have been fully aligned. ${aligned} out of ${elapsed} days with all three categories touched.`)
  } else if (elapsed >= 3 && aligned === 0) {
    lines.push(`No fully aligned days yet this week. That's just where you are — the week isn't over.`)
  } else {
    lines.push(`${aligned} fully aligned ${aligned === 1 ? 'day' : 'days'} so far this week. ${elapsed - aligned} days where something was left out.`)
  }

  lines.push(``)

  // Strongest category
  if (logged[strongest] > 0) {
    if (logged[strongest] === elapsed) {
      lines.push(`Your ${strongestLabel} practice has been consistent every day you could have logged. Hold that.`)
    } else {
      lines.push(`${labels[strongest].label} has been your most consistent practice — ${logged[strongest]} out of ${elapsed} days.`)
    }
  }

  // Weakest category (only if meaningfully different)
  if (logged[weakest] < logged[strongest] && elapsed >= 2) {
    if (logged[weakest] === 0) {
      lines.push(`Your ${weakestLabel} practice hasn't shown up yet this week. Worth asking why.`)
    } else {
      lines.push(`${labels[weakest].label} has been quieter — ${logged[weakest]} of ${elapsed} days. Not a failure, just a pattern worth noticing.`)
    }
  }

  lines.push(``)

  // Reflection acknowledgement
  if (hardDays >= 2) {
    lines.push(`You've logged some hard days. That's not the practice failing — that's the practice being real.`)
  } else if (meaningfulDays >= 2) {
    lines.push(`Several days felt meaningful this week. That's what you're building this for.`)
  }

  // Days remaining
  const remaining = total - elapsed
  if (remaining > 0 && remaining < 5) {
    const projected = CATEGORIES.map(k => {
      const couldFinish = logged[k] + remaining
      return couldFinish >= 6 ? labels[k].label : null
    }).filter(Boolean)

    if (projected.length === 3) {
      lines.push(`${remaining} days left. A strong finish is still within reach.`)
    } else if (remaining === 1) {
      lines.push(`One day left. Make it count.`)
    }
  }

  if (remaining === 0) {
    lines.push(`The week is complete. Whatever it looked like — it's yours.`)
  }

  lines.push(``)
  lines.push(`Same time next week.`)
  lines.push(``)
  lines.push(`With you,`)
  lines.push(`Pulse`)

  body = lines.join('\n')
  return body
}

// ── Ring SVG ──────────────────────────────────────────────────────────────────

const RING_RADII: Record<CategoryKey, number> = {
  physical:  80,
  mental:    57,
  spiritual: 34,
}
const STROKE_WIDTH = 11
const CX = 100
const CY = 100

const RING_BREATHE: Record<CategoryKey, { duration: string; delay: string }> = {
  physical:  { duration: '3s',   delay: '0s'    },
  mental:    { duration: '3.8s', delay: '0.5s'  },
  spiritual: { duration: '4.6s', delay: '1.1s'  },
}

function RingSVG({ stats }: { stats: WeekStats }) {
  return (
    <svg viewBox="0 0 200 200" className="w-56 h-56">
      {CATEGORIES.map(key => {
        const r = RING_RADII[key]
        const circumference = 2 * Math.PI * r
        const fill = stats.logged[key] / 7
        const offset = circumference * (1 - fill)
        const color = COLORS[key]
        const { duration, delay } = RING_BREATHE[key]

        return (
          <g key={key}>
            {/* Background track — static, always visible */}
            <circle
              cx={CX} cy={CY} r={r}
              fill="none"
              stroke={color}
              strokeWidth={STROKE_WIDTH}
              opacity={0.18}
            />
            {/* Filled arc — breathing */}
            <circle
              cx={CX} cy={CY} r={r}
              fill="none"
              stroke={color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={circumference}
              strokeDashoffset={fill === 0 ? circumference : offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{
                transition: 'stroke-dashoffset 1.2s ease-out',
                animation: `ring-breathe ${duration} ease-in-out infinite`,
                animationDelay: delay,
                transformBox: 'fill-box',
                transformOrigin: 'center',
              }}
            />
          </g>
        )
      })}
    </svg>
  )
}

// ── Week dots ─────────────────────────────────────────────────────────────────

function WeekDots({
  weekDays,
  days,
  labels,
}: {
  weekDays: Date[]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>
  labels: Record<CategoryKey, { label: string }>
}) {
  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const todayStr = dateKey(new Date())

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Day header — spacer matches category label width */}
      <div className="flex items-center gap-2">
        <div className="w-16 shrink-0" />
        <div className="grid grid-cols-7 gap-1 flex-1">
          {dayLetters.map((l, i) => (
            <div
              key={i}
              className={`text-center font-sans text-xs ${
                dateKey(weekDays[i]) === todayStr ? 'text-charcoal/60 font-medium' : 'text-charcoal/25'
              }`}
            >
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Category rows */}
      {CATEGORIES.map(key => (
        <div key={key} className="flex items-center gap-2">
          <span className={`font-sans text-xs uppercase tracking-widest w-16 shrink-0 ${ACCENT_TEXT[key]}`}>
            {labels[key].label}
          </span>
          <div className="grid grid-cols-7 gap-1 flex-1">
            {weekDays.map((d, i) => {
              const future = isFuture(d)
              const entry = days[dateKey(d)]
              const logged = !future && entry && entry[key] !== null
              return (
                <div key={i} className="flex justify-center">
                  <div
                    className={`w-4 h-4 rounded-full transition-colors ${
                      future
                        ? 'bg-charcoal/5'
                        : logged
                        ? ''
                        : 'bg-charcoal/10'
                    }`}
                    style={logged ? { backgroundColor: COLORS[key], opacity: 0.7 } : undefined}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Pulse() {
  const { data } = useApp()
  const weekDays = getWeekDays()
  const stats = getWeekStats(data.days, weekDays)
  const categories = data.onboarding.categories
  const name = data.onboarding.name ?? ''
  const letter = generateLetter(stats, categories, weekDays, name)

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-28 flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">Pulse</p>
        <h1 className="font-serif text-2xl text-charcoal">This week</h1>
      </div>

      {/* Rings */}
      <div className="flex flex-col items-center gap-6">
        <RingSVG stats={stats} />

        {/* Ring legend */}
        <div className="flex gap-6">
          {CATEGORIES.map(key => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className={`font-sans text-xs uppercase tracking-widest ${ACCENT_TEXT[key]}`}>
                {categories[key].label}
              </span>
              <span className="font-serif text-lg text-charcoal">
                {stats.logged[key]}<span className="text-charcoal/30 text-sm">/7</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Week dots */}
      <WeekDots weekDays={weekDays} days={data.days} labels={categories} />

      {/* Weekly letter */}
      <div className="border-t border-charcoal/10 pt-6 flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40 mb-3">Weekly letter</p>
        {letter.split('\n').map((line, i) => (
          line === ''
            ? <div key={i} className="h-2" />
            : <p key={i} className={`font-serif leading-relaxed ${
                line.startsWith('Dear')
                  ? 'text-charcoal text-lg'
                  : line === 'Pulse'
                  ? 'text-charcoal/50 text-base italic'
                  : line === 'With you,'
                  ? 'text-charcoal/40 text-sm'
                  : 'text-charcoal/70 text-sm'
              }`}>
                {line}
              </p>
        ))}
      </div>
    </div>
  )
}
