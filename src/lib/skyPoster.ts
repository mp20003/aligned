// Generates a high-resolution, printable PNG of a Triova sky — the actual
// downloadable "poster." Plain Canvas 2D at 2x scale, same dependency-free
// approach History.tsx's share-card export already uses in this codebase.
// Not gated behind anything yet — a future paid unlock is a separate,
// deliberate decision, not baked into the mechanism itself.

import type { SkyStar } from './sky'

const W = 1600
const H = 2000
const SCALE = 2 // -> 3200x4000 output, print resolution

export type PosterInput = {
  stars: SkyStar[]
  lines: [number, number][]
  litStarIds: Set<number>
  locationName: string
  conName: string | null
  monthLabel: string
  litCount: number
  totalDays: number
}

function project(star: SkyStar, radiusPx: number, cx: number, cy: number): [number, number] {
  const r = star.r * radiusPx
  return [cx + r * Math.sin(star.theta), cy - r * Math.cos(star.theta)]
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
function magToRadius(mag: number): number {
  const t = Math.max(0, Math.min(1, (6 - mag) / 7.5))
  return 2.2 + t * 5.8
}
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const DUST_COLORS = ['#1D9E75', '#7F77DD', '#D85A30', '#6FA8FF']

export async function generateSkyPoster(input: PosterInput): Promise<string> {
  // Canvas text doesn't wait for async web-font loading on its own — by the
  // time someone clicks "download" the fonts have almost always already
  // loaded for the page itself, but this is cheap insurance against a
  // first-paint edge case.
  if (document.fonts?.ready) await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)

  const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
  bgGrad.addColorStop(0, '#0a0a14')
  bgGrad.addColorStop(1, '#13111f')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  const cx = W / 2
  const skyR = (W - 180) / 2
  const skyCy = 460 + skyR

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '600 15px Inter, system-ui, sans-serif'
  ctx.fillText('TRIOVA · YOUR SKY', cx, 130)

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '600 54px Lora, Georgia, serif'
  ctx.fillText(input.locationName, cx, 200)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 18px Inter, system-ui, sans-serif'
  const subtitle = [
    input.conName ? `Near ${input.conName}` : null,
    input.monthLabel,
    `${input.litCount} of ${input.totalDays} nights`,
  ].filter(Boolean).join('   ·   ')
  ctx.fillText(subtitle, cx, 245)

  // ── Sky, clipped to a circle — the most honest frame for this data,
  // since the projection is already zenith-centered (r=0 at center, r=1
  // at the crop's true edge), not an arbitrary square crop. ──
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, skyCy, skyR, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#0d0c18'
  ctx.fillRect(cx - skyR, skyCy - skyR, skyR * 2, skyR * 2)

  const rand = seededRand(strHash('sky-poster-dust'))
  for (let i = 0; i < 4; i++) {
    const bx = cx - skyR + rand() * skyR * 2
    const by = skyCy - skyR + rand() * skyR * 2
    const br = 100 + rand() * 150
    const color = DUST_COLORS[Math.floor(rand() * DUST_COLORS.length)]
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br)
    grad.addColorStop(0, hexToRgba(color, 0.1))
    grad.addColorStop(1, hexToRgba(color, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 150; i++) {
    const sx = cx - skyR + rand() * skyR * 2
    const sy = skyCy - skyR + rand() * skyR * 2
    ctx.fillStyle = hexToRgba(DUST_COLORS[Math.floor(rand() * DUST_COLORS.length)], 0.1 + rand() * 0.14)
    ctx.beginPath()
    ctx.arc(sx, sy, 0.8 + rand() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 100; i++) {
    const sx = cx - skyR + rand() * skyR * 2
    const sy = skyCy - skyR + rand() * skyR * 2
    ctx.fillStyle = `rgba(255,255,255,${0.08 + rand() * 0.18})`
    ctx.beginPath()
    ctx.arc(sx, sy, 0.6 + rand() * 1, 0, Math.PI * 2)
    ctx.fill()
  }

  const positions = new Map<number, [number, number]>()
  input.stars.forEach(s => positions.set(s.id, project(s, skyR * 0.86, cx, skyCy)))

  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1.4
  for (const [a, b] of input.lines) {
    if (!input.litStarIds.has(a) || !input.litStarIds.has(b)) continue
    const [x1, y1] = positions.get(a)!
    const [x2, y2] = positions.get(b)!
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  for (const star of input.stars) {
    const [sx, sy] = positions.get(star.id)!
    if (!input.litStarIds.has(star.id)) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)'
      ctx.beginPath()
      ctx.arc(sx, sy, 2.2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    const r = magToRadius(star.mag)
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5)
    glow.addColorStop(0, hexToRgba(star.color, 0.55))
    glow.addColorStop(1, hexToRgba(star.color, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(sx, sy, r * 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = star.color
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, skyCy, skyR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, skyCy, skyR + 10, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '400 15px Inter, system-ui, sans-serif'
  ctx.fillText('triova.app', cx, H - 60)

  return canvas.toDataURL('image/png')
}
