/**
 * Triova — Your Real Sky
 *
 * Each user's sky is real astronomy for their own location (see
 * src/lib/sky.ts and src/data/stars.json). Each 30-day cycle assigns one
 * real star to each calendar day, brightest-first, within a fixed patch of
 * sky near zenith at a representative evening moment for that cycle.
 * Aligning all three categories on a day lights up its star; real
 * constellation lines connect whichever lit stars are canonically joined.
 *
 * Days are binary — a star is lit (3/3) or it isn't there yet. No partial
 * credit, matching the app's own "no partial scores, ever" rule more
 * precisely than the previous comet-for-1-2-wins design did.
 *
 * Past, completed cycles become an archive — "your sky, that month" — since
 * no two people's pattern of which days they showed up will ever match.
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useApp } from '../context/AppContext'
import { dateKey, getUniverseCycle, UNIVERSE_CYCLE_DAYS } from '../lib/date'
import { getSkyForCycle, type SkyStar } from '../lib/sky'
import type { CategoryKey } from '../types'

const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']

type DaysMap = Record<string, { physical: unknown; mental: unknown; spiritual: unknown } | null>

function getWins(days: DaysMap, dateStr: string): number {
  const entry = days[dateStr]
  if (!entry) return 0
  return CATEGORIES.filter(k => entry[k as CategoryKey] !== null).length
}

// The cycleDays calendar days belonging to a cycle, given its start date.
function getCycleDates(cycleStart: Date, cycleDays: number): Date[] {
  return Array.from({ length: cycleDays }, (_, i) => {
    const d = new Date(cycleStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}
function strHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function formatCycleDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function formatCycleMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
// Whole days between two dates, ignoring time-of-day.
function daysUntil(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0)
  const b = new Date(to); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function formatResetLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Resets today'
  if (daysLeft === 1) return 'Resets tomorrow'
  return `Resets in ${daysLeft} days`
}

// ── Hover tooltip ───────────────────────────────────────────────────────────

type HoverInfo = { x: number; y: number; title: string; subtitle: string; id?: string }

function HoverCard({ x, y, title, subtitle }: HoverInfo) {
  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col gap-0.5 px-3 py-2 rounded-xl"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -122%)',
        background: 'rgba(15,15,26,0.96)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        width: 'max-content',
        maxWidth: '70vw',
      }}
    >
      <span className="font-serif text-sm text-white whitespace-nowrap">{title}</span>
      <span className="font-sans text-[10px] uppercase tracking-widest text-white/50 whitespace-nowrap">{subtitle}</span>
    </div>
  )
}

// ── Projection: sky.ts's zenith-centered polar position -> SVG pixels ──────

const SVG_W = 220
const SVG_H = 200
const PROJECT_RADIUS = 88 // px from panel center to the crop's outer edge

function project(star: SkyStar): [number, number] {
  const r = star.r * PROJECT_RADIUS
  return [SVG_W / 2 + r * Math.sin(star.theta), SVG_H / 2 - r * Math.cos(star.theta)]
}

// Faint decorative sprinkle behind a panel — pure atmosphere, not tied to
// real star data, fixed seed so it doesn't reshuffle on re-render.
function BackgroundStars({ w, h, seed, count }: { w: number; h: number; seed: string; count: number }) {
  const rand = seededRand(strHash(seed))
  const stars = Array.from({ length: count }, () => ({
    x: rand() * w, y: rand() * h,
    r: 0.3 + rand() * 0.5,
    opacity: 0.06 + rand() * 0.18,
  }))
  return (
    <g>
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.opacity} />)}
    </g>
  )
}

// ── A single real star ──────────────────────────────────────────────────────
// Size comes from real magnitude (brighter = bigger), not decoration — a
// star's visual weight always means something real. No planets/moons/
// asteroids here (see CLAUDE.md: that flourish was flagged as decoration
// disconnected from data in the app's own audit).

function magToScale(mag: number): number {
  const t = Math.max(0, Math.min(1, (6 - mag) / 7.5))
  return 0.55 + t * 1.05
}

function RealisticStar({ cx, cy, mag, id, born }: { cx: number; cy: number; mag: number; id: number; born: boolean }) {
  const scale = magToScale(mag)
  const gradId = `glow-${id}`
  const coreId = `glowcore-${id}`
  return (
    <g className={born ? 'star-born' : 'star-full'} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="35%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={14 * scale} fill={`url(#${gradId})`} />
      <circle cx={cx} cy={cy} r={6 * scale} fill={`url(#${coreId})`} />
      <circle cx={cx} cy={cy} r={2.6 * scale} fill="white" />
    </g>
  )
}

// A day's real star, not yet lit — a faint point marking where it is. The
// real sky doesn't wait for you; the star is already there, just not
// claimed yet.
function UnlitPoint({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r={1.4} fill="white" opacity="0.16" />
}

// ── Nova burst (birth flash, unchanged from the previous design) ───────────

function NovaBurst({ cx, cy, onDone }: { cx: number; cy: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <g>
      <circle cx={cx} cy={cy} r={0} fill="white" opacity="0.95">
        <animate attributeName="r" from="0" to="70" dur="0.5s" fill="freeze" />
        <animate attributeName="opacity" from="0.95" to="0" dur="0.5s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#1D9E75" strokeWidth="2">
        <animate attributeName="r" from="0" to="45" dur="0.7s" fill="freeze" />
        <animate attributeName="opacity" from="0.8" to="0" dur="0.7s" fill="freeze" />
      </circle>
      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#7F77DD" strokeWidth="1.5">
        <animate attributeName="r" from="0" to="58" dur="0.85s" fill="freeze" />
        <animate attributeName="opacity" from="0.5" to="0" dur="0.85s" fill="freeze" />
      </circle>
    </g>
  )
}

// A finished cycle doesn't explode away — it settles into the archive. Soft
// inward-drifting light instead of an outward destructive burst: this sky
// is real and kept, not cleared.
function SkySettleTransition({ w, h }: { w: number; h: number }) {
  const cx = w / 2, cy = h / 2
  const [particles] = useState(() => Array.from({ length: 24 }, () => {
    const colors = ['#1D9E75', '#7F77DD', '#D85A30', '#FFFFFF']
    const angle = Math.random() * Math.PI * 2
    const dist = 70 + Math.random() * 60
    return {
      startX: cx + Math.cos(angle) * dist,
      startY: cy + Math.sin(angle) * dist,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 0.8 + Math.random() * 1.6,
    }
  }))
  return (
    <g>
      <circle cx={cx} cy={cy} r={0} fill="white" opacity="0">
        <animate attributeName="r" from="0" to="34" dur="1.6s" fill="freeze" />
        <animate attributeName="opacity" values="0;0.5;0" keyTimes="0;0.5;1" dur="1.6s" fill="freeze" />
      </circle>
      {particles.map((p, i) => (
        <circle key={i} cx={p.startX} cy={p.startY} r={p.size} fill={p.color} opacity="0.8">
          <animate attributeName="cx" to={cx} dur="1.6s" fill="freeze" />
          <animate attributeName="cy" to={cy} dur="1.6s" fill="freeze" />
          <animate attributeName="opacity" from="0.8" to="0" dur="1.6s" fill="freeze" />
        </circle>
      ))}
    </g>
  )
}

// Explains the cycle in the app's own identity/metaphor voice, and — just as
// importantly — reassures the user nothing is actually deleted, since a real
// sky settling away could otherwise read as data loss.
function SkyCycleModal({ cycleEnd, onClose }: { cycleEnd: Date; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 overflow-y-auto"
      style={{ background: 'rgba(5,5,12,0.94)' }}
      onClick={onClose}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center" onClick={e => e.stopPropagation()}>
        <p className="font-sans text-xs uppercase tracking-widest text-white/50">Why this is your real sky</p>
        <p className="font-serif text-base text-white/90 leading-relaxed">
          These are real stars, positioned exactly as they appear above you. Every 30 days you get a new patch of real sky to work with.
        </p>
        <p className="font-serif text-base text-white/90 leading-relaxed">
          A star lights up on a day you show up for all three parts of yourself. Which ones light up is entirely yours — no one else will ever build this same picture.
        </p>
        <p className="font-serif text-base text-white/90 leading-relaxed">
          Nothing is ever lost. When a cycle ends, its sky settles into your archive exactly as you left it, and a new one begins.
        </p>
        <p className="font-sans text-xs text-white/50 mt-1">Next reset: {formatCycleDate(cycleEnd)}</p>
        <button
          onClick={onClose}
          className="mt-2 font-sans text-xs text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── The live (or, mid-transition, settling) cycle sky ───────────────────────

type BornDay = { dateStr: string; cx: number; cy: number }

function CycleSky({
  cycleStart,
  days,
  lat,
  lon,
  seed,
  settling,
}: {
  cycleStart: Date
  days: DaysMap
  lat: number
  lon: number
  seed: string
  settling: boolean
}) {
  const { stars, lines } = getSkyForCycle(lat, lon, cycleStart, UNIVERSE_CYCLE_DAYS, seed)
  const dates = getCycleDates(cycleStart, UNIVERSE_CYCLE_DAYS)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)

  const positions = new Map<number, [number, number]>()
  stars.forEach(s => positions.set(s.id, project(s)))

  const [novaQueue, setNovaQueue] = useState<BornDay[]>([])
  const [activeNova, setActiveNova] = useState<BornDay | null>(null)
  const [seenBorn, setSeenBorn] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('triova-born') ?? '[]')) }
    catch { return new Set() }
  })

  useEffect(() => {
    if (settling) return // don't fire novas while a past cycle is fading out
    const toBorn: BornDay[] = []
    const newSeenBorn = new Set(seenBorn)
    dates.forEach((d, i) => {
      const dk = dateKey(d)
      const star = stars[i]
      if (!star) return
      if (getWins(days, dk) === 3 && !newSeenBorn.has(dk)) {
        const pos = positions.get(star.id)
        if (pos) { toBorn.push({ dateStr: dk, cx: pos[0], cy: pos[1] }); newSeenBorn.add(dk) }
      }
    })
    if (toBorn.length > 0) {
      setSeenBorn(newSeenBorn)
      localStorage.setItem('triova-born', JSON.stringify([...newSeenBorn]))
      setNovaQueue(toBorn)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleStart.getTime(), settling])

  useEffect(() => {
    if (activeNova === null && novaQueue.length > 0) {
      const [next, ...rest] = novaQueue
      setActiveNova(next)
      setNovaQueue(rest)
    }
  }, [activeNova, novaQueue])

  // Lit stars this cycle — also the tappable set for handlePanelTap below.
  const litStarIds = new Set<number>()
  dates.forEach((d, i) => {
    const star = stars[i]
    if (star && getWins(days, dateKey(d)) === 3) litStarIds.add(star.id)
  })

  function handlePanelTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) { setHover(null); return }
    const scale = SVG_W / rect.width
    const tapX = (e.clientX - rect.left) * scale
    const tapY = (e.clientY - rect.top) * scale

    for (const star of stars) {
      if (!litStarIds.has(star.id)) continue
      const [sx, sy] = positions.get(star.id)!
      if (Math.hypot(sx - tapX, sy - tapY) <= 20) {
        setHover(prev => {
          if (prev?.id === String(star.id)) return null
          const title = star.name ?? `A star in ${star.con ?? 'the sky'}`
          const dayIdx = dates.findIndex((_, i) => stars[i]?.id === star.id)
          const subtitle = dayIdx >= 0 ? formatDayLabel(dateKey(dates[dayIdx])) : ''
          return { x: e.clientX - rect.left, y: e.clientY - rect.top, title, subtitle, id: String(star.id) }
        })
        return
      }
    }
    setHover(null)
  }

  return (
    <div className="relative" onClick={handlePanelTap}>
      <div ref={containerRef} className="rounded-2xl overflow-hidden" style={{ background: '#0f0f1a' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ overflow: 'visible' }} aria-hidden="true">
          <BackgroundStars w={SVG_W} h={SVG_H} seed="triova-cyclesky-bg" count={40} />

          <g className={settling ? 'universe-fade-out' : undefined} pointerEvents={settling ? 'none' : undefined}>
            {/* Real constellation lines, only between stars actually lit */}
            {lines.filter(([a, b]) => litStarIds.has(a) && litStarIds.has(b)).map(([a, b]) => {
              const [x1, y1] = positions.get(a)!
              const [x2, y2] = positions.get(b)!
              return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.5" opacity="0.18" />
            })}

            {stars.map(star => {
              const [cx, cy] = positions.get(star.id)!
              if (!litStarIds.has(star.id)) return <UnlitPoint key={star.id} cx={cx} cy={cy} />
              return <RealisticStar key={star.id} cx={cx} cy={cy} mag={star.mag} id={star.id} born={false} />
            })}
          </g>

          {settling && <SkySettleTransition w={SVG_W} h={SVG_H} />}

          {activeNova && (
            <NovaBurst key={`nova-${activeNova.dateStr}`} cx={activeNova.cx} cy={activeNova.cy}
              onDone={() => setActiveNova(null)} />
          )}
        </svg>
      </div>
      {hover && <HoverCard {...hover} />}
    </div>
  )
}

// ── Archive: one independent thumbnail per completed cycle ─────────────────

function ArchiveThumb({
  cycleStart, days, lat, lon, seed, onOpen,
}: {
  cycleStart: Date
  days: DaysMap
  lat: number
  lon: number
  seed: string
  onOpen: () => void
}) {
  const { stars, lines } = getSkyForCycle(lat, lon, cycleStart, UNIVERSE_CYCLE_DAYS, seed)
  const dates = getCycleDates(cycleStart, UNIVERSE_CYCLE_DAYS)
  const positions = new Map<number, [number, number]>()
  stars.forEach(s => positions.set(s.id, project(s)))
  const litStarIds = new Set<number>()
  dates.forEach((d, i) => {
    const star = stars[i]
    if (star && getWins(days, dateKey(d)) === 3) litStarIds.add(star.id)
  })
  const litCount = litStarIds.size

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-1.5 text-left rounded-2xl p-2 transition-colors hover:bg-white/[0.03]"
    >
      <div className="rounded-xl overflow-hidden" style={{ background: '#0f0f1a' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" aria-hidden="true">
          {lines.filter(([a, b]) => litStarIds.has(a) && litStarIds.has(b)).map(([a, b]) => {
            const [x1, y1] = positions.get(a)!
            const [x2, y2] = positions.get(b)!
            return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.5" opacity="0.18" />
          })}
          {stars.map(star => {
            const [cx, cy] = positions.get(star.id)!
            if (!litStarIds.has(star.id)) return <UnlitPoint key={star.id} cx={cx} cy={cy} />
            return <RealisticStar key={star.id} cx={cx} cy={cy} mag={star.mag} id={star.id + 100000} born={false} />
          })}
        </svg>
      </div>
      <p className="font-sans text-xs text-white/50 text-center">
        {formatCycleMonth(cycleStart)} · {litCount}/{UNIVERSE_CYCLE_DAYS}
      </p>
    </button>
  )
}

function ExpandedSkyModal({
  cycleStart, days, lat, lon, seed, onClose,
}: {
  cycleStart: Date
  days: DaysMap
  lat: number
  lon: number
  seed: string
  onClose: () => void
}) {
  // Same stacking-context reasoning as the rest of this screen's overlays —
  // the page-transition wrapper's transform makes it the containing block
  // for position:fixed descendants, so this has to portal straight to body.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 overflow-y-auto"
      style={{ background: 'rgba(5,5,12,0.94)' }}
      onClick={onClose}
    >
      <div className="w-full max-w-md lg:max-w-xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-xs uppercase tracking-widest text-white/50">Your sky</p>
            <h2 className="font-serif text-xl lg:text-2xl text-white">{formatCycleMonth(cycleStart)}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 font-sans text-xs lg:text-sm text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
          >
            Back
          </button>
        </div>
        <CycleSky cycleStart={cycleStart} days={days} lat={lat} lon={lon} seed={seed} settling={false} />
      </div>
    </div>,
    document.body
  )
}

// ── Main screen ──────────────────────────────────────────────────────────

function LocationPrompt() {
  return (
    <div className="min-h-screen max-w-md mx-auto px-6 pt-16 flex flex-col items-center text-center gap-4"
      style={{ background: '#0f0f1a' }}>
      <p className="font-sans text-xs uppercase tracking-widest text-white/50">Triova</p>
      <h1 className="font-serif text-2xl text-white">One more thing</h1>
      <p className="font-sans text-sm text-white/50 leading-relaxed max-w-xs">
        Your Triova is built from the real night sky above you. Set your location in Settings to see it.
      </p>
      <Link to="/settings" className="mt-2 font-sans text-sm text-white underline underline-offset-4">
        Go to Settings
      </Link>
    </div>
  )
}

export default function Score() {
  const { data, session } = useApp()
  const accountCreated = session ? new Date(session.user.created_at) : new Date()
  const location = data.onboarding.location
  const [expandedCycle, setExpandedCycle] = useState<Date | null>(null)

  const cycle = getUniverseCycle(accountCreated, new Date())
  const seed = session?.user.id ?? 'anon'
  const [showCycleInfo, setShowCycleInfo] = useState(false)

  const [seenCycle, setSeenCycle] = useState<number | null>(() => {
    const raw = localStorage.getItem('triova-universe-cycle-seen')
    return raw === null ? null : Number(raw)
  })
  const [settling, setSettling] = useState(() => seenCycle !== null && seenCycle < cycle.index)

  useEffect(() => {
    if (seenCycle === null) {
      localStorage.setItem('triova-universe-cycle-seen', String(cycle.index))
      setSeenCycle(cycle.index)
      return
    }
    if (seenCycle < cycle.index) {
      const t = setTimeout(() => {
        localStorage.setItem('triova-universe-cycle-seen', String(cycle.index))
        setSeenCycle(cycle.index)
        setSettling(false)
      }, 1800)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!location) return <LocationPrompt />

  const daysLeft = daysUntil(new Date(), cycle.end)
  const displayedCycleStart = settling
    ? new Date(cycle.start.getTime() - UNIVERSE_CYCLE_DAYS * 86400000)
    : cycle.start

  // Completed cycles only (current, still-forming one is the live panel).
  const archiveCycles: Date[] = []
  for (let i = 0; i < cycle.index; i++) {
    archiveCycles.push(new Date(accountCreated.getTime() + i * UNIVERSE_CYCLE_DAYS * 86400000))
  }
  archiveCycles.reverse() // most recent first

  return (
    <div className="min-h-screen max-w-md lg:max-w-6xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-10"
      style={{ background: '#0f0f1a' }}>

      {showCycleInfo && <SkyCycleModal cycleEnd={cycle.end} onClose={() => setShowCycleInfo(false)} />}
      {expandedCycle && (
        <ExpandedSkyModal
          cycleStart={expandedCycle} days={data.days} lat={location.lat} lon={location.lon} seed={seed}
          onClose={() => setExpandedCycle(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest font-semibold text-white/50">Triova</p>
        <h1 className="font-serif font-semibold text-2xl lg:text-4xl text-white">Your Sky</h1>
        <p className="font-sans text-xs text-white/50 leading-relaxed mt-1">
          Real stars, above {location.name}. Every aligned day claims one.
        </p>
      </div>

      <div className="flex flex-col gap-10 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-stretch">
        {/* Live sky */}
        <div className="flex flex-col gap-3 lg:h-full">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-sans text-xs uppercase tracking-widest font-medium text-white/50">
              This cycle
            </p>
            <button
              onClick={() => setShowCycleInfo(true)}
              className="font-sans text-xs font-medium text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
            >
              {formatResetLabel(daysLeft)}
            </button>
          </div>

          <CycleSky
            cycleStart={displayedCycleStart} days={data.days} lat={location.lat} lon={location.lon}
            seed={seed} settling={settling}
          />

          <div className="hidden lg:block flex-1" />

          <p className="font-serif text-sm text-white/50 italic text-center">
            {settling
              ? 'Your sky is settling into your archive, and a new one is beginning.'
              : 'Each star is real — it lights up the day you align all three practices at once.'}
          </p>
        </div>

        {/* Archive */}
        <div className="flex flex-col gap-3 lg:h-full">
          <p className="font-sans text-xs uppercase tracking-widest font-medium text-white/50">Your archive</p>
          {archiveCycles.length === 0 ? (
            <div className="flex-1 flex items-center justify-center rounded-2xl px-6 py-10 text-center"
              style={{ background: '#0f0f1a' }}>
              <p className="font-sans text-sm text-white/40">Your first finished sky will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {archiveCycles.map(cs => (
                <ArchiveThumb
                  key={cs.getTime()} cycleStart={cs} days={data.days} lat={location.lat} lon={location.lon}
                  seed={seed} onOpen={() => setExpandedCycle(cs)}
                />
              ))}
            </div>
          )}
          <div className="hidden lg:block flex-1" />
          <p className="font-serif text-sm text-white/50 italic text-center">
            One real sky per finished cycle — nobody else will ever build the same one.
          </p>
        </div>
      </div>
    </div>
  )
}
