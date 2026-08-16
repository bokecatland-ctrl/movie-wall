import { useEffect, useRef, useState } from 'react'
import { searchMovies, fetchMovieEntry, posterUrl } from '../lib/tmdb.js'
import { extractSpineColor } from '../lib/color.js'
import StarRating from './StarRating.jsx'

/** ローカル時間の YYYY-MM-DD。toISOString() だとUTCになって日本では前日にずれる */
const today = () => new Date().toLocaleDateString('sv-SE')

const VENUES = [
  { id: 'theater', label: '劇場' },
  { id: 'home', label: '家' },
  { id: 'other', label: 'その他' },
]

export default function AddFlow({ entries, onSave, onClose }) {
  const [step, setStep] = useState('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [picked, setPicked] = useState(null)
  const [rating, setRating] = useState(null)
  const [watchedOn, setWatchedOn] = useState(today())
  const [venue, setVenue] = useState('theater')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const inputRef = useRef(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function runSearch(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    try {
      setResults(await searchMovies(q))
      setSearched(true)
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function pick(tmdbId) {
    setBusyId(tmdbId)
    setError('')
    try {
      const detail = await fetchMovieEntry(tmdbId)
      setPicked(detail)
      setRating(null)
      setWatchedOn(today())
      setNote('')
      setStep('rate')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const seenBefore = picked ? entries.some((e) => e.tmdbId === picked.tmdbId) : false

  async function save() {
    if (!picked || !rating) return
    setSaving(true)
    setError('')
    try {
      const spineColor = await extractSpineColor(picked.posterPath)
      await onSave({
        tmdbId: picked.tmdbId,
        title: picked.title,
        originalTitle: picked.originalTitle,
        releaseYear: picked.releaseYear,
        posterPath: picked.posterPath,
        runtime: picked.runtime,
        genres: picked.genres,
        director: picked.director,
        castNames: picked.castNames,
        rating,
        watchedOn,
        venue,
        isRewatch: seenBefore,
        note: note.trim(),
        spineColor,
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="観た映画を追加">
      <div className="sheet__backdrop" onClick={onClose} />

      <div className="sheet__body">
        {step === 'search' && (
          <>
            <div className="sheet__head">
              <h2>観た映画を追加</h2>
              <button className="icon-btn" onClick={onClose} aria-label="閉じる">
                ✕
              </button>
            </div>

            <form onSubmit={runSearch} className="searchbar">
              <input
                ref={inputRef}
                type="search"
                value={query}
                placeholder="タイトルで検索（日本語でも可・表示は英題）"
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
              />
              <button type="submit" disabled={loading || !query.trim()}>
                {loading ? '…' : '検索'}
              </button>
            </form>

            {error && <p className="notice notice--error">{error}</p>}

            <div className="results">
              {results.map((r) => (
                <button
                  key={r.tmdbId}
                  className="result"
                  onClick={() => pick(r.tmdbId)}
                  disabled={busyId != null}
                >
                  {r.posterPath ? (
                    <img src={posterUrl(r.posterPath, 'w185')} alt="" loading="lazy" />
                  ) : (
                    <div className="result__noimg">NO IMAGE</div>
                  )}
                  <div className="result__label">
                    {busyId === r.tmdbId ? '読み込み中…' : r.title}
                  </div>
                  {r.year && <div className="result__year">{r.year}</div>}
                  {entries.some((e) => e.tmdbId === r.tmdbId) && (
                    <div className="result__seen">記録済み</div>
                  )}
                </button>
              ))}
            </div>

            {searched && !loading && results.length === 0 && !error && (
              <p className="notice">該当なし。原題（英語）でも試してみてください。</p>
            )}
          </>
        )}

        {step === 'rate' && picked && (
          <>
            <div className="sheet__head">
              <button className="icon-btn" onClick={() => setStep('search')} aria-label="検索に戻る">
                ←
              </button>
              <h2>どうだった？</h2>
              <button className="icon-btn" onClick={onClose} aria-label="閉じる">
                ✕
              </button>
            </div>

            <div className="rate">
              <div className="rate__poster">
                {picked.posterPath ? (
                  <img src={posterUrl(picked.posterPath, 'w342')} alt="" />
                ) : (
                  <div className="result__noimg">NO IMAGE</div>
                )}
              </div>

              <div className="rate__main">
                <div className="rate__title">{picked.title}</div>
                <div className="rate__meta">
                  {[picked.releaseYear, picked.director, picked.runtime && `${picked.runtime}分`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {seenBefore && <div className="rate__rewatch">再鑑賞として記録されます</div>}

                <div className="rate__stars">
                  <StarRating value={rating} onChange={setRating} size={44} />
                </div>

                <div className="rate__row">
                  <label>
                    観た日
                    <input
                      type="date"
                      value={watchedOn}
                      max={today()}
                      onChange={(e) => setWatchedOn(e.target.value)}
                    />
                  </label>
                </div>

                <div className="rate__row rate__venues">
                  {VENUES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`chip${venue === v.id ? ' chip--on' : ''}`}
                      onClick={() => setVenue(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                <textarea
                  className="rate__note"
                  rows={2}
                  value={note}
                  placeholder="ひとこと（任意）"
                  onChange={(e) => setNote(e.target.value)}
                />

                {error && <p className="notice notice--error">{error}</p>}

                <button className="primary" onClick={save} disabled={!rating || saving}>
                  {saving ? '棚に入れています…' : rating ? '棚に入れる' : '★を付けてください'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
