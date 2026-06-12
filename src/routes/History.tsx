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

import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function generateInsight(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  labels: Record<CategoryKey, { label: string; definition: string }>,
  days30: Date[]
): string | null {
  if (days30.filter(d => days[dateKey(d)]).length < 5) return null

  const catCounts: Record<CategoryKey, number> = { physical: 0, mental: 0, spiritual: 0 }
  const dowMisses: number[] = Array(7).fill(0)
  const dowTotal: number[] = Array(7).fill(0)
  let alignedCount = 0

  for (const d of days30) {
    const k = dateKey(d)
    const entry = days[k]
    const dow = d.getDay()
    dowTotal[dow]++
    if (!entry) { dowMisses[dow]++; continue }
    const done = CATEGORIES.filter(cat => entry[cat] !== null).length
    if (done === 3) alignedCount++
    CATEGORIES.forEach(cat => { if (entry[cat] !== null) catCounts[cat]++ })
    if (done === 0) dowMisses[dow]++
  }

  const total = days30.length
  const weakest = CATEGORIES.reduce((a, b) => catCounts[a] <= catCounts[b] ? a : b)
  const strongest = CATEGORIES.reduce((a, b) => catCounts[a] >= catCounts[b] ? a : b)

  // Find the day of week with worst miss rate (min 3 occurrences)
  let worstDow = -1, worstRate = 0
  for (let i = 0; i < 7; i++) {
    if (dowTotal[i] >= 3) {
      const rate = dowMisses[i] / dowTotal[i]
      if (rate > worstRate) { worstRate = rate; worstDow = i }
    }
  }

  const alignedPct = Math.round((alignedCount / total) * 100)
  const weakestPct = Math.round((catCounts[weakest] / total) * 100)
  const strongestPct = Math.round((catCounts[strongest] / total) * 100)

  if (weakestPct === 0 && total >= 7)
    return `Your ${labels[weakest].label.toLowerCase()} practice hasn't appeared in 30 days. That's worth noticing.`
  if (worstDow >= 0 && worstRate >= 0.5 && worstRate < 1)
    return `${DAY_NAMES[worstDow]}s are your hardest day — you miss more than half of them.`
  if (strongestPct >= 80 && weakestPct <= 40 && weakest !== strongest)
    return `Your ${labels[strongest].label.toLowerCase()} practice is strong. Your ${labels[weakest].label.toLowerCase()} needs more of the same attention.`
  if (alignedPct >= 70)
    return `${alignedPct}% of your days in the last month were fully aligned. That's a real practice.`
  if (alignedPct <= 20 && total >= 14)
    return `Full alignment is rare right now. Even partial wins count — but the three-part day is where the shift happens.`
  if (catCounts[strongest] === catCounts[weakest])
    return `Your three practices are moving in balance. Keep going.`
  return `Your ${labels[strongest].label.toLowerCase()} is your most consistent practice right now.`
}

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

type DayState = 'balanced' | 'partial-2' | 'partial-1' | 'missed'

function getDayState(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  date: Date
): DayState {
  const key = dateKey(date)
  const entry = days[key]
  if (!entry) return 'missed'
  const done = CATEGORIES.filter(k => entry[k] !== null).length
  if (done === 3) return 'balanced'
  if (done === 2) return 'partial-2'
  if (done === 1) return 'partial-1'
  return 'missed'
}

function generateShareCard(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  days30: Date[],
  name: string
): string {
  const CELL = 36, GAP = 6, PAD = 32
  const cols = 7
  const firstDow = (days30[0].getDay() + 6) % 7
  const padded: (Date | null)[] = [...Array(firstDow).fill(null), ...days30]
  while (padded.length % 7 !== 0) padded.push(null)
  const rows = padded.length / 7
  const W = cols * (CELL + GAP) - GAP + PAD * 2
  const H = rows * (CELL + GAP) - GAP + PAD * 2 + 80

  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // Background
  ctx.fillStyle = '#F5F0E8'
  ctx.fillRect(0, 0, W, H)

  // Header
  ctx.fillStyle = 'rgba(44,44,42,0.35)'
  ctx.font = '500 11px Inter, system-ui, sans-serif'
  ctx.fillText('TRIOVA', PAD, PAD - 4)
  ctx.fillStyle = '#2C2C2A'
  ctx.font = '600 18px Lora, Georgia, serif'
  ctx.fillText(name ? `${name}'s last 30 days` : 'Last 30 days', PAD, PAD + 16)

  // Grid
  padded.forEach((day, i) => {
    if (!day) return
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = PAD + col * (CELL + GAP)
    const y = PAD + 44 + row * (CELL + GAP)
    const cx = x + CELL / 2, cy = y + CELL / 2, r = CELL / 2

    const k = dateKey(day)
    const entry = days[k]
    const done = entry ? CATEGORIES.filter(cat => entry[cat] !== null).length : 0

    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)

    if (done === 3) {
      const grad = ctx.createConicGradient(0, cx, cy)
      grad.addColorStop(0,       '#1D9E75')
      grad.addColorStop(1/3,     '#7F77DD')
      grad.addColorStop(2/3,     '#D85A30')
      grad.addColorStop(1,       '#1D9E75')
      ctx.fillStyle = grad
    } else if (done === 2) {
      ctx.fillStyle = 'rgba(44,44,42,0.20)'
    } else if (done === 1) {
      ctx.fillStyle = 'rgba(44,44,42,0.10)'
    } else {
      ctx.fillStyle = 'rgba(44,44,42,0.05)'
    }
    ctx.fill()
  })

  // Footer
  ctx.fillStyle = 'rgba(44,44,42,0.25)'
  ctx.font = '400 10px Inter, system-ui, sans-serif'
  ctx.fillText('triova.app', PAD, H - 12)

  return canvas.toDataURL('image/png')
}

export default function History() {
  const { data } = useApp()
  const days30 = getLast30Days()
  const todayStr = dateKey(new Date())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const shareRef = useRef<HTMLAnchorElement>(null)

  function handleShare() {
    const dataUrl = generateShareCard(data.days, days30, data.onboarding.name)
    const a = shareRef.current!
    a.href = dataUrl
    a.download = `triova-${dateKey(new Date())}.png`
    a.click()
  }

  const firstDayOfWeek = (days30[0].getDay() + 6) % 7
  const padded: (Date | null)[] = [...Array(firstDayOfWeek).fill(null), ...days30]
  while (padded.length % 7 !== 0) padded.push(null)

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  const selectedEntry = selectedKey ? data.days[selectedKey] ?? null : null

  return (
    <div className="min-h-screen bg-beige max-w-md mx-auto px-6 pt-12 pb-28 flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">History</p>
          <h1 className="font-serif text-2xl text-charcoal">Last 30 days</h1>
        </div>
        <button
          onClick={handleShare}
          className="mt-2 text-charcoal/25 hover:text-charcoal/50 transition-colors"
          aria-label="Share"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
        <a ref={shareRef} className="hidden" />
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
              const key = dateKey(day)
              const state = getDayState(data.days, day)
              const isToday = key === todayStr
              const isSelected = key === selectedKey
              const dayNum = day.getDate()

              return (
                <div key={di} className="flex items-center justify-center">
                  <Cell
                    state={state}
                    dayNum={dayNum}
                    isToday={isToday}
                    isSelected={isSelected}
                    onClick={() => setSelectedKey(isSelected ? null : key)}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedKey && (
        <DayDetail
          dateKey={selectedKey}
          entry={selectedEntry}
          labels={data.onboarding.categories}
        />
      )}

      {/* Insight */}
      {generateInsight(data.days, data.onboarding.categories, days30) && (
        <div className="border-t border-charcoal/10 pt-5 flex flex-col gap-1">
          <p className="font-sans text-xs uppercase tracking-widest text-charcoal/30">Pattern</p>
          <p className="font-serif text-sm text-charcoal/65 leading-relaxed">
            {generateInsight(data.days, data.onboarding.categories, days30)}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        <LegendItem state="balanced" label="All three" />
        <LegendItem state="partial-2" label="Two wins" />
        <LegendItem state="partial-1" label="One win" />
        <LegendItem state="missed" label="Missed" />
      </div>

    </div>
  )
}

function Cell({
  state, dayNum, isToday, isSelected, onClick,
}: {
  state: DayState; dayNum: number; isToday: boolean; isSelected: boolean; onClick: () => void
}) {
  const base = 'w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer'
  const selectedRing = isSelected ? 'ring-2 ring-offset-2 ring-offset-beige ring-charcoal/50' : ''
  const todayRing = isToday && !isSelected ? 'ring-2 ring-offset-2 ring-offset-beige ring-charcoal/20' : ''

  if (state === 'balanced') {
    return (
      <div
        className={`${base} ${todayRing} ${selectedRing}`}
        style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }}
        onClick={onClick}
      >
        <span className="font-sans text-xs font-medium text-white">{dayNum}</span>
      </div>
    )
  }

  if (state === 'partial-2') {
    return (
      <div className={`${base} bg-charcoal/20 ${todayRing} ${selectedRing}`} onClick={onClick}>
        <span className="font-sans text-xs text-charcoal/60">{dayNum}</span>
      </div>
    )
  }

  if (state === 'partial-1') {
    return (
      <div className={`${base} bg-charcoal/10 ${todayRing} ${selectedRing}`} onClick={onClick}>
        <span className="font-sans text-xs text-charcoal/40">{dayNum}</span>
      </div>
    )
  }

  return (
    <div className={`${base} bg-charcoal/5 ${todayRing} ${selectedRing}`} onClick={onClick}>
      <span className="font-sans text-xs text-charcoal/20">{dayNum}</span>
    </div>
  )
}

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  physical: '#1D9E75',
  mental: '#7F77DD',
  spiritual: '#D85A30',
}

function DayDetail({
  dateKey: dk,
  entry,
  labels,
}: {
  dateKey: string
  entry: { physical: { text: string; reflection?: string } | null; mental: { text: string; reflection?: string } | null; spiritual: { text: string; reflection?: string } | null } | null
  labels: Record<CategoryKey, { label: string; definition: string }>
}) {
  const date = new Date(dk + 'T12:00:00')
  const formatted = date.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="bg-white/60 rounded-2xl px-5 py-4 flex flex-col gap-3">
      <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40">{formatted}</p>
      {!entry || (entry.physical === null && entry.mental === null && entry.spiritual === null) ? (
        <p className="font-serif text-sm text-charcoal/40 italic">No wins logged this day.</p>
      ) : (
        (['physical', 'mental', 'spiritual'] as CategoryKey[]).map(k => {
          const win = entry?.[k]
          if (!win) return (
            <div key={k} className="flex gap-3 items-start opacity-30">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: CATEGORY_COLORS[k] }} />
              <span className="font-sans text-sm text-charcoal/40">{labels[k].label} — not logged</span>
            </div>
          )
          return (
            <div key={k} className="flex gap-3 items-start">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: CATEGORY_COLORS[k] }} />
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-xs uppercase tracking-wider" style={{ color: CATEGORY_COLORS[k] }}>{labels[k].label}</span>
                <span className="font-serif text-sm text-charcoal leading-snug">{win.text}</span>
                {win.reflection && (
                  <span className="font-sans text-xs text-charcoal/30">{win.reflection}</span>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function LegendItem({ state, label }: { state: DayState; label: string }) {
  const dotClass =
    state === 'balanced'  ? '' :
    state === 'partial-2' ? 'bg-charcoal/20' :
    state === 'partial-1' ? 'bg-charcoal/10' :
                            'bg-charcoal/5'
  return (
    <div className="flex items-center gap-2">
      {state === 'balanced' ? (
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }} />
      ) : (
        <div className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />
      )}
      <span className="font-sans text-xs text-charcoal/40">{label}</span>
    </div>
  )
}
