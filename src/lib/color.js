import { posterUrl } from './tmdb.js'

/**
 * ポスターから背表紙の地色を1色決める。
 *
 * image.tmdb.org は Access-Control-Allow-Origin: * を返すので
 * crossOrigin="anonymous" で読めばcanvasが汚染されず getImageData できる。
 * （cinema-roadmap の src/lib/image.js で確認済み）
 */

const FALLBACK = '#4a4650'

export function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

export function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const to = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [to(h + 1 / 3), to(h), to(h - 1 / 3)].map((v) => Math.round(v * 255))
}

export const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

export function hexToRgb(hex) {
  const h = (hex ?? '').replace('#', '')
  if (h.length !== 6) return [74, 70, 80]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** 背表紙の上に載せる文字色。地色の明度で白か黒かを決める */
export function textOn(hex) {
  const [r, g, b] = hexToRgb(hex)
  // 知覚輝度（sRGBの雑な近似で十分）
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#14110e' : '#f6f3ee'
}

/** 「色順」で並べるためのキー。無彩色は末尾にまとめる */
export function hueKey(hex) {
  const [h, s] = rgbToHsl(...hexToRgb(hex))
  return s < 0.12 ? 1000 + h : h * 360
}

function loadImageOnce(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('ポスターの読み込みに失敗しました'))
    img.src = src
  })
}

/**
 * TMDBのCDNは瞬間的な取りこぼしがある（実測: 1回失敗しても直後の再試行は通る）。
 * ここで諦めて灰色に倒すと、たまたま失敗しただけの映画がずっと同じ灰色に
 * 固定されてしまうので、少し間を置いて2回までは再試行する。
 * URLにクエリを足すとCDN側の挙動が変わりかねないので、素のURLのまま試す
 * （失敗した画像読み込みはブラウザ側でも基本的にキャッシュされないので、
 * new Image() を作り直すだけで実際にネットワークへ再度取りに行く）。
 */
async function loadImage(src, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await loadImageOnce(src)
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 350 * (i + 1)))
    }
  }
  throw lastErr
}

/** ピクセルを色相24×明度5のバケツに集計する。閾値を変えて2段階で使う */
function collectBuckets(pixels, { lMin, lMax, sMin, weightBySaturation }) {
  const buckets = new Map()
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    if (pixels[i + 3] < 200) continue

    const [h, s, l] = rgbToHsl(r, g, b)
    if (l < lMin || l > lMax) continue
    if (s < sMin) continue

    const key = `${Math.floor(h * 24)}:${Math.floor(l * 5)}`
    const acc = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, w: 0 }
    const weight = weightBySaturation ? 1 + s * 2 : 1
    acc.n += 1
    acc.w += weight
    acc.r += r * weight
    acc.g += g * weight
    acc.b += b * weight
    buckets.set(key, acc)
  }
  return buckets
}

/**
 * 縮小してピクセルを量子化し、最頻色を採る。
 * 黒帯・白フチ・くすんだ背景は「その映画の色」ではないので票から外す。
 */
export async function extractSpineColor(posterPath) {
  if (!posterPath) return FALLBACK

  let img
  try {
    img = await loadImage(posterUrl(posterPath, 'w185'))
  } catch {
    return FALLBACK
  }

  const S = 48
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, S, S)

  let pixels
  try {
    pixels = ctx.getImageData(0, 0, S, S).data
  } catch {
    return FALLBACK
  }

  // 1段階目：「主張している色」を優先して拾う（黒帯・白フチ・ほぼグレーは除外）
  let buckets = collectBuckets(pixels, { lMin: 0.07, lMax: 0.95, sMin: 0.15, weightBySaturation: true })

  // 最近のポスターはティール&オレンジ系など、暗く沈んで彩度も低いグレーディングが
  // 多く、1段階目だと全画素が足切りされて灰色フォールバックに落ちがちだった。
  // その場合だけ彩度の足切りをほぼ外し、純粋な黒白でない画素の中から
  // 一番多い色相を拾う（最終的な彩度は下でどのみち底上げするので、
  // ここでは「わずかでも色味がある方向」さえ拾えれば十分）。
  if (buckets.size === 0) {
    buckets = collectBuckets(pixels, { lMin: 0.04, lMax: 0.97, sMin: 0.03, weightBySaturation: false })
  }

  if (buckets.size === 0) return FALLBACK

  const top = [...buckets.values()].sort((a, b) => b.w - a.w)[0]
  const [h, s, l] = rgbToHsl(top.r / top.w, top.g / top.w, top.b / top.w)

  // 棚に並べたとき隣と喧嘩しないよう、彩度と明度だけ帯に収める。
  // 色相は動かさない（作品の色の記憶がここに乗っているので）。
  const s2 = Math.max(0.28, Math.min(0.72, s))
  const l2 = Math.max(0.26, Math.min(0.62, l))
  return toHex(...hslToRgb(h, s2, l2))
}
