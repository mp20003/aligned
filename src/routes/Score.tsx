/**
 * Pulse — Star Universe
 *
 * Your practice rendered as a living universe. Each day you log all three
 * wins, a supernova fires and a star is born. Partial days birth a dimmer
 * star. Missed days that had a chance explode — one star, not the world.
 *
 * This week: your active constellation forming in real time.
 * Universe: every week ever, rendered as clusters of light.
 *
 * Never shows streaks, scores, or percentages.
 */

import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function isFuture(d: Date): boolean {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return d > today
}

function getMondayOfWeek(d: Date): Date {
  const day = new Date(d)
  const dow = (day.getDay() + 6) % 7
  day.setDate(day.getDate() - dow)
  day.setHours(0, 0, 0, 0)
  return day
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

// Returns all weeks from the very first logged day up to and including current week
function getAllWeeks(days: Record<string, unknown>): Date[][] {
  const keys = Object.keys(days).sort()
  if (keys.length === 0) return [getCurrentWeek()]
  const firstDate = new Date(keys[0] + 'T12:00:00')
  const firstMonday = getMondayOfWeek(firstDate)
  const currentMonday = getMondayOfWeek(new Date())
  const weeks: Date[][] = []
  const cursor = new Date(firstMonday)
  while (cursor <= currentMonday) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cursor)
      d.setDate(cursor.getDate() + i)
      return d
    }))
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

// ── Seeded pseudo-random ───────────────────────────────────────────────────────

function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function strHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0
  return Math.abs(h)
}

// Generate 7 star positions for a week, deterministic from Monday's date string
function getStarPositions(mondayStr: string, W: number, H: number): [number, number][] {
  const rand = seededRand(strHash(mondayStr))
  const padding = 28
  const positions: [number, number][] = []
  let attempts = 0
  while (positions.length < 7 && attempts < 200) {
    attempts++
    const x = padding + rand() * (W - padding * 2)
    const y = padding + rand() * (H - padding * 2)
    // Ensure minimum distance from existing stars
    const tooClose = positions.some(([px, py]) => {
      const dx = px - x, dy = py - y
      return Math.sqrt(dx * dx + dy * dy) < 44
    })
    if (!tooClose) positions.push([x, y])
  }
  // Fill remaining if crowded space
  while (positions.length < 7) {
    positions.push([padding + rand() * (W - padding * 2), padding + rand() * (H - padding * 2)])
  }
  return positions
}

// ── Win helpers ────────────────────────────────────────────────────────────────

function getWins(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>,
  dateStr: string
): number {
  const entry = days[dateStr]
  if (!entry) return 0
  return CATEGORIES.filter(k => entry[k] !== null).length
}

// ── Explosion particles ────────────────────────────────────────────────────────

function ExplosionParticles({ cx, cy, onDone }: { cx: number; cy: number; onDone: () => void }) {
  const PARTICLE_COUNT = 10
  const rand = seededRand(Math.round(cx * 100 + cy))

  useEffect(() => {
    const t = setTimeout(onDone, 1200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <g>
      {/* Nova rings */}
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#D85A30" strokeWidth="1.5" opacity="0">
        <animate attributeName="r" from="0" to="30" dur="0.7s" fill="freeze" />
        <animate attributeName="opacity" from="0.8" to="0" dur="0.7s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#7F77DD" strokeWidth="1" opacity="0">
        <animate attributeName="r" from="0" to="18" dur="0.5s" fill="freeze" />
        <animate attributeName="opacity" from="0.6" to="0" dur="0.5s" fill="freeze" />
      </circle>
      {/* Particles */}
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2
        const dist = 18 + rand() * 20
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist
        const size = 1 + rand() * 2
        const colors = ['#D85A30', '#7F77DD', '#1D9E75', '#F5F0E8']
        const color = colors[Math.floor(rand() * colors.length)]
        return (
          <circle key={i} cx={cx} cy={cy} r={size} fill={color}>
            <animate attributeName="cx" to={cx + dx} dur="0.9s" fill="freeze" />
            <animate attributeName="cy" to={cy + dy} dur="0.9s" fill="freeze" />
            <animate attributeName="opacity" from="1" to="0" dur="0.9s" fill="freeze" />
            <animate attributeName="r" from={size} to={size * 0.2} dur="0.9s" fill="freeze" />
          </circle>
        )
      })}
    </g>
  )
}

// ── Nova birth flash ───────────────────────────────────────────────────────────

function NovaBurst({ cx, cy, onDone }: { cx: number; cy: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <g>
      <circle cx={cx} cy={cy} r={0} fill="#fff" opacity="0.9">
        <animate attributeName="r" from="0" to="40" dur="0.4s" fill="freeze" />
        <animate attributeName="opacity" from="0.9" to="0" dur="0.4s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#1D9E75" strokeWidth="2" opacity="0">
        <animate attributeName="r" from="0" to="25" dur="0.6s" fill="freeze" />
        <animate attributeName="opacity" from="0.8" to="0" dur="0.6s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#7F77DD" strokeWidth="1.5" opacity="0">
        <animate attributeName="r" from="0" to="36" dur="0.7s" fill="freeze" />
        <animate attributeName="opacity" from="0.5" to="0" dur="0.7s" fill="freeze" />
      </circle>
    </g>
  )
}

// ── Single star ────────────────────────────────────────────────────────────────

type StarStatus = 'future' | 'full' | 'partial' | 'missed' | 'exploding' | 'dust'

function Star({
  cx, cy, wins, status, dayIndex,
}: {
  cx: number; cy: number; wins: number; status: StarStatus; dayIndex: number
}) {
  const delay = `${dayIndex * 0.4}s`

  if (status === 'dust') {
    // Scattered dust remnant after explosion
    const rand = seededRand(Math.round(cx * 7 + cy * 3))
    return (
      <g opacity="0.25" style={{ animation: `universe-drift ${5 + dayIndex}s ease-in-out infinite`, animationDelay: `${dayIndex * 0.7}s` }}>
        {Array.from({ length: 5 }, (_, i) => (
          <circle
            key={i}
            cx={cx + (rand() - 0.5) * 18}
            cy={cy + (rand() - 0.5) * 18}
            r={0.8 + rand() * 1.2}
            fill="#D85A30"
            opacity={0.3 + rand() * 0.4}
          />
        ))}
        <circle cx={cx} cy={cy} r={1.5} fill="#7F77DD" opacity="0.3" />
      </g>
    )
  }

  if (status === 'future') {
    return <circle cx={cx} cy={cy} r={1.5} fill="rgba(44,44,42,0.08)" />
  }

  if (status === 'full') {
    const points = starPoints(cx, cy, 5, 7, 3.5)
    return (
      <g className="star-full" style={{ animationDelay: delay, transformOrigin: `${cx}px ${cy}px` }}>
        {/* Glow */}
        <circle cx={cx} cy={cy} r={10} fill="url(#star-glow)" opacity="0.4" />
        {/* Star shape */}
        <polygon points={points} fill="white" opacity="0.95" />
        {/* Colour tint based on wins */}
        <circle cx={cx} cy={cy} r={3} fill="#7F77DD" opacity="0.5" />
      </g>
    )
  }

  if (status === 'partial') {
    const r = wins === 2 ? 3.5 : 2.2
    return (
      <g className="star-partial" style={{ animationDelay: delay, transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={r + 3} fill="rgba(127,119,221,0.12)" />
        <circle cx={cx} cy={cy} r={r} fill="rgba(200,195,240,0.7)" />
      </g>
    )
  }

  if (status === 'missed') {
    // Truly missed — never logged anything
    return <circle cx={cx} cy={cy} r={1.2} fill="rgba(44,44,42,0.12)" />
  }

  return null
}

function starPoints(cx: number, cy: number, n: number, r1: number, r2: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const angle = (i * Math.PI) / n - Math.PI / 2
    const r = i % 2 === 0 ? r1 : r2
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

// ── Week constellation ─────────────────────────────────────────────────────────

const SVG_W = 320
const SVG_H = 260

type ExplodingDay = { dateStr: string; cx: number; cy: number }
type BornDay = { dateStr: string; cx: number; cy: number }

function WeekConstellation({
  week,
  days,
}: {
  week: Date[]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>
}) {
  const mondayStr = dateKey(week[0])
  const positions = getStarPositions(mondayStr, SVG_W, SVG_H)

  const [exploding, setExploding] = useState<ExplodingDay[]>([])
  const [born, setBorn] = useState<BornDay[]>([])
  const [dusts, setDusts] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('triova-dusts') ?? '[]')) }
    catch { return new Set() }
  })
  const [seenBorn, setSeenBorn] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('triova-born') ?? '[]')) }
    catch { return new Set() }
  })

  // On mount: check for missed days that need explosion, and newly completed days
  useEffect(() => {
    const toExplode: ExplodingDay[] = []
    const toBorn: BornDay[] = []
    const newDusts = new Set(dusts)
    const newSeenBorn = new Set(seenBorn)

    week.forEach((d, i) => {
      if (isFuture(d)) return
      const dk = dateKey(d)
      const wins = getWins(days, dk)
      const [cx, cy] = positions[i]

      // Missed day that hasn't been exploded yet
      if (wins === 0 && !newDusts.has(dk)) {
        // Only explode if it's actually a past day (not today that hasn't been logged yet)
        const isToday = dk === dateKey(new Date())
        if (!isToday) {
          toExplode.push({ dateStr: dk, cx, cy })
        }
      }

      // Fully aligned day — play birth nova once
      if (wins === 3 && !newSeenBorn.has(dk)) {
        toBorn.push({ dateStr: dk, cx, cy })
        newSeenBorn.add(dk)
      }
    })

    if (toBorn.length > 0) {
      setSeenBorn(newSeenBorn)
      localStorage.setItem('triova-born', JSON.stringify([...newSeenBorn]))
      // Stagger birth animations
      toBorn.forEach((b, i) => {
        setTimeout(() => {
          setBorn(prev => [...prev, b])
        }, i * 600)
      })
    }

    if (toExplode.length > 0) {
      // Stagger explosions
      toExplode.forEach((e, i) => {
        setTimeout(() => {
          setExploding(prev => [...prev, e])
        }, toBorn.length * 600 + i * 700 + 400)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleExplosionDone(dk: string) {
    setExploding(prev => prev.filter(e => e.dateStr !== dk))
    setDusts(prev => {
      const next = new Set(prev)
      next.add(dk)
      localStorage.setItem('triova-dusts', JSON.stringify([...next]))
      return next
    })
  }

  function handleBornDone(dk: string) {
    setBorn(prev => prev.filter(b => b.dateStr !== dk))
  }

  const isExplodingSet = new Set(exploding.map(e => e.dateStr))
  const isBornSet = new Set(born.map(b => b.dateStr))

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="star-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.8" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1a2e" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#1a1a2e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle deep-space background circle */}
      <ellipse cx={SVG_W / 2} cy={SVG_H / 2} rx={130} ry={110} fill="url(#bg-grad)" />

      {/* Connecting lines between full stars (faint constellation lines) */}
      {week.map((d, i) => {
        const dk = dateKey(d)
        const wins = getWins(days, dk)
        if (wins < 3 || isFuture(d) || dusts.has(dk)) return null
        // Connect to nearest full-star neighbour
        for (let j = i + 1; j < week.length; j++) {
          const dk2 = dateKey(week[j])
          const wins2 = getWins(days, dk2)
          if (wins2 === 3 && !dusts.has(dk2) && !isFuture(week[j])) {
            const [x1, y1] = positions[i]
            const [x2, y2] = positions[j]
            return <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.5" opacity="0.15" />
          }
        }
        return null
      })}

      {/* Stars */}
      {week.map((d, i) => {
        const dk = dateKey(d)
        const wins = getWins(days, dk)
        const [cx, cy] = positions[i]
        const future = isFuture(d)
        const isToday = dk === dateKey(new Date())

        let status: StarStatus
        if (future) status = 'future'
        else if (isExplodingSet.has(dk)) status = 'future' // hidden during explosion
        else if (dusts.has(dk)) status = 'dust'
        else if (wins === 3) status = 'full'
        else if (wins > 0) status = 'partial'
        else if (isToday) status = 'future' // today not yet logged
        else status = 'missed'

        return <Star key={dk} cx={cx} cy={cy} wins={wins} status={status} dayIndex={i} />
      })}

      {/* Explosion animations */}
      {exploding.map(e => (
        <ExplosionParticles key={e.dateStr} cx={e.cx} cy={e.cy} onDone={() => handleExplosionDone(e.dateStr)} />
      ))}

      {/* Birth nova animations */}
      {born.map(b => (
        <NovaBurst key={b.dateStr} cx={b.cx} cy={b.cy} onDone={() => handleBornDone(b.dateStr)} />
      ))}
    </svg>
  )
}

// ── Universe view ──────────────────────────────────────────────────────────────

const UNI_W = 320
const UNI_H = 320
const CLUSTER_R = 28 // radius within which a week's stars sit

function getClusterCenters(weekCount: number): [number, number][] {
  // Arrange clusters in an organic spiral/scatter
  const rand = seededRand(42)
  const centers: [number, number][] = []
  const padding = 40
  let attempts = 0

  while (centers.length < weekCount && attempts < 2000) {
    attempts++
    const x = padding + rand() * (UNI_W - padding * 2)
    const y = padding + rand() * (UNI_H - padding * 2)
    const tooClose = centers.some(([px, py]) => {
      const dx = px - x, dy = py - y
      return Math.sqrt(dx * dx + dy * dy) < CLUSTER_R * 2.4
    })
    if (!tooClose) centers.push([x, y])
  }
  // Fill remaining if space exhausted
  while (centers.length < weekCount) {
    centers.push([padding + rand() * (UNI_W - padding * 2), padding + rand() * (UNI_H - padding * 2)])
  }
  return centers
}

function UniverseView({
  weeks,
  days,
}: {
  weeks: Date[][]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown }>
}) {
  const centers = getClusterCenters(weeks.length)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function handleShare() {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `triova-universe-${dateKey(new Date())}.png`
    a.click()
  }

  // Draw shareable canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = 2
    canvas.width = UNI_W * scale
    canvas.height = UNI_H * scale
    ctx.scale(scale, scale)

    // Background
    ctx.fillStyle = '#F5F0E8'
    ctx.fillRect(0, 0, UNI_W, UNI_H)

    weeks.forEach((week, wi) => {
      const [cx, cy] = centers[wi]
      const rand = seededRand(strHash(dateKey(week[0])))
      const weekHasAny = week.some(d => !isFuture(d) && getWins(days, dateKey(d)) > 0)

      if (!weekHasAny) {
        // Void — dark patch
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CLUSTER_R * 0.8)
        grad.addColorStop(0, 'rgba(44,44,42,0.08)')
        grad.addColorStop(1, 'rgba(44,44,42,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, CLUSTER_R * 0.8, 0, Math.PI * 2)
        ctx.fill()
        return
      }

      week.forEach(d => {
        if (isFuture(d)) return
        const wins = getWins(days, dateKey(d))
        const sx = cx + (rand() - 0.5) * CLUSTER_R * 1.6
        const sy = cy + (rand() - 0.5) * CLUSTER_R * 1.6
        if (wins === 3) {
          ctx.beginPath()
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(127,119,221,0.9)'
          ctx.fill()
          // Glow
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6)
          g.addColorStop(0, 'rgba(127,119,221,0.4)')
          g.addColorStop(1, 'rgba(127,119,221,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(sx, sy, 6, 0, Math.PI * 2)
          ctx.fill()
        } else if (wins > 0) {
          ctx.beginPath()
          ctx.arc(sx, sy, 1.2, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(44,44,42,0.3)'
          ctx.fill()
        }
      })
    })

    ctx.fillStyle = 'rgba(44,44,42,0.2)'
    ctx.font = '500 9px Inter, system-ui'
    ctx.fillText('TRIOVA', 12, UNI_H - 10)
  }, [weeks, days, centers])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-charcoal/30">Your universe</p>
        <button
          onClick={handleShare}
          className="font-sans text-xs text-charcoal/30 underline underline-offset-2 hover:text-charcoal/50 transition-colors"
        >
          Save image
        </button>
      </div>

      {/* SVG live view */}
      <div className="rounded-2xl border border-charcoal/8 overflow-hidden bg-charcoal/2 relative" style={{ minHeight: UNI_H }}>
        <svg viewBox={`0 0 ${UNI_W} ${UNI_H}`} className="w-full">
          <defs>
            <radialGradient id="uni-star-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7F77DD" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7F77DD" stopOpacity="0" />
            </radialGradient>
          </defs>

          {weeks.map((week, wi) => {
            const [cx, cy] = centers[wi]
            const rand = seededRand(strHash(dateKey(week[0])))
            const weekHasAny = week.some(d => !isFuture(d) && getWins(days, dateKey(d)) > 0)
            const isCurrent = wi === weeks.length - 1

            if (!weekHasAny) {
              return (
                <circle key={wi} cx={cx} cy={cy} r={CLUSTER_R * 0.6}
                  fill="rgba(44,44,42,0.04)" stroke="rgba(44,44,42,0.06)" strokeWidth="0.5" />
              )
            }

            return (
              <g key={wi} className={isCurrent ? 'star-drift' : ''} style={{ animationDelay: `${wi * 0.3}s` }}>
                {week.map((d, di) => {
                  if (isFuture(d)) return null
                  const wins = getWins(days, dateKey(d))
                  const sx = cx + (rand() - 0.5) * CLUSTER_R * 1.6
                  const sy = cy + (rand() - 0.5) * CLUSTER_R * 1.6

                  if (wins === 3) {
                    return (
                      <g key={di} className="star-full" style={{ animationDelay: `${wi * 0.4 + di * 0.1}s`, transformOrigin: `${sx}px ${sy}px` }}>
                        <circle cx={sx} cy={sy} r={7} fill="url(#uni-star-glow)" />
                        <circle cx={sx} cy={sy} r={2.2} fill="white" opacity="0.9" />
                      </g>
                    )
                  } else if (wins > 0) {
                    return <circle key={di} cx={sx} cy={sy} r={1} fill="rgba(44,44,42,0.25)" />
                  }
                  return null
                })}

                {/* Faint cluster boundary for current week */}
                {isCurrent && (
                  <circle cx={cx} cy={cy} r={CLUSTER_R} fill="none"
                    stroke="rgba(127,119,221,0.12)" strokeWidth="1" strokeDasharray="3 4" />
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip: week count */}
        <p className="absolute bottom-3 right-3 font-sans text-xs text-charcoal/20 uppercase tracking-widest">
          {weeks.length} week{weeks.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function Pulse() {
  const { data } = useApp()
  const week = getCurrentWeek()
  const allWeeks = getAllWeeks(data.days)
  const todayStr = dateKey(new Date())
  const todayWins = getWins(data.days, todayStr)
  const weekAligned = week.filter(d => !isFuture(d) && getWins(data.days, dateKey(d)) === 3).length
  const elapsed = week.filter(d => !isFuture(d)).length

  return (
    <div className="min-h-screen bg-beige max-w-md lg:max-w-2xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-10">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-charcoal/40">Triova</p>
        <h1 className="font-serif text-2xl lg:text-4xl text-charcoal">Your pulse</h1>
        <p className="font-sans text-xs lg:text-sm text-charcoal/40 leading-relaxed mt-1">
          Every win you log fires a supernova. Every star you birth is yours to keep.
        </p>
      </div>

      {/* This week */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-charcoal/30">This week</p>
          <p className="font-sans text-xs text-charcoal/30">
            {weekAligned} star{weekAligned !== 1 ? 's' : ''} born · {elapsed} day{elapsed !== 1 ? 's' : ''} elapsed
          </p>
        </div>
        <div className="rounded-2xl border border-charcoal/8 bg-charcoal/2 overflow-hidden">
          <WeekConstellation week={week} days={data.days} />
        </div>
        {todayWins < 3 && (
          <p className="font-serif text-sm text-charcoal/40 italic text-center">
            {todayWins === 0
              ? 'Log your first win today to birth a star.'
              : todayWins === 1
              ? "One win in. Two more and tonight’s star ignites."
              : 'Two wins in. One more to fire the supernova.'}
          </p>
        )}
        {todayWins === 3 && (
          <p className="font-serif text-sm text-charcoal/60 italic text-center">
            All three wins logged. Tonight's star is alive.
          </p>
        )}
      </div>

      {/* Universe */}
      <UniverseView weeks={allWeeks} days={data.days} />

    </div>
  )
}
