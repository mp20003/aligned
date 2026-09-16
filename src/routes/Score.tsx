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
import { generateSkyPoster } from '../lib/skyPoster'
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

// Standard IAU 3-letter constellation abbreviations, as used in the star
// catalog's `con` field — full names for display.
const CON_NAMES: Record<string, string> = {
  And: 'Andromeda', Ant: 'Antlia', Aps: 'Apus', Aqr: 'Aquarius', Aql: 'Aquila',
  Ara: 'Ara', Ari: 'Aries', Aur: 'Auriga', Boo: 'Boötes', Cae: 'Caelum',
  Cam: 'Camelopardalis', Cnc: 'Cancer', CVn: 'Canes Venatici', CMa: 'Canis Major',
  CMi: 'Canis Minor', Cap: 'Capricornus', Car: 'Carina', Cas: 'Cassiopeia',
  Cen: 'Centaurus', Cep: 'Cepheus', Cet: 'Cetus', Cha: 'Chamaeleon', Cir: 'Circinus',
  Col: 'Columba', Com: 'Coma Berenices', CrA: 'Corona Australis', CrB: 'Corona Borealis',
  Crv: 'Corvus', Crt: 'Crater', Cru: 'Crux', Cyg: 'Cygnus', Del: 'Delphinus',
  Dor: 'Dorado', Dra: 'Draco', Equ: 'Equuleus', Eri: 'Eridanus', For: 'Fornax',
  Gem: 'Gemini', Gru: 'Grus', Her: 'Hercules', Hor: 'Horologium', Hya: 'Hydra',
  Hyi: 'Hydrus', Ind: 'Indus', Lac: 'Lacerta', Leo: 'Leo', LMi: 'Leo Minor',
  Lep: 'Lepus', Lib: 'Libra', Lup: 'Lupus', Lyn: 'Lynx', Lyr: 'Lyra', Men: 'Mensa',
  Mic: 'Microscopium', Mon: 'Monoceros', Mus: 'Musca', Nor: 'Norma', Oct: 'Octans',
  Oph: 'Ophiuchus', Ori: 'Orion', Pav: 'Pavo', Peg: 'Pegasus', Per: 'Perseus',
  Phe: 'Phoenix', Pic: 'Pictor', Psc: 'Pisces', PsA: 'Piscis Austrinus', Pup: 'Puppis',
  Pyx: 'Pyxis', Ret: 'Reticulum', Sge: 'Sagitta', Sgr: 'Sagittarius', Sco: 'Scorpius',
  Scl: 'Sculptor', Sct: 'Scutum', Ser: 'Serpens', Sex: 'Sextans', Tau: 'Taurus',
  Tel: 'Telescopium', Tri: 'Triangulum', TrA: 'Triangulum Australe', Tuc: 'Tucana',
  UMa: 'Ursa Major', UMi: 'Ursa Minor', Vel: 'Vela', Vir: 'Virgo', Vol: 'Volans',
  Vul: 'Vulpecula',
}

// The constellation most of this cycle's crop falls within — used to tell
// the user roughly what they're looking at, not just an abstract star field.
function dominantConstellation(stars: SkyStar[]): string | null {
  const counts = new Map<string, number>()
  for (const s of stars) {
    if (!s.con) continue
    counts.set(s.con, (counts.get(s.con) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [con, count] of counts) {
    if (count > bestCount) { best = con; bestCount = count }
  }
  return best ? (CON_NAMES[best] ?? best) : null
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

// Soft colored dust — nebula blobs plus fine coloured specks, using the
// app's own category palette (plus a couple of neutral space tones) so the
// live sky reads as richer without inventing meaning that isn't there —
// pure atmosphere, fixed seed, doesn't reshuffle on re-render.
const DUST_COLORS = ['#1D9E75', '#7F77DD', '#D85A30', '#6FA8FF'] as const

function DustField({ w, h, seed }: { w: number; h: number; seed: string }) {
  const rand = seededRand(strHash(seed))
  const blobs = Array.from({ length: 4 }, () => ({
    cx: rand() * w, cy: rand() * h,
    r: 30 + rand() * 45,
    color: DUST_COLORS[Math.floor(rand() * DUST_COLORS.length)],
    opacity: 0.05 + rand() * 0.07,
  }))
  const specks = Array.from({ length: 70 }, () => ({
    x: rand() * w, y: rand() * h,
    r: 0.4 + rand() * 0.9,
    color: DUST_COLORS[Math.floor(rand() * DUST_COLORS.length)],
    opacity: 0.08 + rand() * 0.16,
  }))
  return (
    <g>
      <defs>
        {blobs.map((b, i) => (
          <radialGradient key={i} id={`dust-blob-${seed}-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={b.color} stopOpacity={b.opacity} />
            <stop offset="100%" stopColor={b.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {blobs.map((b, i) => <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#dust-blob-${seed}-${i})`} />)}
      {specks.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.color} opacity={s.opacity} />)}
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

// Twinkle timing varies per star (seeded by id) — a field of stars that all
// pulse in lockstep reads as artificial; staggered durations/delays read as
// alive. Set via inline style (which wins over the shared CSS class's
// shorthand `animation`) so star-twinkle's keyframes still apply.
function twinkleStyle(id: number): React.CSSProperties {
  const rand = seededRand(id)
  const duration = 2.6 + rand() * 2.8 // 2.6s - 5.4s
  const delay = -rand() * duration // negative delay = starts partway in, so nothing looks freshly-reset on mount
  return { animationDuration: `${duration}s`, animationDelay: `${delay}s` }
}

function RealisticStar({ cx, cy, mag, color, id, born }: { cx: number; cy: number; mag: number; color: string; id: number; born: boolean }) {
  const scale = magToScale(mag)
  const gradId = `glow-${id}`
  const coreId = `glowcore-${id}`
  return (
    <g
      className={born ? 'star-born' : 'star-full'}
      style={born ? { transformOrigin: `${cx}px ${cy}px` } : { transformOrigin: `${cx}px ${cy}px`, ...twinkleStyle(id) }}
    >
      <defs>
        {/* Real per-star color (from the catalog's B-V index) shows in the
            halo — the core stays white-hot regardless of a star's tint,
            same as how a red giant still looks bright-white at its center
            to the naked eye; the color only reads in the glow around it. */}
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="40%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
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
function SkyCycleModal({
  cycleEnd, cycleStart, locationName, conName, onClose,
}: {
  cycleEnd: Date
  cycleStart: Date
  locationName: string
  conName: string | null
  onClose: () => void
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 overflow-y-auto"
      style={{ background: 'rgba(5,5,12,0.94)' }}
      onClick={onClose}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center" onClick={e => e.stopPropagation()}>
        <p className="font-sans text-xs uppercase tracking-widest text-white/50">Why this is your real sky</p>
        <p className="font-serif text-base text-white/90 leading-relaxed">
          This is the real sky above {locationName} this cycle{conName ? `, near ${conName}` : ''} — {formatCycleMonth(cycleStart)}. Every 30 days you get a new patch of real sky to work with.
        </p>
        <p className="font-serif text-base text-white/90 leading-relaxed">
          A star lights up on a day you show up for all three parts of yourself. Which ones light up is entirely yours — your location and your own pattern of showing up mean no one else will ever build this exact picture.
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
  locationName,
}: {
  cycleStart: Date
  days: DaysMap
  lat: number
  lon: number
  seed: string
  settling: boolean
  locationName: string
}) {
  const { stars, lines } = getSkyForCycle(lat, lon, cycleStart, UNIVERSE_CYCLE_DAYS, seed)
  const dates = getCycleDates(cycleStart, UNIVERSE_CYCLE_DAYS)
  const containerRef = useRef<HTMLDivElement>(null)
  const downloadRef = useRef<HTMLAnchorElement>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [downloading, setDownloading] = useState(false)

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

  async function handleDownload() {
    setDownloading(true)
    try {
      const dataUrl = await generateSkyPoster({
        stars, lines, litStarIds,
        locationName,
        conName: dominantConstellation(stars),
        monthLabel: formatCycleMonth(cycleStart),
        litCount: litStarIds.size,
        totalDays: UNIVERSE_CYCLE_DAYS,
      })
      const a = downloadRef.current!
      a.href = dataUrl
      a.download = `triova-sky-${dateKey(cycleStart)}.png`
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
    <div className="relative" onClick={handlePanelTap}>
      <div ref={containerRef} className="rounded-2xl overflow-hidden" style={{ background: '#0f0f1a' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ overflow: 'visible' }} aria-hidden="true">
          <DustField w={SVG_W} h={SVG_H} seed="triova-cyclesky-dust" />
          <BackgroundStars w={SVG_W} h={SVG_H} seed="triova-cyclesky-bg" count={40} />

          <g className={settling ? 'universe-fade-out' : undefined} pointerEvents={settling ? 'none' : undefined}>
            {/* Real constellation lines, only between stars actually lit */}
            {lines.filter(([a, b]) => litStarIds.has(a) && litStarIds.has(b)).map(([a, b]) => {
              const [x1, y1] = positions.get(a)!
              const [x2, y2] = positions.get(b)!
              return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.8" opacity="0.35" />
            })}

            {stars.map(star => {
              const [cx, cy] = positions.get(star.id)!
              if (!litStarIds.has(star.id)) return <UnlitPoint key={star.id} cx={cx} cy={cy} />
              return <RealisticStar key={star.id} cx={cx} cy={cy} mag={star.mag} color={star.color} id={star.id} born={false} />
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
    {!settling && (
      <>
        <a ref={downloadRef} className="hidden" aria-hidden="true">download</a>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="self-center font-sans text-xs text-white/50 hover:text-white/80 transition-colors underline underline-offset-4 disabled:opacity-50"
        >
          {downloading ? 'Preparing…' : 'Download poster'}
        </button>
      </>
    )}
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
            return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.8" opacity="0.35" />
          })}
          {stars.map(star => {
            const [cx, cy] = positions.get(star.id)!
            if (!litStarIds.has(star.id)) return <UnlitPoint key={star.id} cx={cx} cy={cy} />
            return <RealisticStar key={star.id} cx={cx} cy={cy} mag={star.mag} color={star.color} id={star.id + 100000} born={false} />
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
  cycleStart, days, lat, lon, seed, locationName, onClose,
}: {
  cycleStart: Date
  days: DaysMap
  lat: number
  lon: number
  seed: string
  locationName: string
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
        <CycleSky cycleStart={cycleStart} days={days} lat={lat} lon={lon} seed={seed} settling={false} locationName={locationName} />
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
  const [showArchive, setShowArchive] = useState(false)

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

  // Just for the "what am I looking at" caption below — CycleSky computes
  // its own copy of this internally for rendering.
  const { stars: displayedStars } = getSkyForCycle(location.lat, location.lon, displayedCycleStart, UNIVERSE_CYCLE_DAYS, seed)
  const conName = dominantConstellation(displayedStars)
  const displayedLitCount = settling ? 0 : getCycleDates(displayedCycleStart, UNIVERSE_CYCLE_DAYS)
    .filter(d => getWins(data.days, dateKey(d)) === 3).length

  return (
    <div className="min-h-screen max-w-md lg:max-w-6xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-10"
      style={{ background: '#0f0f1a' }}>

      {showCycleInfo && (
        <SkyCycleModal
          cycleEnd={cycle.end} cycleStart={displayedCycleStart} locationName={location.name} conName={conName}
          onClose={() => setShowCycleInfo(false)}
        />
      )}
      {expandedCycle && (
        <ExpandedSkyModal
          cycleStart={expandedCycle} days={data.days} lat={location.lat} lon={location.lon} seed={seed}
          locationName={location.name}
          onClose={() => setExpandedCycle(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest font-semibold text-white/50">Triova</p>
        <h1 className="font-serif font-semibold text-2xl lg:text-4xl text-white">Your Sky</h1>
        <p className="font-sans text-xs text-white/50 leading-relaxed mt-1">
          {settling
            ? `Real stars, above ${location.name}. Every aligned day claims one.`
            : `You've shown up ${displayedLitCount} of ${UNIVERSE_CYCLE_DAYS} days this cycle — that's ${displayedLitCount} real star${displayedLitCount === 1 ? '' : 's'}, and no one else's.`}
        </p>
      </div>

      {/* Live sky — full width, so the archive doesn't compete for space
          until someone actually asks to see it. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-xs uppercase tracking-widest font-medium text-white/50">
            This cycle
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCycleInfo(true)}
              className="font-sans text-xs font-medium text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
            >
              {formatResetLabel(daysLeft)}
            </button>
            <button
              onClick={() => setShowArchive(v => !v)}
              className="font-sans text-xs font-medium text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
            >
              {showArchive ? 'Hide archive' : 'Archive'}
            </button>
          </div>
        </div>

        <CycleSky
          cycleStart={displayedCycleStart} days={data.days} lat={location.lat} lon={location.lon}
          seed={seed} settling={settling} locationName={location.name}
        />

        <p className="font-sans text-xs text-white/50 text-center">
          {conName ? `Near ${conName}` : 'A patch of real sky'} · {formatCycleMonth(displayedCycleStart)}
        </p>

        <p className="font-serif text-sm text-white/50 italic text-center">
          {settling
            ? 'Your sky is settling into your archive, and a new one is beginning.'
            : 'Each star is real — it lights up the day you align all three practices at once. Nobody else will ever build this exact picture.'}
        </p>
      </div>

      {/* Archive — collapsed until asked for */}
      {showArchive && (
        <div className="flex flex-col gap-3">
          <p className="font-sans text-xs uppercase tracking-widest font-medium text-white/50">Your archive</p>
          {archiveCycles.length === 0 ? (
            <div className="flex items-center justify-center rounded-2xl px-6 py-10 text-center"
              style={{ background: '#0f0f1a' }}>
              <p className="font-sans text-sm text-white/40">Your first finished sky will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {archiveCycles.map(cs => (
                <ArchiveThumb
                  key={cs.getTime()} cycleStart={cs} days={data.days} lat={location.lat} lon={location.lon}
                  seed={seed} onOpen={() => setExpandedCycle(cs)}
                />
              ))}
            </div>
          )}
          <p className="font-serif text-sm text-white/50 italic text-center">
            One real sky per finished cycle — nobody else will ever build the same one.
          </p>
        </div>
      )}
    </div>
  )
}
