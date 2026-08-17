import { seeded } from './layout-shelf.js'

const TAU = Math.PI * 2

/**
 * 文字列 → 0..1。ジャンル名から角度を決めるのに使う。
 * ジャンルの一覧から順番に割り振るとダメで、新しいジャンルの作品を1本足した
 * だけで空全体が回ってしまう。名前そのものから決めれば絶対に動かない。
 */
function hash01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/** そのジャンルが担当する「基準の方角」。コンパス表示にも同じ値を使う */
export function genreAngle(genre) {
  return hash01(genre) * TAU
}

const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']

/**
 * 角度を8方位の矢印に丸める。
 * SVGはy軸が下向きなので、angle=0が→、増えるほど時計回りに回る。
 */
export function genreArrow(genre) {
  const a = ((genreAngle(genre) % TAU) + TAU) % TAU
  return ARROWS[Math.round(a / (TAU / 8)) % 8]
}

/**
 * 星の位置。
 *   角度 = ジャンル（同じジャンルが空の同じ方角に集まる）
 *   距離 = 公開年（古い映画ほど遠く、宇宙の奥にある）
 * どちらも作品から決まるので、いつ見ても同じ映画は同じ場所にいる。
 * これが無いと星図は「ただの散布図」になって記憶に残らない。
 */
export function starPosition(entry) {
  const genre = entry.genres?.[0] ?? 'Other'
  const j1 = seeded(entry.tmdbId)
  const j2 = seeded(entry.tmdbId * 7 + 13)

  // 同じジャンルの作品が1本の細い線に固まって見えないよう、角度のばらつきを広めに取る
  const angle = genreAngle(genre) + (j1 - 0.5) * 1.3

  const year = entry.releaseYear ?? 2000
  const yearsAgo = Math.max(0, 2030 - year)
  // 実際に観る映画は直近10〜20年に偏りやすく、単純な線形距離だと
  // ほとんどの星が中心付近の狭い範囲に押し込まれて窮屈になる。
  // 手前側（最近の作品）を伸ばす曲線をかけて、直近の年代でも十分な間隔が出るようにする。
  const depthLinear = Math.min(1, yearsAgo / 70)
  const depth = Math.pow(depthLinear, 0.62)
  const radius = 190 + depth * 900 + (j2 - 0.5) * 130

  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

/**
 * ★の高さで色温度を変える。実際の恒星と同じ発想——
 * 低評価は赤色巨星のような暖色、高評価は青色巨星のような高温色。
 * 全部白い点だと「安っぽい」ので、これだけでだいぶ表情が出る。
 */
function starColor(t) {
  const stops = [
    [0, [255, 173, 122]],
    [0.5, [255, 244, 219]],
    [1, [196, 219, 255]],
  ]
  let a = stops[0]
  let b = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i]
      b = stops[i + 1]
      break
    }
  }
  const span = b[0] - a[0] || 1
  const k = (t - a[0]) / span
  const [r, g, bl] = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * k))
  return `rgb(${r},${g},${bl})`
}

/** ★がそのまま明るさ・大きさ・色になる。観た本数ではなく「良かった本数」が空を明るくする */
export function starLook(rating) {
  const r = rating ?? 2.5
  const t = r / 5
  return {
    radius: 1.7 + r * 1.5,
    opacity: 0.55 + t * 0.45,
    flare: r >= 4.5,
    color: starColor(t),
    haloId: t < 0.35 ? 'halo-warm' : t < 0.7 ? 'halo-neutral' : 'halo-cool',
  }
}

export function buildStars(entries) {
  return entries.map((entry) => ({
    entry,
    ...starPosition(entry),
    // 回折スパイクが全部同じ向きだと機械的に見えるので、星ごとに少し回す
    spin: seeded(entry.tmdbId * 3 + 1) * 360,
  }))
}

// ── 背景の恒星（データと無関係の書き割り） ──────────────

function mulberry32(seed) {
  let s = seed
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 観た映画とは無関係の、ただの遠景の星。
 * 星図の空白を埋めるためだけのもので、乱数のシードは固定——
 * 毎回違う星が生えたら「同じ夜空」に見えなくなる。
 */
export function buildFieldStars(count = 420, spread = 2600) {
  const rand = mulberry32(20240817)
  const stars = []
  for (let i = 0; i < count; i++) {
    const bright = rand() < 0.08
    stars.push({
      x: (rand() - 0.5) * spread * 2,
      y: (rand() - 0.5) * spread * 2,
      r: bright ? 1.5 + rand() * 1.3 : 0.35 + rand() * 0.85,
      o: 0.12 + rand() * (bright ? 0.55 : 0.4),
      twinkle: bright && rand() < 0.6,
      delay: rand() * 6,
      dur: 2.6 + rand() * 3.2,
    })
  }
  return stars
}

// ── 星座 ──────────────────────────────────────────────

const SURNAME_PARTICLES = new Set(['del', 'de', 'van', 'von', 'da', 'di', 'la', 'le'])

/** 「Guillermo del Toro」→「del Toro」のように、実際の姓を拾う */
function surname(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  let i = parts.length - 1
  while (i > 0 && SURNAME_PARTICLES.has(parts[i - 1].toLowerCase())) i--
  return parts.slice(i).join(' ')
}

/**
 * 同じ監督の作品を近い順に繋いだ折れ線＝星座。
 * 3本以上で成立させる。2本だとただの線分にしか見えず、名前を付ける意味がない。
 */
export function buildConstellations(stars) {
  const groups = new Map()
  for (const s of stars) {
    const name = s.entry.director
    if (!name) continue
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(s)
  }

  const out = []
  for (const [name, members] of groups) {
    if (members.length < 3) continue

    // 最近傍を辿って一筆書きにする。総当たりの最短経路は要らない——
    // 星座は「それらしく繋がって見える」ことだけが目的なので貪欲で十分。
    const rest = members.slice(1)
    const chain = [members[0]]
    while (rest.length) {
      const last = chain[chain.length - 1]
      let bi = 0
      let bd = Infinity
      rest.forEach((s, i) => {
        const d = (s.x - last.x) ** 2 + (s.y - last.y) ** 2
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      chain.push(rest.splice(bi, 1)[0])
    }

    const cx = chain.reduce((s, p) => s + p.x, 0) / chain.length
    const cy = chain.reduce((s, p) => s + p.y, 0) / chain.length

    out.push({
      name,
      shortLabel: surname(name),
      ids: new Set(chain.map((s) => s.entry.id)),
      points: chain.map((s) => [s.x, s.y]),
      label: { x: cx, y: cy },
      count: chain.length,
    })
  }
  return out.sort((a, b) => b.count - a.count)
}

/** 星が全部入る初期表示のスケールと位置 */
export function fitView(stars, width, height) {
  if (!stars.length || !width || !height) return { k: 0.5, tx: width / 2, ty: height / 2 }

  const xs = stars.map((s) => s.x)
  const ys = stars.map((s) => s.y)
  const pad = 120
  const minX = Math.min(...xs) - pad
  const maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad
  const maxY = Math.max(...ys) + pad

  const k = Math.min(width / (maxX - minX), height / (maxY - minY), 1.6)
  return {
    k,
    tx: width / 2 - ((minX + maxX) / 2) * k,
    ty: height / 2 - ((minY + maxY) / 2) * k,
  }
}
