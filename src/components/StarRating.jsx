import { useId, useRef, useState } from 'react'

const PATH = 'M12 2.4l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.47l-5.9 3.1 1.13-6.57L2.45 9.34l6.6-.96z'

function Star({ fill, size, id }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="star">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>
      <path d={PATH} fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
      <path d={PATH} fill="var(--star)" clipPath={`url(#${id})`} />
    </svg>
  )
}

/**
 * 0.5刻みの★。
 * 指でもマウスでも「左右になぞって決める」操作にしている。星ひとつずつを
 * 別のボタンにすると、スマホで半分の側を狙って押すのが無理になるため。
 */
export default function StarRating({ value, onChange, size = 34, readOnly = false }) {
  // clipPath の id はドキュメント全体で一意でないと、別の★に食われて欠ける
  const idPrefix = useId().replace(/:/g, '')
  const ref = useRef(null)
  const [preview, setPreview] = useState(null)
  // state だと押してから離すまでに再レンダーが挟まらない限り false のままで、
  // 速いタップが丸ごと無視される。押下中フラグは同期的に読めないと駄目。
  const dragging = useRef(false)

  const shown = preview ?? value ?? 0

  function valueAt(clientX) {
    const rect = ref.current.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    const raw = Math.ceil(ratio * 10) / 2
    return Math.max(0.5, Math.min(5, raw))
  }

  function onPointerDown(e) {
    if (readOnly) return
    e.preventDefault()
    dragging.current = true
    try {
      ref.current.setPointerCapture(e.pointerId)
    } catch {
      // 掴めなくても★の上でなぞる分には問題ない
    }
    setPreview(valueAt(e.clientX))
  }

  function onPointerMove(e) {
    if (readOnly) return
    if (dragging.current || e.pointerType === 'mouse') setPreview(valueAt(e.clientX))
  }

  function onPointerUp(e) {
    if (readOnly || !dragging.current) return
    dragging.current = false
    onChange?.(valueAt(e.clientX))
    setPreview(null)
  }

  function onKeyDown(e) {
    if (readOnly) return
    const step = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key]
    if (!step) return
    e.preventDefault()
    onChange?.(Math.max(0.5, Math.min(5, (value ?? 2.5) + step)))
  }

  return (
    <div
      ref={ref}
      className={`stars${readOnly ? ' stars--static' : ''}`}
      style={{ '--star-size': `${size}px` }}
      role={readOnly ? 'img' : 'slider'}
      aria-label="評価"
      aria-valuenow={readOnly ? undefined : (value ?? 0)}
      aria-valuemin={readOnly ? undefined : 0.5}
      aria-valuemax={readOnly ? undefined : 5}
      tabIndex={readOnly ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => !dragging.current && setPreview(null)}
      onKeyDown={onKeyDown}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          id={`${idPrefix}-${i}`}
          size={size}
          fill={Math.max(0, Math.min(1, shown - i))}
        />
      ))}
      {!readOnly && <span className="stars__num">{shown ? shown.toFixed(1) : '—'}</span>}
    </div>
  )
}
