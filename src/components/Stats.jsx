import { useEffect } from 'react'
import { byDirector, formatDuration, summarize } from '../lib/stats.js'

function Bars({ rows, accent }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bars__row" key={r.label}>
          <span className="bars__label">{r.label}</span>
          <span className="bars__track">
            <span
              className="bars__fill"
              style={{ width: `${(r.n / max) * 100}%`, background: accent }}
            />
          </span>
          <span className="bars__n">{r.n}</span>
        </div>
      ))}
    </div>
  )
}

function tally(entries, keyFn) {
  const m = new Map()
  for (const e of entries) {
    for (const k of [].concat(keyFn(e) ?? [])) {
      if (k == null || k === '') continue
      m.set(k, (m.get(k) ?? 0) + 1)
    }
  }
  return m
}

export default function Stats({ entries, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const s = summarize(entries)

  const decades = [...tally(entries, (e) => e.releaseYear && `${Math.floor(e.releaseYear / 10) * 10}年代`)]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => parseInt(a.label) - parseInt(b.label))

  const genres = [...tally(entries, (e) => e.genres)]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)

  const ratings = Array.from({ length: 10 }, (_, i) => {
    const v = (i + 1) / 2
    return { label: `★${v.toFixed(1)}`, n: entries.filter((e) => e.rating === v).length }
  }).reverse()

  const directors = byDirector(entries)
    .slice(0, 8)
    .map((d) => ({ label: d.name, n: d.items.length }))

  const years = [...tally(entries, (e) => e.watchedOn?.slice(0, 4))]
    .map(([label, n]) => ({ label: `${label}年`, n }))
    .sort((a, b) => parseInt(a.label) - parseInt(b.label))

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="統計">
      <div className="sheet__backdrop" onClick={onClose} />
      <div className="sheet__body">
        <div className="sheet__head">
          <h2>これまで</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="stats__top">
          <div>
            <b>{s.count}</b>
            <span>本</span>
          </div>
          <div>
            <b>{formatDuration(s.minutes)}</b>
            <span>積み上げた時間</span>
          </div>
          <div>
            <b>{s.avg ? `★${s.avg.toFixed(2)}` : '—'}</b>
            <span>平均</span>
          </div>
          <div>
            <b>{s.thisMonth}</b>
            <span>今月</span>
          </div>
        </div>

        <div className="stats__grid">
          <section>
            <h3>観た年</h3>
            <Bars rows={years} accent="var(--accent)" />
          </section>
          <section>
            <h3>公開年代</h3>
            <Bars rows={decades} accent="#7f8cc4" />
          </section>
          <section>
            <h3>ジャンル</h3>
            <Bars rows={genres} accent="#5f9e7a" />
          </section>
          <section>
            <h3>評価の分布</h3>
            <Bars rows={ratings} accent="var(--star)" />
          </section>
          <section className="stats__wide">
            <h3>よく観た監督</h3>
            <Bars rows={directors} accent="#b07fbc" />
          </section>
        </div>
      </div>
    </div>
  )
}
