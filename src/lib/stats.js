export function summarize(entries) {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = now.toLocaleDateString('sv-SE').slice(0, 7)

  const minutes = entries.reduce((s, e) => s + (e.runtime ?? 0), 0)
  const rated = entries.filter((e) => e.rating != null)

  return {
    count: entries.length,
    minutes,
    thisYear: entries.filter((e) => e.watchedOn?.startsWith(year)).length,
    thisMonth: entries.filter((e) => e.watchedOn?.startsWith(month)).length,
    lastYear: entries.filter((e) => e.watchedOn?.startsWith(String(now.getFullYear() - 1))).length,
    avg: rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : null,
    directors: entries.filter((e) => e.director).length,
  }
}

/** 「23d 4h」。本数より、こちらの方が積み上がった実感が出る */
export function formatDuration(minutes) {
  if (!minutes) return '0h'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
}

/** 監督ごとの本数。多い順 */
export function byDirector(entries) {
  const map = new Map()
  for (const e of entries) {
    if (!e.director) continue
    const cur = map.get(e.director) ?? { name: e.director, items: [] }
    cur.items.push(e)
    map.set(e.director, cur)
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length)
}
