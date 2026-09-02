/**
 * Triova — Star Universe
 *
 * Each aligned day (3 wins) fires a supernova and births a realistic star.
 * 1-2 wins: a comet flies in and rests. Missed past days explode and leave dust.
 * Future / today-not-yet: nothing rendered.
 *
 * Universe panel: symbolic clusters — one per week, brightness = aligned days.
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { dateKey } from '../lib/date'
import type { CategoryKey } from '../types'

const CATEGORIES: CategoryKey[] = ['physical', 'mental', 'spiritual']

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  physical:  '#1D9E75',
  mental:    '#7F77DD',
  spiritual: '#D85A30',
}

// ── Date helpers ───────────────────────────────────────────────────────────────

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

type DaysMap = Record<string, { physical: unknown; mental: unknown; spiritual: unknown } | null>

// Single source of truth for "which days in this week are aligned/partial/dead" —
// shared by the This Week header count, the constellation, and the universe cluster
// so the numbers can never drift apart from each other.
function getAlignedDates(week: Date[], days: DaysMap): Date[] {
  // Today counts as soon as it's fully aligned — no need to wait until it's "over"
  return week.filter(d => !isFuture(d) && getWins(days, dateKey(d)) === 3)
}

function getPartialDates(week: Date[], days: DaysMap): Date[] {
  return week.filter(d => {
    if (isFuture(d) || isToday(d)) return false
    const w = getWins(days, dateKey(d))
    return w > 0 && w < 3
  })
}

function getDeadDates(week: Date[], days: DaysMap): Date[] {
  return week.filter(d => {
    if (isFuture(d) || isToday(d)) return false
    const dk = dateKey(d)
    return getWins(days, dk) === 0 && days[dk] !== undefined
  })
}

function formatWeekRange(week: Date[]): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${week[0].toLocaleDateString('en-US', opts)} – ${week[6].toLocaleDateString('en-US', opts)}`
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Procedural space names (seeded per date / week) ────────────────────────────

const STAR_NAME_PARTS = [
  'Vantor', 'Kepler', 'Astra', 'Lyrae', 'Corvid', 'Thessia', 'Nyxara', 'Caelum',
  'Solari', 'Helion', 'Draconis', 'Vela', 'Orinth', 'Lumen', 'Sabrix', 'Halvern',
  'Ekaris', 'Novara', 'Ithal', 'Quorin', 'Perael', 'Sundrel', 'Wrenna', 'Talvos',
]

function getStarName(dateStr: string): string {
  const rand = seededRand(strHash(dateStr + 'starname'))
  const part = STAR_NAME_PARTS[Math.floor(rand() * STAR_NAME_PARTS.length)]
  const num = 100 + Math.floor(rand() * 900)
  return `${part}-${num}`
}

const PLANET_LETTERS = ['b', 'c', 'd']

function getPlanetNames(dateStr: string, count: number): string[] {
  const star = getStarName(dateStr)
  return PLANET_LETTERS.slice(0, count).map(letter => `${star} ${letter}`)
}

const CLUSTER_ADJ = [
  'Ember', 'Halcyon', 'Wandering', 'Silent', 'Gilded', 'Hollow', 'Drifting',
  'Faded', 'Velvet', 'Amber', 'Frozen', 'Distant', 'Quiet', 'Luminous', 'Restless',
]
const CLUSTER_NOUN = [
  'Expanse', 'Drift', 'Cluster', 'Nebula', 'Reach', 'Veil', 'Basin', 'Field',
  'Belt', 'Hollow', 'Current', 'Span', 'Deep', 'Cradle', 'Wake',
]

function getClusterName(mondayStr: string): string {
  const rand = seededRand(strHash(mondayStr + 'clustername'))
  const adj = CLUSTER_ADJ[Math.floor(rand() * CLUSTER_ADJ.length)]
  const noun = CLUSTER_NOUN[Math.floor(rand() * CLUSTER_NOUN.length)]
  return `${adj} ${noun}`
}

// ── Hover tooltip (custom-styled, matches app aesthetic) ───────────────────────

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
      }}
    >
      <span className="font-serif text-sm text-white whitespace-nowrap">{title}</span>
      <span className="font-sans text-[10px] uppercase tracking-widest text-white/35 whitespace-nowrap">{subtitle}</span>
    </div>
  )
}

// ── Star positions ─────────────────────────────────────────────────────────────
// This-week panel: zoomed-in viewBox so stars render large with full detail.
// Universe clusters: same relative positions, scaled down to CLUSTER_R.

const SVG_W = 220
const SVG_H = 200

function getStarPositions(mondayStr: string): [number, number][] {
  const rand = seededRand(strHash(mondayStr))
  const padding = 32
  const positions: [number, number][] = []
  let attempts = 0
  while (positions.length < 7 && attempts < 300) {
    attempts++
    const x = padding + rand() * (SVG_W - padding * 2)
    const y = padding + rand() * (SVG_H - padding * 2)
    const tooClose = positions.some(([px, py]) => {
      const dx = px - x, dy = py - y
      return Math.sqrt(dx * dx + dy * dy) < 44
    })
    if (!tooClose) positions.push([x, y])
  }
  while (positions.length < 7) {
    positions.push([padding + rand() * (SVG_W - padding * 2), padding + rand() * (SVG_H - padding * 2)])
  }
  return positions
}

// ── Star type (seeded per date) ────────────────────────────────────────────────
// Each type still has its own glow/spike shape, but always exactly one bright
// core point — no type renders more than one "dot" for a single star.

type StarType = 'diffraction' | 'giant'

function getStarType(dateStr: string): StarType {
  const rand = seededRand(strHash(dateStr + 'type'))
  return rand() < 0.5 ? 'diffraction' : 'giant'
}

// A star can have 0–3 planets, weighted toward fewer.
function getPlanetCount(dateStr: string): number {
  const rand = seededRand(strHash(dateStr + 'planetcount'))
  const r = rand()
  if (r < 0.45) return 0
  if (r < 0.75) return 1
  if (r < 0.93) return 2
  return 3
}

function getPlanetColor(dateStr: string, idx: number): string {
  const rand = seededRand(strHash(dateStr + 'pcolor' + idx))
  const keys = Object.keys(CATEGORY_COLORS) as CategoryKey[]
  return CATEGORY_COLORS[keys[Math.floor(rand() * keys.length)]]
}

function getPlanetAngle(dateStr: string, idx: number): number {
  const rand = seededRand(strHash(dateStr + 'pangle' + idx))
  return rand() * Math.PI * 2
}

// Distance for planet idx (unscaled — multiply by the star's own scale at
// render time). Spaced further apart than a single fixed increment so
// orbits read as clearly separate rings.
function getPlanetDistance(idx: number): number {
  return 16 + idx * 14
}

// Kepler-ish: period grows with distance^1.5, so an outer planet visibly
// crawls while an inner one zips around — a little organic jitter keeps it
// from feeling like a formula.
function getOrbitDuration(dateStr: string, idx: number): number {
  const rand = seededRand(strHash(dateStr + 'orbitdur' + idx))
  const refDist = getPlanetDistance(0)
  const basePeriod = 6
  const period = basePeriod * Math.pow(getPlanetDistance(idx) / refDist, 1.5)
  const jitter = 0.85 + rand() * 0.3 // ±15%
  return period * jitter
}

// Each planet has its own chance of a small moon orbiting it.
function getHasMoon(dateStr: string, idx: number): boolean {
  const rand = seededRand(strHash(dateStr + 'moon' + idx))
  return rand() < 0.35
}

function getMoonAngle(dateStr: string, idx: number): number {
  const rand = seededRand(strHash(dateStr + 'moonangle' + idx))
  return rand() * Math.PI * 2
}

function getMoonOrbitDuration(dateStr: string, idx: number): number {
  const rand = seededRand(strHash(dateStr + 'moondur' + idx))
  return 2.5 + rand() * 2.5 // 2.5–5s — visibly faster than its planet's own orbit
}

// Every star has its own scale, so the field reads less uniform.
function getStarScale(dateStr: string): number {
  const rand = seededRand(strHash(dateStr + 'scale'))
  return 0.8 + rand() * 0.6 // 0.8–1.4
}

// Every star gets 1–2 small asteroids on a slow, distant orbit.
function getAsteroidCount(dateStr: string): number {
  const rand = seededRand(strHash(dateStr + 'astcount'))
  return rand() < 0.6 ? 1 : 2
}

function getAsteroidAngle(dateStr: string, idx: number): number {
  const rand = seededRand(strHash(dateStr + 'astangle' + idx))
  return rand() * Math.PI * 2
}

function getAsteroidOrbitDuration(dateStr: string, idx: number): number {
  const rand = seededRand(strHash(dateStr + 'astdur' + idx))
  return 22 + rand() * 18 // 22–40s — much slower than any planet
}

function getAsteroidSize(dateStr: string, idx: number): number {
  const rand = seededRand(strHash(dateStr + 'astsize' + idx))
  return 0.9 + rand() * 0.8
}

// ── Star colour (seeded per date) ──────────────────────────────────────────────

const STAR_COLORS = ['#FFA94D', '#FF6B5E', '#6FA8FF', '#FFFFFF'] as const

function getStarColor(dateStr: string): string {
  const rand = seededRand(strHash(dateStr + 'starcolor'))
  return STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)]
}

// ── Realistic star SVG ─────────────────────────────────────────────────────────

function RealisticStar({ cx, cy, type, dateStr, born }: {
  cx: number; cy: number; type: StarType; dateStr: string; born: boolean
}) {
  const planetCount = getPlanetCount(dateStr)
  const color = getStarColor(dateStr)
  const scale = getStarScale(dateStr)
  const asteroidCount = getAsteroidCount(dateStr)

  const id = `glow-${dateStr.replace(/-/g, '')}`
  const id2 = `glow2-${dateStr.replace(/-/g, '')}`

  const starClass = born ? 'star-born' : 'star-full'

  return (
    <g className={starClass} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="35%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id2} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {type === 'diffraction' && (
        <>
          <circle cx={cx} cy={cy} r={36 * scale} fill={`url(#${id})`} />
          <line x1={cx - 44 * scale} y1={cy} x2={cx + 44 * scale} y2={cy} stroke="white" strokeWidth="0.8" opacity="0.35" />
          <line x1={cx} y1={cy - 44 * scale} x2={cx} y2={cy + 44 * scale} stroke="white" strokeWidth="0.8" opacity="0.35" />
          <line x1={cx - 28 * scale} y1={cy - 28 * scale} x2={cx + 28 * scale} y2={cy + 28 * scale} stroke="white" strokeWidth="0.5" opacity="0.18" />
          <line x1={cx + 28 * scale} y1={cy - 28 * scale} x2={cx - 28 * scale} y2={cy + 28 * scale} stroke="white" strokeWidth="0.5" opacity="0.18" />
          <circle cx={cx} cy={cy} r={8 * scale} fill={`url(#${id2})`} />
          <circle cx={cx} cy={cy} r={4 * scale} fill="white" />
        </>
      )}

      {type === 'giant' && (
        <>
          <circle cx={cx} cy={cy} r={44 * scale} fill={`url(#${id})`} />
          <circle cx={cx} cy={cy} r={16 * scale} fill="white" opacity="0.18" />
          <circle cx={cx} cy={cy} r={9 * scale} fill={`url(#${id2})`} />
          <circle cx={cx} cy={cy} r={5 * scale} fill="white" />
        </>
      )}

      {/* Planets — small orbiting orbs, clearly smaller than the star, each on its own ring */}
      {Array.from({ length: planetCount }, (_, idx) => {
        const planetColor = getPlanetColor(dateStr, idx)
        const planetAngleDeg = (getPlanetAngle(dateStr, idx) * 180) / Math.PI
        const planetDist = getPlanetDistance(idx) * scale
        const orbitDuration = getOrbitDuration(dateStr, idx)
        const px = cx + planetDist
        const py = cy
        const hasMoon = getHasMoon(dateStr, idx)
        const moonAngleDeg = (getMoonAngle(dateStr, idx) * 180) / Math.PI
        const moonDuration = getMoonOrbitDuration(dateStr, idx)
        return (
          <g key={idx}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`${planetAngleDeg} ${cx} ${cy}`}
              to={`${planetAngleDeg + 360} ${cx} ${cy}`}
              dur={`${orbitDuration}s`}
              repeatCount="indefinite"
            />
            <circle cx={px} cy={py} r={6} fill={planetColor} opacity="0.12" />
            <circle cx={px} cy={py} r={3} fill={planetColor} opacity="0.9" />
            <circle cx={px - 0.8} cy={py - 0.8} r={1.1} fill="white" opacity="0.4" />
            {hasMoon && (
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${moonAngleDeg} ${px} ${py}`}
                  to={`${moonAngleDeg + 360} ${px} ${py}`}
                  dur={`${moonDuration}s`}
                  repeatCount="indefinite"
                />
                <circle cx={px + 4.5} cy={py} r={1} fill="white" opacity="0.55" />
              </g>
            )}
          </g>
        )
      })}

      {/* Asteroids — every star gets at least one, drifting on a slow, distant orbit,
          each dragging a short fading dust trail behind its direction of travel */}
      {Array.from({ length: asteroidCount }, (_, idx) => {
        const angleDeg = (getAsteroidAngle(dateStr, idx) * 180) / Math.PI
        const dist = (72 + idx * 16) * scale
        const duration = getAsteroidOrbitDuration(dateStr, idx)
        const size = getAsteroidSize(dateStr, idx)
        const ax = cx + dist
        const ay = cy
        return (
          <g key={`ast${idx}`}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`${angleDeg} ${cx} ${cy}`}
              to={`${angleDeg + 360} ${cx} ${cy}`}
              dur={`${duration}s`}
              repeatCount="indefinite"
            />
            {[3, 2, 1].map(step => {
              const rad = (-step * 3.5 * Math.PI) / 180
              const tx = cx + dist * Math.cos(rad)
              const ty = cy + dist * Math.sin(rad)
              return (
                <circle key={step} cx={tx} cy={ty}
                  r={Math.max(size * (0.7 - step * 0.15), 0.15)}
                  fill="#9C9284" opacity={Math.max(0.32 - step * 0.09, 0.04)} />
              )
            })}
            <circle cx={ax} cy={ay} r={size} fill="#9C9284" opacity="0.55" />
          </g>
        )
      })}
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

// Faint far-field star sprinkles behind the This Week constellation — fixed
// seed (not date-based), pure atmosphere so it doesn't reshuffle week to week.
function WeekBackgroundStars() {
  const rand = seededRand(strHash('triova-thisweek-bg-stars'))
  const stars = Array.from({ length: 45 }, () => ({
    x: rand() * SVG_W,
    y: rand() * SVG_H,
    r: 0.3 + rand() * 0.5,
    opacity: 0.08 + rand() * 0.22,
  }))
  return (
    <g>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.opacity} />
      ))}
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)

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
      if (isFuture(d)) return
      const dk = dateKey(d)
      const wins = getWins(days, dk)
      const [cx, cy] = positions[i]
      const dayInProgress = isToday(d) && wins < 3 // today doesn't "fail" until it's over

      if (!dayInProgress && wins === 0 && !dusts.has(dk)) {
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

  // Constellation lines between full stars (today included once it's aligned)
  // Also doubles as the list of tappable stars — see handlePanelTap below.
  const fullStarIndices: number[] = []
  week.forEach((d, i) => {
    if (isFuture(d)) return
    const dk = dateKey(d)
    if (getWins(days, dk) === 3 && !dusts.has(dk) && !isExplodingSet.has(dk)) {
      fullStarIndices.push(i)
    }
  })

  // Single tap handler for the whole panel: finds the nearest rendered star (by
  // simple distance, in viewBox space) instead of relying on tiny per-star SVG
  // hit targets, which are unreliable on some mobile browsers — especially
  // layered under a continuously-animated (twinkling) group.
  function handlePanelTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) { setHover(null); return }
    const scale = SVG_W / rect.width
    const tapX = (e.clientX - rect.left) * scale
    const tapY = (e.clientY - rect.top) * scale

    for (const i of fullStarIndices) {
      const [sx, sy] = positions[i]
      if (Math.hypot(sx - tapX, sy - tapY) <= 26) {
        const dk = dateKey(week[i])
        setHover(prev => {
          if (prev?.id === dk) return null // tap again to dismiss
          const planetNames = getPlanetNames(dk, getPlanetCount(dk))
          const title = `${getStarName(dk)}${planetNames.length ? ` · ${planetNames.join(', ')}` : ''}`
          return { x: e.clientX - rect.left, y: e.clientY - rect.top, title, subtitle: formatDayLabel(dk), id: dk }
        })
        return
      }
    }
    setHover(null)
  }

  return (
    <div className="relative" onClick={handlePanelTap}>
      <div ref={containerRef} className="rounded-2xl overflow-hidden" style={{ background: '#0d0d1e' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ overflow: 'visible' }}>
          <WeekBackgroundStars />

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
            const wins = getWins(days, dk)

            if (isFuture(d)) return null
            if (isToday(d) && wins < 3) return null // today shows nothing until it's fully aligned
            if (isExplodingSet.has(dk)) return null

            if (dusts.has(dk)) {
              return <DustRemnant key={dk} cx={cx} cy={cy} dateStr={dk} />
            }

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
      </div>
      {hover && <HoverCard {...hover} />}
    </div>
  )
}

// ── Universe panel ─────────────────────────────────────────────────────────────
// Past weeks only — each week is a small cluster at a seeded position.
// Star positions within each cluster are scaled-down versions of the full
// week's star layout, so each cluster has a unique shape.

const UNI_W = 340
const UNI_H = 280
const CLUSTER_R = 24

// Places every week's cluster center, seeded per-week but nudged apart so no
// two clusters (or their hover hit-areas) ever overlap — a prior version placed
// each independently and could land two clusters on top of each other.
function getClusterCenters(weeks: Date[][], W: number, H: number, padding: number): [number, number][] {
  const minDist = 56
  const positions: [number, number][] = []
  weeks.forEach(week => {
    const mondayStr = dateKey(week[0])
    const rand = seededRand(strHash(mondayStr + 'center'))
    let x = padding, y = padding, attempts = 0
    do {
      x = padding + rand() * (W - padding * 2)
      y = padding + rand() * (H - padding * 2)
      attempts++
    } while (
      attempts < 60 &&
      positions.some(([px, py]) => Math.hypot(px - x, py - y) < minDist)
    )
    positions.push([x, y])
  })
  return positions
}

// Scale a week's full star positions down into a cluster of radius r around cx,cy
function scalePositionsToCluster(
  positions: [number, number][],
  cx: number, cy: number, r: number
): [number, number][] {
  const midX = SVG_W / 2, midY = SVG_H / 2
  const scale = (r * 0.85) / Math.max(SVG_W, SVG_H) * 2
  return positions.map(([x, y]) => [
    cx + (x - midX) * scale,
    cy + (y - midY) * scale,
  ])
}

// Ambient gas + far-field stars filling the empty space between clusters.
// Fixed seed (not date-based) — this is pure atmosphere, not tied to any
// day's data, so it should stay put rather than reshuffle with new weeks.
const NEBULA_COLORS = ['#7F77DD', '#1D9E75', '#D85A30', '#6FA8FF'] as const

function NebulaField() {
  const rand = seededRand(strHash('triova-universe-nebula'))
  const blobs = Array.from({ length: 5 }, () => ({
    cx: rand() * UNI_W,
    cy: rand() * UNI_H,
    r: 40 + rand() * 55,
    color: NEBULA_COLORS[Math.floor(rand() * NEBULA_COLORS.length)],
    opacity: 0.05 + rand() * 0.06,
  }))
  const farStars = Array.from({ length: 36 }, () => ({
    x: rand() * UNI_W,
    y: rand() * UNI_H,
    r: 0.3 + rand() * 0.5,
    opacity: 0.12 + rand() * 0.28,
  }))

  return (
    <g>
      <defs>
        {blobs.map((b, i) => (
          <radialGradient key={i} id={`nebula-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={b.color} stopOpacity={b.opacity} />
            <stop offset="100%" stopColor={b.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {blobs.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#nebula-${i})`} />
      ))}
      {farStars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.opacity} />
      ))}
    </g>
  )
}

function UniversePanel({
  weeks,
  days,
  onSelectWeek,
}: {
  weeks: Date[][]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown } | null>
  onSelectWeek: (week: Date[]) => void
}) {
  const padding = 36
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const centers = getClusterCenters(weeks, UNI_W, UNI_H, padding)

  function handleClusterHover(e: React.MouseEvent, mondayStr: string, week: Date[]) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setHover({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      title: getClusterName(mondayStr),
      subtitle: formatWeekRange(week),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-xs uppercase tracking-widest text-white/25">Your universe</p>
      <div className="relative">
        <div ref={containerRef} className="rounded-2xl overflow-hidden" style={{ background: '#0a0a14' }}>
          <svg viewBox={`0 0 ${UNI_W} ${UNI_H}`} className="w-full">
          <NebulaField />
          {weeks.map((week, wi) => {
            const isCurrent = wi === weeks.length - 1
            const mondayStr = dateKey(week[0])
            const [cx, cy] = centers[wi]

            // Use scaled-down positions for cluster shape variety
            const fullPositions = getStarPositions(mondayStr)
            const clusterPositions = scalePositionsToCluster(fullPositions, cx, cy, CLUSTER_R)

            const alignedDays = getAlignedDates(week, days)
            const partialDays = getPartialDates(week, days)
            const deadDays = getDeadDates(week, days)

            if (alignedDays.length === 0 && partialDays.length === 0 && deadDays.length === 0) {
              return <g key={wi} />
            }

            return (
              <g key={wi}>
                {/* Invisible hit area, sized to stay clear of neighbouring clusters (min spacing 56).
                    Click/tap opens the full-size view — works on both desktop and mobile,
                    unlike the hover-only tooltip. */}
                <circle
                  cx={cx} cy={cy} r={CLUSTER_R} fill="transparent" pointerEvents="all"
                  style={{ cursor: 'pointer', touchAction: 'manipulation' }}
                  onMouseEnter={(e) => handleClusterHover(e, mondayStr, week)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelectWeek(week)}
                />
                {/* Soft glow ring for current week — marks where it's forming */}
                {isCurrent && (
                  <circle cx={cx} cy={cy} r={CLUSTER_R + 5}
                    fill="none" stroke="rgba(127,119,221,0.18)" strokeWidth="1" strokeDasharray="2 4" />
                )}
                {/* Bright stars — aligned days: exactly one dot per day */}
                {alignedDays.map((d, di) => {
                  const idx = week.indexOf(d)
                  const [sx, sy] = clusterPositions[idx]
                  return <circle key={`a${di}`} cx={sx} cy={sy} r={1.8} fill="white" opacity="0.9" />
                })}
                {/* Dim dots — partial days */}
                {partialDays.map((d, di) => {
                  const idx = week.indexOf(d)
                  const [sx, sy] = clusterPositions[idx]
                  return <circle key={`p${di}`} cx={sx} cy={sy} r={1} fill="white" opacity="0.2" />
                })}
                {/* Dead stars — fully missed days (dust specks) */}
                {deadDays.map((d, di) => {
                  const idx = week.indexOf(d)
                  const [sx, sy] = clusterPositions[idx]
                  return <circle key={`d${di}`} cx={sx} cy={sy} r={1.2} fill="#D85A30" opacity="0.35" />
                })}
              </g>
            )
          })}
          </svg>
        </div>
        {hover && <HoverCard {...hover} />}
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

// Full-size overlay for a week selected from the Universe panel — sits on
// top of the This Week page, dismissed with the close button.
function ExpandedWeekModal({
  week,
  days,
  onClose,
}: {
  week: Date[]
  days: Record<string, { physical: unknown; mental: unknown; spiritual: unknown } | null>
  onClose: () => void
}) {
  const mondayStr = dateKey(week[0])
  // Rendered via a portal straight to <body>: the page-transition wrapper that
  // hosts every route applies a persistent `transform` (translateY) after its
  // enter animation finishes, and per the CSS spec that makes it the
  // containing block for any `position: fixed` descendant — trapping a plain
  // fixed overlay behind the (also fixed) nav bar instead of above it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 overflow-y-auto"
      style={{ background: 'rgba(5,5,12,0.94)' }}
      onClick={onClose}
    >
      <div className="w-full max-w-md lg:max-w-xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-xs uppercase tracking-widest text-white/35">{getClusterName(mondayStr)}</p>
            <h2 className="font-serif text-xl lg:text-2xl text-white">{formatWeekRange(week)}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 font-sans text-xs lg:text-sm text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
          >
            Back to this week
          </button>
        </div>
        <WeekConstellation week={week} days={days} />
      </div>
    </div>,
    document.body
  )
}

export default function Pulse() {
  const { data } = useApp()
  const week = getCurrentWeek()
  const allWeeks = getAllWeeks(data.days)
  const todayStr = dateKey(new Date())
  const todayWins = getWins(data.days, todayStr)
  const weekAligned = getAlignedDates(week, data.days).length
  const elapsed = week.filter(d => !isFuture(d) && !isToday(d)).length
  const [expandedWeek, setExpandedWeek] = useState<Date[] | null>(null)

  return (
    <div className="min-h-screen max-w-md lg:max-w-2xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-28 flex flex-col gap-10"
      style={{ background: '#0a0a14' }}>

      {expandedWeek && (
        <ExpandedWeekModal week={expandedWeek} days={data.days} onClose={() => setExpandedWeek(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs uppercase tracking-widest text-white/25">Triova</p>
        <h1 className="font-serif text-2xl lg:text-4xl text-white">Your Triova</h1>
        <p className="font-sans text-xs text-white/30 leading-relaxed mt-1">
          Every win you log fires a supernova. Every star you birth is yours to keep.
        </p>
      </div>

      {/* This week */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-xs uppercase tracking-widest text-white/25">
            This week · {formatWeekRange(week)}
          </p>
          <p className="font-sans text-xs text-white/25">
            {weekAligned} star{weekAligned !== 1 ? 's' : ''} born · {elapsed} day{elapsed !== 1 ? 's' : ''} elapsed
          </p>
        </div>

        <WeekConstellation week={week} days={data.days} />

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
      <UniversePanel weeks={allWeeks} days={data.days} onSelectWeek={setExpandedWeek} />
    </div>
  )
}
