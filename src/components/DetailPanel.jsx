import { useEffect, useState } from 'react'
import { posterUrl } from '../lib/tmdb.js'
import StarRating from './StarRating.jsx'

const VENUE_LABEL = { theater: '劇場', home: '家', other: 'その他' }

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
    entry.runtime && `${entry.runtime}分`,
    VENUE_LABEL[entry.venue],
  ].filter(Boolean)

  return (
    <aside className="detail" aria-label={`${entry.title} の詳細`}>
      <button className="icon-btn detail__close" onClick={onClose} aria-label="閉じる">
        ✕
      </button>

      <div className="detail__poster">
        {entry.posterPath ? (
          <img src={posterUrl(entry.posterPath, 'w342')} alt="" />
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
          <span>監督</span>
          {entry.director}
        </p>
      )}
      {entry.castNames?.length > 0 && (
        <p className="detail__credit">
          <span>出演</span>
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
        <label className="detail__label">評価</label>
        <StarRating value={entry.rating} onChange={(v) => onUpdate(entry.id, { rating: v })} size={30} />
      </div>

      <div className="detail__block">
        <label className="detail__label" htmlFor="watched-on">
          観た日{entry.isRewatch && <em className="detail__rewatch">再鑑賞</em>}
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
          ひとこと
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
            <span className="detail__warn">棚から抜きますか？</span>
            <button className="danger" onClick={() => onRemove(entry.id)}>
              抜く
            </button>
            <button className="ghost" onClick={() => setConfirming(false)}>
              やめる
            </button>
          </>
        ) : (
          <button className="ghost" onClick={() => setConfirming(true)}>
            この記録を削除
          </button>
        )}
      </div>
    </aside>
  )
}
