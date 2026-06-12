// Generates public/apple-touch-icon.png — pure Node.js, no dependencies
// Run: node scripts/generate-icon.js
import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

const SIZE = 180

// ── Pixel buffer ──────────────────────────────────────────────────────────────

const buf = Buffer.alloc(SIZE * SIZE * 4)

const BEIGE   = [245, 240, 232, 255]
const GREEN   = [ 29, 158, 117, 255]
const PURPLE  = [127, 119, 221, 255]
const CORAL   = [216,  90,  48, 255]

const cx = SIZE / 2, cy = SIZE / 2
const outerR = SIZE * 0.44
const innerR = SIZE * 0.24

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx, dy = y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const idx = (y * SIZE + x) * 4

    let color
    if (dist > outerR || dist < innerR) {
      color = BEIGE
    } else {
      // angle from 12 o'clock, clockwise
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90
      if (angle < 0) angle += 360
      color = angle < 120 ? GREEN : angle < 240 ? PURPLE : CORAL
    }

    buf[idx]     = color[0]
    buf[idx + 1] = color[1]
    buf[idx + 2] = color[2]
    buf[idx + 3] = color[3]
  }
}

// ── PNG encoder ───────────────────────────────────────────────────────────────

function crc32(data) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xFFFFFFFF
  for (const byte of data) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// Filter bytes + raw scanlines (filter type 0 = None)
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0
  buf.copy(raw, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8  // bit depth
ihdr[9] = 6  // RGBA

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), png)
console.log(`Written: public/apple-touch-icon.png (${png.length} bytes)`)
