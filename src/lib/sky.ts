// Real-sky astronomy for the Triova screen. Converts the bundled star
// catalog (src/data/stars.json, filtered from the HYG database — see
// CLAUDE.md for provenance/license) into "which real stars are near zenith,
// for this user's location, at this cycle's reference moment" — the fixed
// canvas a cycle's days get assigned onto in Score.tsx.
//
// All angles in degrees unless a name says otherwise. Standard planetarium
// math (Local Sidereal Time + equatorial-to-horizontal transform), the same
// approach any star-chart app uses — no external astronomy library needed.

import starsRaw from '../data/stars.json'
import constellationLinesRaw from '../data/constellationLines.json'

export type CatalogStar = {
  id: number
  name: string | null
  ra: number // hours, catalog convention (0-24)
  dec: number // degrees
  mag: number
  con: string | null
}

const STARS = starsRaw as CatalogStar[]
const LINES = constellationLinesRaw as [number, number][]
const STAR_BY_ID = new Map(STARS.map(s => [s.id, s]))

// A star's assigned position/brightness within one cycle's fixed sky crop.
// `r`/`theta` are a normalized zenith-centered polar position — r is 0 at
// zenith, 1 at the crop's outer edge; theta is radians, 0 = "up". Score.tsx
// multiplies r by its own pixel radius, keeping this module UI-agnostic.
export type SkyStar = {
  id: number
  name: string | null
  mag: number
  con: string | null
  r: number
  theta: number
}

// ---- Time / coordinate math ----

function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

// Greenwich Mean Sidereal Time, in degrees. Standard IAU formula.
function gmstDegrees(jd: number): number {
  const T = (jd - 2451545.0) / 36525
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000
  gmst %= 360
  if (gmst < 0) gmst += 360
  return gmst
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

// Converts a catalog star's fixed equatorial position (RA/Dec) to this
// moment's local horizontal position (altitude/azimuth) for an observer at
// latDeg/lonDeg. lstDeg is the Local Sidereal Time at that moment (degrees).
function raDecToAltAz(raHours: number, decDeg: number, latDeg: number, lstDeg: number): { alt: number; az: number } {
  const raDeg = raHours * 15
  const hourAngleDeg = lstDeg - raDeg
  const H = toRad(hourAngleDeg)
  const dec = toRad(decDeg)
  const lat = toRad(latDeg)

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H)
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)))

  // atan2 form avoids the quadrant ambiguity of the acos-based formula.
  // Azimuth convention (from South, westward) is internal only — never
  // shown to the user, so the exact compass reference doesn't matter as
  // long as it's applied consistently for the zenith-centered projection.
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat))

  return { alt: toDeg(alt), az: toDeg(az) }
}

// Approximates local solar time from longitude alone (15° ≈ 1 hour), since
// we only ever collect lat/lon, not a full timezone. Accurate to within
// roughly half an hour, ignoring DST/political timezone boundaries — fine
// for choosing a representative evening sky, not meant to be exact.
function referenceMoment(cycleStart: Date, lonDeg: number): Date {
  const localHour = 21 // 9pm "local" reference
  const utcHour = localHour - lonDeg / 15
  const d = new Date(Date.UTC(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate()))
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCMinutes(Math.round(utcHour * 60))
  return d
}

// Simple string hash for the user-id tiebreak (same approach already used
// throughout Score.tsx for seeded pseudo-randomness).
function strHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

const CROP_RADIUS_DEG = 40 // angular radius from zenith kept in the crop

// The core entry point: given a user's location, a cycle's start date, and
// how many days are in the cycle, returns the fixed set of real stars
// (brightest `cycleDays` stars near zenith at the reference moment) and
// which of them are connected by a known constellation line.
export function getSkyForCycle(
  lat: number,
  lon: number,
  cycleStart: Date,
  cycleDays: number,
  tiebreakSeed: string
): { stars: SkyStar[]; lines: [number, number][] } {
  const moment = referenceMoment(cycleStart, lon)
  const jd = julianDate(moment)
  const lst = (gmstDegrees(jd) + lon) % 360

  // A small per-user angular nudge to the crop center, so two users at the
  // same location/time don't land on the exact same crop boundary — still a
  // genuinely visible-and-valid patch of real sky, just which one shifts.
  const nudge = (strHash(tiebreakSeed) % 1000) / 1000 // 0..1
  const nudgeAz = nudge * 20 - 10 // +/-10 degrees

  const withAltAz = STARS.map(s => {
    const { alt, az } = raDecToAltAz(s.ra, s.dec, lat, lst)
    return { star: s, alt, az: az - nudgeAz }
  }).filter(({ alt }) => alt > 0)

  const inCrop = withAltAz.filter(({ alt }) => 90 - alt <= CROP_RADIUS_DEG)
  inCrop.sort((a, b) => a.star.mag - b.star.mag)
  const selected = inCrop.slice(0, cycleDays)
  const selectedIds = new Set(selected.map(s => s.star.id))

  const stars: SkyStar[] = selected.map(({ star, alt, az }) => ({
    id: star.id,
    name: star.name,
    mag: star.mag,
    con: star.con,
    r: (90 - alt) / CROP_RADIUS_DEG,
    theta: toRad(az),
  }))

  const lines = LINES.filter(([a, b]) => selectedIds.has(a) && selectedIds.has(b))

  return { stars, lines }
}

export function getStarById(id: number): CatalogStar | undefined {
  return STAR_BY_ID.get(id)
}
