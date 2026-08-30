/**
 * History
 *
 * 30-day grid of daily alignment states. Balanced = conic gradient,
 * partial = muted, missed = faint. Clicking any day opens a detail panel.
 * One insight sentence from pattern analysis.
 *
 * Never shows streaks, percentages as goals, or failure language.
 */

import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { getDailySuggestions, getPastWins } from '../data/suggestions'
import WinCard from '../components/WinCard'
import { dateKey } from '../lib/date'
import type { CategoryKey, DayEntry } from '../types'

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

  ctx.fillStyle = '#0f0f1a'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = '500 11px Inter, system-ui, sans-serif'
  ctx.fillText('TRIOVA', PAD, PAD - 4)
  ctx.fillStyle = 'rgba(255,255,255,0.90)'
  ctx.font = '600 18px Lora, Georgia, serif'
  ctx.fillText(name ? `${name}'s last 30 days` : 'Last 30 days', PAD, PAD + 16)

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

    if (done === 3) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      const grad = ctx.createConicGradient(0, cx, cy)
      grad.addColorStop(0,   '#1D9E75')
      grad.addColorStop(1/3, '#7F77DD')
      grad.addColorStop(2/3, '#D85A30')
      grad.addColorStop(1,   '#1D9E75')
      ctx.fillStyle = grad
      ctx.fill()
    } else if (done === 2) {
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.32)'
      ctx.fill()
    } else if (done === 1) {
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.30)'
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  })

  ctx.fillStyle = 'rgba(255,255,255,0.20)'
  ctx.font = '400 10px Inter, system-ui, sans-serif'
  ctx.fillText('triova.app', PAD, H - 12)

  return canvas.toDataURL('image/png')
}

export default function History() {
  const { data, logWin, clearDay } = useApp()
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

  const selectedEntry = selectedKey ? data.days[selectedKey] ?? { physical: null, mental: null, spiritual: null } : null

  return (
    <div className="min-h-screen max-w-md lg:max-w-6xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-8 lg:gap-10">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">History</p>
          <h1 className="font-serif text-2xl lg:text-4xl text-white">Last 30 days</h1>
        </div>
        <button
          onClick={handleShare}
          className="mt-2 text-white/20 hover:text-white/50 transition-colors"
          aria-label="Share"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lg:w-6 lg:h-6">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
        <a ref={shareRef} className="hidden" />
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14">
        {/* Grid */}
        <div className="flex flex-col gap-2 lg:gap-3 lg:w-[420px] lg:shrink-0">
          <div className="grid grid-cols-7 gap-1 lg:gap-3">
            {DAYS.map((d, i) => (
              <div key={i} className="text-center font-sans text-xs lg:text-sm text-white/25">{d}</div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1 lg:gap-3">
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

          {/* Legend */}
          <div className="flex gap-4 flex-wrap mt-4">
            <LegendItem state="balanced" label="All three" />
            <LegendItem state="partial-2" label="Two wins" />
            <LegendItem state="partial-1" label="One win" />
            <LegendItem state="missed" label="Missed" />
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-6 lg:gap-8 flex-1">
          {generateInsight(data.days, data.onboarding.categories, days30) && (
            <div className="border-t lg:border-t-0 pt-5 lg:pt-0 flex flex-col gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/25">Pattern</p>
              <p className="font-serif text-base lg:text-lg text-white/55 leading-relaxed">
                {generateInsight(data.days, data.onboarding.categories, days30)}
              </p>
            </div>
          )}

          <BalanceBars days={data.days} labels={data.onboarding.categories} days30={days30} />

          {selectedKey && selectedEntry ? (
            <DayEditor
              dateKey={selectedKey}
              entry={selectedEntry}
              labels={data.onboarding.categories}
              allDays={data.days}
              onConfirm={(key, text, reflection) => logWin(selectedKey, key, text, reflection)}
              onClear={() => clearDay(selectedKey)}
            />
          ) : (
            <p className="hidden lg:block font-sans text-sm lg:text-base text-white/20 italic">
              Click any day to log or edit wins for it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Cell({
  state, dayNum, isToday, isSelected, onClick,
}: {
  state: DayState; dayNum: number; isToday: boolean; isSelected: boolean; onClick: () => void
}) {
  const base = 'relative w-9 h-9 lg:w-12 lg:h-12 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95'
  const selectedRing = isSelected ? 'ring-2 ring-offset-2 ring-white/50' : ''
  const todayRing = isToday && !isSelected ? 'ring-1 ring-white/20' : ''
  const textSize = 'text-xs lg:text-sm'

  if (state === 'balanced') {
    return (
      <div
        className={`${base} ${todayRing} ${selectedRing}`}
        style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }}
        onClick={onClick}
      >
        <span className={`relative z-10 font-sans ${textSize} font-medium text-white`}>{dayNum}</span>
      </div>
    )
  }

  // Two wins — a large, clearly-filled inner disc
  if (state === 'partial-2') {
    return (
      <div className={`${base} ${todayRing} ${selectedRing}`} style={{ background: 'rgba(255,255,255,0.03)' }} onClick={onClick}>
        <div className="absolute inset-[12%] rounded-full" style={{ background: 'rgba(255,255,255,0.32)' }} />
        <span className={`relative z-10 font-sans ${textSize} text-white/75`}>{dayNum}</span>
      </div>
    )
  }

  // One win — a small ember, most of the cell stays open
  if (state === 'partial-1') {
    return (
      <div className={`${base} ${todayRing} ${selectedRing}`} style={{ background: 'transparent' }} onClick={onClick}>
        <div className="absolute inset-[36%] rounded-full" style={{ background: 'rgba(255,255,255,0.30)' }} />
        <span className={`relative z-10 font-sans ${textSize} text-white/45`}>{dayNum}</span>
      </div>
    )
  }

  // Missed — genuinely blank, just a faint boundary so the cell still reads as a day
  return (
    <div className={`${base} ${todayRing} ${selectedRing}`}
      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)' }} onClick={onClick}>
      <span className={`font-sans ${textSize} text-white/15`}>{dayNum}</span>
    </div>
  )
}

function DayEditor({
  dateKey: dk,
  entry,
  labels,
  allDays,
  onConfirm,
  onClear,
}: {
  dateKey: string
  entry: DayEntry
  labels: Record<CategoryKey, { label: string; definition: string }>
  allDays: Record<string, DayEntry>
  onConfirm: (key: CategoryKey, text: string, reflection: string) => void
  onClear: () => void
}) {
  const date = new Date(dk + 'T12:00:00')
  const formatted = date.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })
  const hasAnyWin = CATEGORIES.some(k => entry[k] !== null)

  function handleClear() {
    if (window.confirm(`Clear all wins for ${formatted}? This can't be undone.`)) onClear()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">{formatted}</p>
        {hasAnyWin && (
          <button
            onClick={handleClear}
            className="font-sans text-xs text-white/25 hover:text-white/60 transition-colors underline underline-offset-2"
          >
            Clear day
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3 lg:gap-4">
        {CATEGORIES.map(key => (
          <WinCard
            key={key}
            categoryKey={key}
            label={labels[key].label}
            existing={entry[key]}
            pastWins={getPastWins(allDays, key, dk)}
            dailySuggestions={getDailySuggestions(key, dk)}
            onConfirm={(text, reflection) => onConfirm(key, text, reflection)}
          />
        ))}
      </div>
    </div>
  )
}

const CATEGORY_BG: Record<CategoryKey, string> = {
  physical: 'bg-physical',
  mental: 'bg-mental',
  spiritual: 'bg-spiritual',
}
const CATEGORY_TEXT: Record<CategoryKey, string> = {
  physical: 'text-physical',
  mental: 'text-mental',
  spiritual: 'text-spiritual',
}

function BalanceBars({
  days, labels, days30,
}: {
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>
  labels: Record<CategoryKey, { label: string; definition: string }>
  days30: Date[]
}) {
  const total = days30.length
  const counts: Record<CategoryKey, number> = { physical: 0, mental: 0, spiritual: 0 }
  for (const d of days30) {
    const entry = days[dateKey(d)]
    if (!entry) continue
    CATEGORIES.forEach(k => { if (entry[k] !== null) counts[k]++ })
  }

  if (Object.values(counts).every(c => c === 0)) return null

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/25">Balance</p>
      <div className="flex flex-col gap-2.5 lg:gap-3">
        {CATEGORIES.map(k => {
          const pct = Math.round((counts[k] / total) * 100)
          return (
            <div key={k} className="flex items-center gap-3">
              <span className={`font-sans text-xs lg:text-sm uppercase tracking-widest w-20 lg:w-24 shrink-0 ${CATEGORY_TEXT[k]}`}>
                {labels[k].label}
              </span>
              <div className="flex-1 h-2 lg:h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className={`h-full rounded-full ${CATEGORY_BG[k]} transition-all duration-700`}
                  style={{ width: `${pct}%`, opacity: 0.8 }}
                />
              </div>
              <span className="font-sans text-xs lg:text-sm text-white/25 w-10 text-right shrink-0">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LegendItem({ state, label }: { state: DayState; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {state === 'balanced' && (
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: 'conic-gradient(#1D9E75 0deg, #7F77DD 120deg, #D85A30 240deg, #1D9E75 360deg)' }} />
      )}
      {state === 'partial-2' && (
        <div className="relative w-3 h-3 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="absolute inset-[12%] rounded-full" style={{ background: 'rgba(255,255,255,0.32)' }} />
        </div>
      )}
      {state === 'partial-1' && (
        <div className="relative w-3 h-3 rounded-full shrink-0">
          <div className="absolute inset-[36%] rounded-full" style={{ background: 'rgba(255,255,255,0.30)' }} />
        </div>
      )}
      {state === 'missed' && (
        <div className="w-3 h-3 rounded-full shrink-0" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
      )}
      <span className="font-sans text-xs lg:text-sm text-white/30">{label}</span>
    </div>
  )
}
