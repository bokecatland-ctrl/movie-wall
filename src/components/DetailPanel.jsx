import { useEffect, useState } from 'react'
import { posterUrl } from '../lib/tmdb.js'
import StarRating from './StarRating.jsx'

const VENUE_LABEL = { theater: 'Theater', home: 'Home', other: 'Other' }

/** 棚と星図で共用する詳細。どちらから開いても同じものが出る */
export default function DetailPanel({ entry, onUpdate, onRemove, onClose }) {
  // 作品を切り替えるとApp側の key で作り直されるので、ここでの状態リセットは不要
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState(entry.note ?? '')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const meta = [
    entry.releaseYear,
    entry.runtime && `${entry.runtime} min`,
    VENUE_LABEL[entry.venue],
  ].filter(Boolean)

  return (
    <aside className="detail" aria-label={`${entry.title} details`}>
      {/* スマホではシートが棚の下側を覆ってしまい、開いた本自体を
          もう一度タップできないことがある。常に触れる場所を上部に用意する */}
      <button className="detail__handle" onClick={onClose} aria-label="Close" />
      <button className="icon-btn detail__close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      <div className="detail__poster">
        {entry.posterPath ? (
          <img src={posterUrl(entry.posterPath, 'w500')} alt="" />
        ) : (
          <div className="result__noimg">NO IMAGE</div>
        )}
      </div>

      <h3 className="detail__title">{entry.title}</h3>
      {entry.originalTitle && entry.originalTitle !== entry.title && (
        <p className="detail__orig">{entry.originalTitle}</p>
      )}
      <p className="detail__meta">{meta.join(' · ')}</p>

      {entry.director && (
        <p className="detail__credit">
          <span>Director</span>
          {entry.director}
        </p>
      )}
      {entry.castNames?.length > 0 && (
        <p className="detail__credit">
          <span>Cast</span>
          {entry.castNames.join(' / ')}
        </p>
      )}
      {entry.genres?.length > 0 && (
        <p className="detail__genres">
          {entry.genres.map((g) => (
            <span key={g}>{g}</span>
          ))}
        </p>
      )}

      <div className="detail__block">
        <label className="detail__label">Rating</label>
        <StarRating value={entry.rating} onChange={(v) => onUpdate(entry.id, { rating: v })} size={30} />
      </div>

      <div className="detail__block">
        <label className="detail__label" htmlFor="watched-on">
          Watched on{entry.isRewatch && <em className="detail__rewatch">Rewatch</em>}
        </label>
        <input
          id="watched-on"
          type="date"
          value={entry.watchedOn}
          onChange={(e) => onUpdate(entry.id, { watchedOn: e.target.value })}
        />
      </div>

      <div className="detail__block">
        <label className="detail__label" htmlFor="note">
          Note
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          placeholder="—"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (entry.note ?? '') && onUpdate(entry.id, { note })}
        />
      </div>

      <div className="detail__foot">
        {confirming ? (
          <>
            <span className="detail__warn">Remove from the shelf?</span>
            <button className="danger" onClick={() => onRemove(entry.id)}>
              Remove
            </button>
            <button className="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="ghost" onClick={() => setConfirming(true)}>
            Delete this entry
          </button>
        )}
      </div>
    </aside>
  )
}
