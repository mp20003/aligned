/**
 * Triova — Star Universe
 *
 * Each aligned day (3 wins) fires a supernova and births a realistic star.
 * 1-2 wins: a comet flies in and rests. Missed past days explode and leave dust.
 * Future / today-not-yet: nothing rendered.
 *
 * Universe panel: symbolic clusters — one per week, brightness = aligned days.
 */

import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import type { CategoryKey } from '../types'

const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  physical:  '#1D9E75',
  mental:    '#7F77DD',
  spiritual: '#D85A30',
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function isToday(d: Date): boolean {
  return dateKey(d) === dateKey(new Date())
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

// ── Win helpers ────────────────────────────────────────────────────────────────

function getWins(
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown } | null>,
  dateStr: string
): number {
  const entry = days[dateStr]
  if (!entry) return 0
  return CATEGORIES.filter(k => entry[k] !== null).length
}

// ── Star positions (deterministic per week) ────────────────────────────────────

const SVG_W = 340
const SVG_H = 280

function getStarPositions(mondayStr: string): [number, number][] {
  const rand = seededRand(strHash(mondayStr))
  const padding = 36
  const positions: [number, number][] = []
  let attempts = 0
  while (positions.length < 7 && attempts < 300) {
    attempts++
    const x = padding + rand() * (SVG_W - padding * 2)
    const y = padding + rand() * (SVG_H - padding * 2)
    const tooClose = positions.some(([px, py]) => {
      const dx = px - x, dy = py - y
      return Math.sqrt(dx * dx + dy * dy) < 52
    })
    if (!tooClose) positions.push([x, y])
  }
  while (positions.length < 7) {
    positions.push([padding + rand() * (SVG_W - padding * 2), padding + rand() * (SVG_H - padding * 2)])
  }
  return positions
}

// ── Star type (seeded per date) ────────────────────────────────────────────────

type StarType = 'diffraction' | 'giant' | 'binary' | 'cluster'

function getStarType(dateStr: string): StarType {
  const rand = seededRand(strHash(dateStr + 'type'))
  const r = rand()
  if (r < 0.45) return 'diffraction'
  if (r < 0.70) return 'giant'
  if (r < 0.85) return 'binary'
  return 'cluster'
}

function hasPlanet(dateStr: string): boolean {
  const rand = seededRand(strHash(dateStr + 'planet'))
  return rand() < 0.28
}

function getPlanetColor(dateStr: string): string {
  const rand = seededRand(strHash(dateStr + 'pcolor'))
  const keys = Object.keys(CATEGORY_COLORS) as CategoryKey[]
  return CATEGORY_COLORS[keys[Math.floor(rand() * keys.length)]]
}

function getPlanetAngle(dateStr: string): number {
  const rand = seededRand(strHash(dateStr + 'pangle'))
  return rand() * Math.PI * 2
}

// ── Realistic star SVG ─────────────────────────────────────────────────────────

function RealisticStar({ cx, cy, type, dateStr, born }: {
  cx: number; cy: number; type: StarType; dateStr: string; born: boolean
}) {
  const planet = hasPlanet(dateStr)
  const planetColor = getPlanetColor(dateStr)
  const planetAngle = getPlanetAngle(dateStr)
  const planetDist = 18
  const px = cx + Math.cos(planetAngle) * planetDist
  const py = cy + Math.sin(planetAngle) * planetDist

  const id = `glow-${dateStr.replace(/-/g, '')}`
  const id2 = `glow2-${dateStr.replace(/-/g, '')}`

  const starClass = born ? 'star-born' : 'star-full'

  return (
    <g className={starClass} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="35%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7F77DD" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id2} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {type === 'diffraction' && (
        <>
          {/* Outer glow */}
          <circle cx={cx} cy={cy} r={22} fill={`url(#${id})`} />
          {/* Diffraction spikes */}
          <line x1={cx - 28} y1={cy} x2={cx + 28} y2={cy} stroke="white" strokeWidth="0.6" opacity="0.35" />
          <line x1={cx} y1={cy - 28} x2={cx} y2={cy + 28} stroke="white" strokeWidth="0.6" opacity="0.35" />
          <line x1={cx - 18} y1={cy - 18} x2={cx + 18} y2={cy + 18} stroke="white" strokeWidth="0.4" opacity="0.18" />
          <line x1={cx + 18} y1={cy - 18} x2={cx - 18} y2={cy + 18} stroke="white" strokeWidth="0.4" opacity="0.18" />
          {/* Core */}
          <circle cx={cx} cy={cy} r={5} fill={`url(#${id2})`} />
          <circle cx={cx} cy={cy} r={2.5} fill="white" />
        </>
      )}

      {type === 'giant' && (
        <>
          <circle cx={cx} cy={cy} r={30} fill={`url(#${id})`} />
          <circle cx={cx} cy={cy} r={10} fill="white" opacity="0.2" />
          <circle cx={cx} cy={cy} r={6} fill={`url(#${id2})`} />
          <circle cx={cx} cy={cy} r={3} fill="white" />
        </>
      )}

      {type === 'binary' && (
        <>
          <circle cx={cx - 5} cy={cy} r={18} fill={`url(#${id})`} opacity="0.6" />
          <circle cx={cx + 5} cy={cy} r={16} fill={`url(#${id2})`} opacity="0.4" />
          <circle cx={cx - 5} cy={cy} r={3} fill="white" />
          <circle cx={cx + 5} cy={cy} r={2.5} fill="white" opacity="0.85" />
        </>
      )}

      {type === 'cluster' && (
        <>
          <circle cx={cx} cy={cy} r={20} fill={`url(#${id})`} />
          <circle cx={cx} cy={cy - 6} r={2} fill="white" />
          <circle cx={cx - 5} cy={cy + 4} r={1.8} fill="white" opacity="0.85" />
          <circle cx={cx + 5} cy={cy + 4} r={1.5} fill="white" opacity="0.7" />
        </>
      )}

      {/* Planet */}
      {planet && (
        <circle cx={px} cy={py} r={3.2} fill={planetColor} opacity="0.9" />
      )}
    </g>
  )
}

// ── Comet (1–2 wins) ───────────────────────────────────────────────────────────

function Comet({ cx, cy, dateStr }: { cx: number; cy: number; dateStr: string }) {
  const rand = seededRand(strHash(dateStr + 'comet'))
  // Entry angle: always coming from upper-left or upper-right quadrants
  const angles = [Math.PI * 0.75, Math.PI * 1.25, Math.PI * 0.55, Math.PI * 1.45]
  const angle = angles[Math.floor(rand() * angles.length)]
  const dist = 90
  const startX = cx + Math.cos(angle) * dist
  const startY = cy + Math.sin(angle) * dist

  // Tail direction is opposite to travel direction
  const tailAngle = angle + Math.PI
  const tailLen = 40 + rand() * 20
  const tailEndX = cx + Math.cos(tailAngle) * tailLen * 0.6
  const tailEndY = cy + Math.sin(tailAngle) * tailLen * 0.6

  const id = `comet-grad-${dateStr.replace(/-/g, '')}`
  const animId = `comet-anim-${dateStr.replace(/-/g, '')}`

  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse"
          x1={`${cx}`} y1={`${cy}`} x2={`${tailEndX}`} y2={`${tailEndY}`}>
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <style>{`
          @keyframes ${animId} {
            from { transform: translate(${startX - cx}px, ${startY - cy}px); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translate(0px, 0px); opacity: 1; }
          }
        `}</style>
      </defs>
      <g style={{ animation: `${animId} 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`, transformOrigin: `${cx}px ${cy}px` }}>
        {/* Tail */}
        <line x1={cx} y1={cy} x2={tailEndX} y2={tailEndY}
          stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <line x1={cx} y1={cy} x2={tailEndX * 0.7 + cx * 0.3} y2={tailEndY * 0.7 + cy * 0.3}
          stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.25" />
        {/* Head */}
        <circle cx={cx} cy={cy} r={8} fill="white" opacity="0.12" />
        <circle cx={cx} cy={cy} r={3} fill="white" opacity="0.8" />
        <circle cx={cx} cy={cy} r={1.5} fill="white" />
      </g>
    </g>
  )
}

// ── Explosion + dust ───────────────────────────────────────────────────────────

function ExplosionParticles({ cx, cy, onDone }: { cx: number; cy: number; onDone: () => void }) {
  const rand = seededRand(Math.round(cx * 100 + cy))
  useEffect(() => {
    const t = setTimeout(onDone, 1200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <g>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#D85A30" strokeWidth="1.5">
        <animate attributeName="r" from="0" to="38" dur="0.7s" fill="freeze" />
        <animate attributeName="opacity" from="0.9" to="0" dur="0.7s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#7F77DD" strokeWidth="1">
        <animate attributeName="r" from="0" to="22" dur="0.5s" fill="freeze" />
        <animate attributeName="opacity" from="0.6" to="0" dur="0.5s" fill="freeze" />
      </circle>
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const dist = 20 + rand() * 24
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist
        const size = 1.2 + rand() * 2
        const colors = ['#D85A30', '#7F77DD', '#1D9E75', 'white']
        const color = colors[Math.floor(rand() * colors.length)]
        return (
          <circle key={i} cx={cx} cy={cy} r={size} fill={color}>
            <animate attributeName="cx" to={cx + dx} dur="1s" fill="freeze" />
            <animate attributeName="cy" to={cy + dy} dur="1s" fill="freeze" />
            <animate attributeName="opacity" from="1" to="0" dur="1s" fill="freeze" />
          </circle>
        )
      })}
    </g>
  )
}

function DustRemnant({ cx, cy, dateStr }: { cx: number; cy: number; dateStr: string }) {
  const rand = seededRand(strHash(dateStr + 'dust'))
  return (
    <g opacity="0.22">
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={i}
          cx={cx + (rand() - 0.5) * 22}
          cy={cy + (rand() - 0.5) * 22}
          r={0.7 + rand() * 1.4}
          fill="#D85A30"
          opacity={0.3 + rand() * 0.5}
        />
      ))}
      <circle cx={cx} cy={cy} r={1.2} fill="#7F77DD" opacity="0.35" />
    </g>
  )
}

// ── Nova burst (birth flash) ───────────────────────────────────────────────────

function NovaBurst({ cx, cy, onDone }: { cx: number; cy: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <g>
      <circle cx={cx} cy={cy} r={0} fill="white" opacity="0.95">
        <animate attributeName="r" from="0" to="80" dur="0.5s" fill="freeze" />
        <animate attributeName="opacity" from="0.95" to="0" dur="0.5s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#1D9E75" strokeWidth="2.5">
        <animate attributeName="r" from="0" to="55" dur="0.7s" fill="freeze" />
        <animate attributeName="opacity" from="0.8" to="0" dur="0.7s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#7F77DD" strokeWidth="1.5">
        <animate attributeName="r" from="0" to="70" dur="0.85s" fill="freeze" />
        <animate attributeName="opacity" from="0.5" to="0" dur="0.85s" fill="freeze" />
      </circle>
    </g>
  )
}

// ── Week constellation ─────────────────────────────────────────────────────────

type ExplodingDay = { dateStr: string; cx: number; cy: number }
type BornDay      = { dateStr: string; cx: number; cy: number }

function WeekConstellation({
  week,
  days,
}: {
  week: Date[]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown } | null>
}) {
  const mondayStr = dateKey(week[0])
  const positions = getStarPositions(mondayStr)

  const [exploding, setExploding] = useState<ExplodingDay[]>([])
  const [dusts, setDusts] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('triova-dusts') ?? '[]')) }
    catch { return new Set() }
  })
  const [novaQueue, setNovaQueue] = useState<BornDay[]>([])
  const [activeNova, setActiveNova] = useState<BornDay | null>(null)
  const [seenBorn, setSeenBorn] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('triova-born') ?? '[]')) }
    catch { return new Set() }
  })

  useEffect(() => {
    const toExplode: ExplodingDay[] = []
    const toBorn: BornDay[] = []
    const newSeenBorn = new Set(seenBorn)

    week.forEach((d, i) => {
      if (isFuture(d) || isToday(d)) return
      const dk = dateKey(d)
      const wins = getWins(days, dk)
      const [cx, cy] = positions[i]

      if (wins === 0 && !dusts.has(dk)) {
        toExplode.push({ dateStr: dk, cx, cy })
      }
      if (wins === 3 && !newSeenBorn.has(dk)) {
        toBorn.push({ dateStr: dk, cx, cy })
        newSeenBorn.add(dk)
      }
    })

    if (toBorn.length > 0) {
      setSeenBorn(newSeenBorn)
      localStorage.setItem('triova-born', JSON.stringify([...newSeenBorn]))
      setNovaQueue(toBorn)
    }

    if (toExplode.length > 0) {
      const delay = toBorn.length > 0 ? 1200 : 0
      toExplode.forEach((e, i) => {
        setTimeout(() => setExploding(prev => [...prev, e]), delay + i * 700)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Play nova queue one at a time
  useEffect(() => {
    if (activeNova === null && novaQueue.length > 0) {
      const [next, ...rest] = novaQueue
      setActiveNova(next)
      setNovaQueue(rest)
    }
  }, [activeNova, novaQueue])

  function handleNovaDone() {
    setActiveNova(null)
  }

  function handleExplosionDone(dk: string) {
    setExploding(prev => prev.filter(e => e.dateStr !== dk))
    setDusts(prev => {
      const next = new Set(prev)
      next.add(dk)
      localStorage.setItem('triova-dusts', JSON.stringify([...next]))
      return next
    })
  }

  const isExplodingSet = new Set(exploding.map(e => e.dateStr))
  const activeNovaKey = activeNova?.dateStr ?? null

  // Constellation lines between full stars
  const fullStarIndices: number[] = []
  week.forEach((d, i) => {
    if (isFuture(d) || isToday(d)) return
    const dk = dateKey(d)
    if (getWins(days, dk) === 3 && !dusts.has(dk) && !isExplodingSet.has(dk)) {
      fullStarIndices.push(i)
    }
  })

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ overflow: 'visible' }}>
      {/* Constellation lines */}
      {fullStarIndices.slice(0, -1).map((i, idx) => {
        const j = fullStarIndices[idx + 1]
        const [x1, y1] = positions[i]
        const [x2, y2] = positions[j]
        return <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="white" strokeWidth="0.5" opacity="0.12" />
      })}

      {/* Stars, comets, dust */}
      {week.map((d, i) => {
        const dk = dateKey(d)
        const [cx, cy] = positions[i]

        if (isFuture(d) || isToday(d)) return null
        if (isExplodingSet.has(dk)) return null

        if (dusts.has(dk)) {
          return <DustRemnant key={dk} cx={cx} cy={cy} dateStr={dk} />
        }

        const wins = getWins(days, dk)
        if (wins === 3) {
          return (
            <RealisticStar
              key={dk}
              cx={cx} cy={cy}
              type={getStarType(dk)}
              dateStr={dk}
              born={false}
            />
          )
        }
        if (wins > 0) {
          return <Comet key={dk} cx={cx} cy={cy} dateStr={dk} />
        }
        return null
      })}

      {/* Explosion animations */}
      {exploding.map(e => (
        <ExplosionParticles key={e.dateStr} cx={e.cx} cy={e.cy}
          onDone={() => handleExplosionDone(e.dateStr)} />
      ))}

      {/* Nova burst overlaid on top of star */}
      {activeNova && (
        <NovaBurst key={activeNova.dateStr} cx={activeNova.cx} cy={activeNova.cy} onDone={handleNovaDone} />
      )}
    </svg>
  )
}

// ── Universe panel (Option B — symbolic clusters) ──────────────────────────────

const UNI_W = 340
const UNI_H = 260
const CLUSTER_R = 22

function getClusterCenters(count: number): [number, number][] {
  const rand = seededRand(9999)
  const padding = 32
  const centers: [number, number][] = []
  let attempts = 0
  while (centers.length < count && attempts < 3000) {
    attempts++
    const x = padding + rand() * (UNI_W - padding * 2)
    const y = padding + rand() * (UNI_H - padding * 2)
    const tooClose = centers.some(([px, py]) => {
      const dx = px - x, dy = py - y
      return Math.sqrt(dx * dx + dy * dy) < CLUSTER_R * 2.6
    })
    if (!tooClose) centers.push([x, y])
  }
  while (centers.length < count) {
    centers.push([padding + rand() * (UNI_W - padding * 2), padding + rand() * (UNI_H - padding * 2)])
  }
  return centers
}

function UniversePanel({
  weeks,
  days,
}: {
  weeks: Date[][]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown } | null>
}) {
  const centers = getClusterCenters(weeks.length)

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-xs uppercase tracking-widest text-white/25">Your universe</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a14' }}>
        <svg viewBox={`0 0 ${UNI_W} ${UNI_H}`} className="w-full">
          {weeks.map((week, wi) => {
            const [cx, cy] = centers[wi]
            const isCurrent = wi === weeks.length - 1
            const rand = seededRand(strHash(dateKey(week[0]) + 'uni'))

            const pastDays = week.filter(d => !isFuture(d) && !isToday(d))
            const alignedDays = pastDays.filter(d => getWins(days, dateKey(d)) === 3)
            const partialDays = pastDays.filter(d => { const w = getWins(days, dateKey(d)); return w > 0 && w < 3 })
            const deadDays = pastDays.filter(d => getWins(days, dateKey(d)) === 0 && days[dateKey(d)] !== undefined)

            if (alignedDays.length === 0 && partialDays.length === 0 && deadDays.length === 0) {
              // No data at all — invisible
              return <g key={wi} />
            }

            return (
              <g key={wi} className={isCurrent ? 'star-drift' : ''} style={{ animationDelay: `${wi * 0.2}s` }}>
                {/* Bright stars — aligned days */}
                {alignedDays.map((_, di) => {
                  const angle = rand() * Math.PI * 2
                  const dist = rand() * CLUSTER_R * 0.85
                  const sx = cx + Math.cos(angle) * dist
                  const sy = cy + Math.sin(angle) * dist
                  return (
                    <g key={`a${di}`}>
                      <circle cx={sx} cy={sy} r={5} fill="white" opacity="0.07" />
                      <circle cx={sx} cy={sy} r={1.8} fill="white" opacity="0.9" />
                    </g>
                  )
                })}
                {/* Dim dots — partial days */}
                {partialDays.map((_, di) => {
                  const angle = rand() * Math.PI * 2
                  const dist = rand() * CLUSTER_R * 0.85
                  const sx = cx + Math.cos(angle) * dist
                  const sy = cy + Math.sin(angle) * dist
                  return <circle key={`p${di}`} cx={sx} cy={sy} r={1} fill="white" opacity="0.2" />
                })}
                {/* Dead stars — fully missed days (dust specks) */}
                {deadDays.map((_, di) => {
                  const angle = rand() * Math.PI * 2
                  const dist = rand() * CLUSTER_R * 0.85
                  const sx = cx + Math.cos(angle) * dist
                  const sy = cy + Math.sin(angle) * dist
                  return <circle key={`d${di}`} cx={sx} cy={sy} r={1.2} fill="#D85A30" opacity="0.35" />
                })}
                {isCurrent && (
                  <circle cx={cx} cy={cy} r={CLUSTER_R + 4}
                    fill="none" stroke="rgba(127,119,221,0.2)" strokeWidth="1" strokeDasharray="3 5" />
                )}
              </g>
            )
          })}
        </svg>
      </div>
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
  const weekAligned = week.filter(d => !isFuture(d) && !isToday(d) && getWins(data.days, dateKey(d)) === 3).length
  const elapsed = week.filter(d => !isFuture(d) && !isToday(d)).length

  return (
    <div className="min-h-screen max-w-md lg:max-w-2xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-10"
      style={{ background: '#0a0a14' }}>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-white/25">Triova</p>
        <h1 className="font-serif text-2xl lg:text-4xl text-white">Your pulse</h1>
        <p className="font-sans text-xs text-white/30 leading-relaxed mt-1">
          Every win you log fires a supernova. Every star you birth is yours to keep.
        </p>
      </div>

      {/* This week */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-sans text-xs uppercase tracking-widest text-white/25">This week</p>
          <p className="font-sans text-xs text-white/25">
            {weekAligned} star{weekAligned !== 1 ? 's' : ''} born · {elapsed} day{elapsed !== 1 ? 's' : ''} elapsed
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0d1e' }}>
          <WeekConstellation week={week} days={data.days} />
        </div>

        {todayWins < 3 && (
          <p className="font-serif text-sm text-white/30 italic text-center">
            {todayWins === 0
              ? 'Log your first win today to birth a star.'
              : todayWins === 1
              ? "One win in. Two more and tonight's star ignites."
              : 'Two wins in. One more to fire the supernova.'}
          </p>
        )}
        {todayWins === 3 && (
          <p className="font-serif text-sm text-white/50 italic text-center">
            All three wins logged. Tonight's star is alive.
          </p>
        )}
      </div>

      {/* Universe */}
      <UniversePanel weeks={allWeeks} days={data.days} />
    </div>
  )
}
