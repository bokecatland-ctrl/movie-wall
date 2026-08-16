import { hueKey } from './color.js'

export const SORTS = [
  { id: 'watched', label: '観た順' },
  { id: 'year', label: '公開年' },
  { id: 'rating', label: '★順' },
  { id: 'director', label: '監督別' },
  { id: 'color', label: '色順' },
]

export const SPINE_GAP = 2

/** 上映時間がそのまま厚みになる。3時間の大作は物理的に太い */
export function spineWidth(runtime) {
  const r = runtime ?? 105
  return Math.round(Math.max(22, Math.min(52, 22 + (r - 90) * 0.35)))
}

/**
 * tmdbId から決まる 0..1 の値。
 * 背の高さのばらつきに使う。ランダムだとリロードのたびに棚が変わって
 * 「同じ棚」に見えなくなるので、必ず作品ごとに固定する。
 */
export function seeded(id) {
  let x = (id ?? 0) * 2654435761
  x = (x ^ (x >>> 15)) >>> 0
  return (x % 1000) / 1000
}

export function spineHeight(entry, base) {
  return Math.round(base * (0.88 + seeded(entry.tmdbId) * 0.22))
}

const byRating = (a, b) => (b.rating ?? 0) - (a.rating ?? 0)

export function sortEntries(entries, sort) {
  const list = entries.slice()
  switch (sort) {
    case 'year':
      return list.sort((a, b) => (a.releaseYear ?? 0) - (b.releaseYear ?? 0) || byRating(a, b))
    case 'rating':
      return list.sort((a, b) => byRating(a, b) || a.title.localeCompare(b.title, 'ja'))
    case 'director':
      return list.sort(
        (a, b) =>
          (a.director || 'ん').localeCompare(b.director || 'ん', 'ja') ||
          (a.releaseYear ?? 0) - (b.releaseYear ?? 0)
      )
    case 'color':
      return list.sort((a, b) => hueKey(a.spineColor) - hueKey(b.spineColor))
    case 'watched':
    default:
      return list.sort(
        (a, b) =>
          a.watchedOn.localeCompare(b.watchedOn) ||
          (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      )
  }
}

/**
 * 幅の累積で段に割る。
 * 最終段は途中までしか埋まっていなくても必ず1段として返す——
 * 「まだ入る空き」が見えていることが、次の1本を観る動機になる。
 */
export function buildShelves(list, shelfWidth, baseHeight) {
  const shelves = []
  let items = []
  let x = 0

  for (const entry of list) {
    const width = spineWidth(entry.runtime)
    if (x + width > shelfWidth && items.length) {
      shelves.push({ items, used: x })
      items = []
      x = 0
    }
    items.push({ entry, width, x, height: spineHeight(entry, baseHeight) })
    x += width + SPINE_GAP
  }

  shelves.push({ items, used: x })
  return shelves
}
