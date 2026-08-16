import { useEffect, useRef, useState } from 'react'
import { formatDuration, summarize } from '../lib/stats.js'

const wantsMotion = () =>
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 数字が飛ばずに回って増える。+1 の瞬間を見せるためだけの仕掛け */
function useCountUp(target, ms = 700) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    const snap = () => {
      from.current = target
      setShown(target)
    }

    // 非アクティブなタブでは rAF が発火しない。アニメーションだけのために
    // 本数がずっと 0 のままになるのは論外なので、その場合は即座に確定させる。
    if (document.hidden || !wantsMotion()) {
      snap()
      return
    }

    const start = performance.now()
    const a = from.current
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(a + (target - a) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)

    // 途中でタブが隠れて rAF が止まっても、必ず最終値に着地させる保険
    const safety = setTimeout(snap, ms + 200)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
    }
  }, [target, ms])

  return shown
}

export default function GrowthBar({ entries }) {
  const s = summarize(entries)
  const count = useCountUp(s.count)

  return (
    <div className="growth">
      <div className="growth__main">
        <span className="growth__count">{count}</span>
        <span className="growth__unit">films</span>
      </div>
      <div className="growth__side">
        <span title="Total runtime of everything you've watched">
          Time logged: {formatDuration(s.minutes)}
        </span>
        <span>
          This year: {s.thisYear}
          {s.lastYear > 0 && (
            <em className={s.thisYear >= s.lastYear ? 'up' : 'down'}>
              {s.thisYear >= s.lastYear ? '▲' : '▼'}
              {Math.abs(s.thisYear - s.lastYear)}
            </em>
          )}
        </span>
        {s.avg != null && <span>Average ★{s.avg.toFixed(2)}</span>}
      </div>
    </div>
  )
}
