// Generates the placeholder app icons in public/ (favicon, PWA and Apple touch icons)
// from one geometry, without dependencies: `node scripts/generate-icons.mjs`.
// Full-bleed square – iOS and Android apply their own mask. The glyph stays inside the
// maskable safe zone (circle with 40 % radius around the center).
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BACKGROUND = [0x2f, 0x5b, 0xd3] // --color-accent
const FOREGROUND = [0xff, 0xff, 0xff]

// Rounded rectangles in a 512 × 512 grid: a "T".
const SHAPES = [
  { x: 136, y: 144, w: 240, h: 56, r: 28 },
  { x: 228, y: 144, w: 56, h: 232, r: 28 },
]

const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('')

function svg() {
  const rects = SHAPES.map(
    (s) => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}"/>`,
  ).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="112" fill="${hex(BACKGROUND)}"/>` +
    `<g fill="${hex(FOREGROUND)}">${rects}</g></svg>\n`
  )
}

function inside(px, py) {
  return SHAPES.some(({ x, y, w, h, r }) => {
    const cx = Math.min(Math.max(px, x + r), x + w - r)
    const cy = Math.min(Math.max(py, y + r), y + h - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r && px >= x && px <= x + w && py >= y && py <= y + h
  })
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const SAMPLES = 4 // supersampling per axis for anti-aliasing
  const scale = 512 / size
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          if (inside((x + (sx + 0.5) / SAMPLES) * scale, (y + (sy + 0.5) / SAMPLES) * scale)) hits++
        }
      }
      const t = hits / SAMPLES ** 2
      for (let c = 0; c < 3; c++) {
        raw[row + 1 + x * 3 + c] = Math.round(BACKGROUND[c] + (FOREGROUND[c] - BACKGROUND[c]) * t)
      }
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = new URL('../public/', import.meta.url)
writeFileSync(new URL('favicon.svg', out), svg())
writeFileSync(new URL('apple-touch-icon.png', out), png(180))
writeFileSync(new URL('icon-192.png', out), png(192))
writeFileSync(new URL('icon-512.png', out), png(512))
