// アイコンを生成する。棚に並んだ背表紙そのものを図案にしている。
// 画像ライブラリを足したくないので、PNGを直接組み立てる（node標準のzlibだけ使う）。
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [10, 10, 11]
const SPINES = [
  ['#e11d22', 0.62],
  ['#d8cfc0', 0.78],
  ['#2f6f9e', 0.5],
  ['#e8b647', 0.7],
  ['#7a5aa8', 0.58],
]

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

function render(size) {
  const px = Buffer.alloc(size * size * 3)
  for (let i = 0; i < size * size; i++) {
    px[i * 3] = BG[0]
    px[i * 3 + 1] = BG[1]
    px[i * 3 + 2] = BG[2]
  }

  const pad = Math.round(size * 0.14)
  const inner = size - pad * 2
  const gap = Math.max(1, Math.round(size * 0.018))
  const w = Math.floor((inner - gap * (SPINES.length - 1)) / SPINES.length)
  const floorY = size - pad
  const plankH = Math.max(2, Math.round(size * 0.05))

  SPINES.forEach(([color, tall], i) => {
    const [r, g, b] = hex(color)
    const x0 = pad + i * (w + gap)
    const h = Math.round(inner * tall)
    for (let y = floorY - plankH - h; y < floorY - plankH; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        // 左右を落として円筒っぽい陰影を付ける
        const t = (x - x0) / w
        const shade = 0.6 + 0.55 * Math.sin(t * Math.PI)
        const o = (y * size + x) * 3
        px[o] = Math.min(255, r * shade)
        px[o + 1] = Math.min(255, g * shade)
        px[o + 2] = Math.min(255, b * shade)
      }
    }
  })

  // 棚板
  for (let y = floorY - plankH; y < floorY; y++) {
    for (let x = pad - gap; x < size - pad + gap; x++) {
      if (x < 0 || x >= size) continue
      const o = (y * size + x) * 3
      px[o] = 86
      px[o + 1] = 65
      px[o + 2] = 46
    }
  }

  return px
}

function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filter: none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }

  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const cr = Buffer.alloc(4)
    cr.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, cr])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })
for (const size of [192, 512]) {
  const file = new URL(`../public/icons/icon-${size}.png`, import.meta.url)
  writeFileSync(file, png(size, render(size)))
  console.log(`icon-${size}.png`)
}
