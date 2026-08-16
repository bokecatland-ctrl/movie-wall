import { useEffect, useMemo, useRef, useState } from 'react'
import { buildShelves, sortEntries, SORTS } from '../lib/layout-shelf.js'
import Spine from './Spine.jsx'

const MILESTONES = [50, 100, 250, 500, 1000, 2000]

export default function Shelf({ entries, sort, onSortChange, selectedId, onSelect, justAddedId }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const baseHeight = width < 620 ? 132 : 192

  // 段ごとの累計本数も一緒に出しておく。棚を下に追うだけで増え方が読める
  const numbered = useMemo(() => {
    if (!width) return []
    const shelves = buildShelves(sortEntries(entries, sort), width - 24, baseHeight)
    let running = 0
    return shelves.map((s) => {
      const from = running + 1
      running += s.items.length
      return {
        ...s,
        total: running,
        milestone: MILESTONES.find((m) => m >= from && m <= running),
      }
    })
  }, [entries, sort, width, baseHeight])

  return (
    <div className="shelf-view">
      <div className="sortbar">
        {SORTS.map((s) => (
          <button
            key={s.id}
            className={`chip${sort === s.id ? ' chip--on' : ''}`}
            onClick={() => onSortChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="shelves" ref={ref}>
        {numbered.map((shelf, i) => (
          <div className="shelf" key={i} style={{ '--h': `${baseHeight}px` }}>
            <div className="shelf__books">
              {shelf.items.map((it) => (
                <Spine
                  key={it.entry.id}
                  entry={it.entry}
                  width={it.width}
                  x={it.x}
                  height={it.height}
                  // 右端の本をそのまま開くと表紙が画面外に出るので、左に開かせる
                  flip={it.x + it.height * (2 / 3) > width - 24}
                  selected={selectedId === it.entry.id}
                  justAdded={justAddedId === it.entry.id}
                  onSelect={onSelect}
                />
              ))}
            </div>

            <div className="shelf__plank">
              {shelf.total > 0 && (
                <span className={`plate${shelf.milestone ? ' plate--brass' : ''}`}>
                  {shelf.milestone ?? shelf.total}
                </span>
              )}
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="empty">
            The shelf is empty. Tap <strong>+</strong> below to add your first one.
          </p>
        )}
      </div>
    </div>
  )
}
