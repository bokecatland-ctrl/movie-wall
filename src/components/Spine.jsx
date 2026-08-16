import { memo } from 'react'
import { posterUrl } from '../lib/tmdb.js'
import { textOn } from '../lib/color.js'

/**
 * 1本＝1枚の背表紙。
 * クリックすると左端を軸に手前へ回り、裏に畳んであった表紙が正面を向く。
 */
function Spine({ entry, width, x, height, flip, selected, justAdded, onSelect }) {
  const color = entry.spineColor ?? '#4a4650'
  const ink = textOn(color)
  const coverWidth = Math.round(height * (2 / 3))
  const ratio = (entry.rating ?? 0) / 5

  return (
    <button
      type="button"
      className={`spine${selected ? ' spine--open' : ''}${justAdded ? ' spine--new' : ''}${
        flip ? ' spine--flip' : ''
      }`}
      style={{
        '--w': `${width}px`,
        '--h': `${height}px`,
        '--cover-w': `${coverWidth}px`,
        '--spine-color': color,
        '--ink': ink,
        left: `${x}px`,
      }}
      onClick={() => onSelect(selected ? null : entry.id)}
      aria-pressed={selected}
      title={`${entry.title}${entry.rating ? ` ★${entry.rating.toFixed(1)}` : ''}`}
    >
      <span className="spine__face">
        <span className="spine__foil" />
        <span className="spine__title">{entry.title}</span>
        {entry.isRewatch && <span className="spine__dot" />}
        <span className="spine__foil" />
        <span className="spine__rating">
          <span className="spine__rating-fill" style={{ width: `${ratio * 100}%` }} />
        </span>
      </span>

      <span className="spine__cover" aria-hidden="true">
        {entry.posterPath ? (
          <img src={posterUrl(entry.posterPath, 'w342')} alt="" loading="lazy" />
        ) : (
          <span className="spine__cover-alt">{entry.title}</span>
        )}
      </span>
    </button>
  )
}

export default memo(Spine)
