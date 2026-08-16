import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildConstellations,
  buildFieldStars,
  buildStars,
  fitView,
  starLook,
} from '../lib/layout-sky.js'

const MIN_K = 0.15
const MAX_K = 4

/** 中心から両端に向けて滑らかに窄む、回折スパイクの形 */
function spikePath(len, w) {
  return `M0,${-len} Q${w},0 0,${len} Q${-w},0 0,${-len} Z`
}

export default function Sky({ entries, selectedId, onSelect, justAddedId }) {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [tf, setTf] = useState(null)
  const [hovered, setHovered] = useState(null)

  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const moved = useRef(false)

  const stars = useMemo(() => buildStars(entries), [entries])
  const constellations = useMemo(() => buildConstellations(stars), [stars])
  // データと無関係の遠景の星。シード固定なので毎回同じ夜空になる
  const fieldStars = useMemo(() => buildFieldStars(), [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    )
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // 触られるまでは全体が入る位置を毎回算出する（＝星が増えたら勝手に引いて全部見せる）。
  // 一度でもパン/ズームしたら tf が入り、以降は見ている場所を勝手に動かさない。
  const view = useMemo(() => tf ?? fitView(stars, size.w, size.h), [tf, stars, size.w, size.h])

  function zoomAt(cx, cy, factor) {
    setTf((p) => {
      const cur = p ?? view
      const k = Math.max(MIN_K, Math.min(MAX_K, cur.k * factor))
      const r = k / cur.k
      return { k, tx: cx - (cx - cur.tx) * r, ty: cy - (cy - cur.ty) * r }
    })
  }

  function onWheel(e) {
    const rect = ref.current.getBoundingClientRect()
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12)
  }

  function onPointerDown(e) {
    // 先に記録する。setPointerCapture は失敗すると例外を投げるので、
    // 順番を逆にすると以降のパンが丸ごと動かなくなる
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      ref.current.setPointerCapture(e.pointerId)
    } catch {
      // 掴み損ねても、要素の上で動かしている間は追随できる
    }
    moved.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }

  function onPointerMove(e) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = ref.current.getBoundingClientRect()
      zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, dist / pinch.current)
      pinch.current = dist
      moved.current = true
      return
    }

    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true
    setTf((p) => {
      const cur = p ?? view
      return { ...cur, tx: cur.tx + dx, ty: cur.ty + dy }
    })
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const litIds = hovered ? constellations.find((c) => c.name === hovered)?.ids : null

  return (
    <div className="sky-view">
      <div
        className="sky"
        ref={ref}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width="100%" height="100%" role="img" aria-label="観た映画の星図">
          <defs>
            {/* ★の色温度3段。個々の星ごとにグラデーションを持たせると重いので、
                中心の点だけ正確な色にし、まわりのハローはこの3段で近似する */}
            <radialGradient id="halo-warm" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#ffb37a" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#ffb37a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ffb37a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="halo-neutral" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#fff8e8" stopOpacity="0.9" />
              <stop offset="45%" stopColor="#e9ecff" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#e9ecff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="halo-cool" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#dce8ff" stopOpacity="0.9" />
              <stop offset="45%" stopColor="#8fb3ff" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#8fb3ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="spike-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
            <g className="field-stars" aria-hidden="true">
              {fieldStars.map((s, i) => (
                <circle
                  key={i}
                  cx={s.x}
                  cy={s.y}
                  r={s.r}
                  fill="#fff"
                  opacity={s.o}
                  className={s.twinkle ? 'field-star field-star--tw' : 'field-star'}
                  style={
                    s.twinkle
                      ? { '--tw-delay': `${s.delay}s`, '--tw-dur': `${s.dur}s`, '--o': s.o }
                      : undefined
                  }
                />
              ))}
            </g>

            {constellations.map((c) => {
              const on = hovered === c.name
              return (
                <g
                  key={c.name}
                  className={`consto${on ? ' consto--on' : ''}`}
                  onPointerEnter={() => setHovered(c.name)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <polyline
                    points={c.points.map(([x, y]) => `${x},${y}`).join(' ')}
                    fill="none"
                    stroke="var(--sky-line)"
                    strokeWidth={(on ? 1.7 : 1) / view.k}
                    strokeLinejoin="round"
                    strokeDasharray={`${1.5 / view.k} ${3.5 / view.k}`}
                    opacity={on ? 1 : 0.5}
                  />
                  <text
                    x={c.label.x}
                    y={c.label.y}
                    className="consto__label"
                    textAnchor="middle"
                    fontSize={12.5 / view.k}
                    opacity={on ? 0.95 : 0.32}
                    title={c.name}
                  >
                    {c.shortLabel}
                  </text>
                </g>
              )
            })}

            {stars.map((s) => {
              const look = starLook(s.entry.rating)
              const isSel = s.entry.id === selectedId
              const dim = litIds && !litIds.has(s.entry.id)
              return (
                <g
                  key={s.entry.id}
                  className={`star-node${isSel ? ' star-node--sel' : ''}${
                    justAddedId === s.entry.id ? ' star-node--new' : ''
                  }`}
                  transform={`translate(${s.x},${s.y})`}
                  opacity={dim ? 0.22 : 1}
                  onClick={() => !moved.current && onSelect(isSel ? null : s.entry.id)}
                >
                  <circle r={look.radius * 5.5} fill={`url(#${look.haloId})`} />
                  {look.flare && (
                    <g opacity="0.85" transform={`rotate(${s.spin})`}>
                      <path
                        d={spikePath(look.radius * 9, look.radius * 0.85)}
                        fill="url(#spike-grad)"
                      />
                      <path
                        d={spikePath(look.radius * 9, look.radius * 0.85)}
                        fill="url(#spike-grad)"
                        transform="rotate(90)"
                      />
                      <path
                        d={spikePath(look.radius * 4, look.radius * 0.45)}
                        fill="url(#spike-grad)"
                        transform="rotate(45)"
                        opacity="0.55"
                      />
                      <path
                        d={spikePath(look.radius * 4, look.radius * 0.45)}
                        fill="url(#spike-grad)"
                        transform="rotate(135)"
                        opacity="0.55"
                      />
                    </g>
                  )}
                  <circle r={look.radius} fill={look.color} opacity={look.opacity} />
                  {(isSel || view.k > 1.1) && (
                    <text
                      className="star-node__label"
                      y={look.radius + 13 / view.k}
                      textAnchor="middle"
                      fontSize={11 / view.k}
                    >
                      {s.entry.title}
                    </text>
                  )}
                  {isSel && (
                    <circle
                      r={look.radius + 7 / view.k}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={1.5 / view.k}
                    />
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <div className="sky-legend">
        <span>brightness = rating</span>
        <span>direction = genre</span>
        <span>distance = release year</span>
        {constellations.length > 0 && <span>constellations {constellations.length}</span>}
      </div>

      {entries.length === 0 && <p className="empty empty--sky">空はまだ真っ暗です。</p>}
    </div>
  )
}
