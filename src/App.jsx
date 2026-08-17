import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, hasFirebase } from './lib/firebase.js'
import { addEntry, importEntries, listEntries, removeEntry, updateEntry } from './lib/entries.js'
import { downloadJson, readJsonFile } from './lib/storage.js'
import Auth from './components/Auth.jsx'
import GrowthBar from './components/GrowthBar.jsx'
import Shelf from './components/Shelf.jsx'
import Sky from './components/Sky.jsx'
import Stats from './components/Stats.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import AddFlow from './components/AddFlow.jsx'
import './styles/theme.css'
import './styles/app.css'

const VIEWS = [
  { id: 'shelf', label: 'Shelf' },
  { id: 'sky', label: 'Sky' },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!hasFirebase)

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [view, setView] = useState('shelf')
  const [sort, setSort] = useState('watched')
  const [selectedId, setSelectedId] = useState(null)
  const [justAddedId, setJustAddedId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!hasFirebase) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
    })
  }, [])

  const signedIn = !hasFirebase || Boolean(user)

  useEffect(() => {
    if (!authReady || !signedIn) return
    let alive = true
    ;(async () => {
      try {
        const list = await listEntries()
        if (alive) setEntries(list)
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [authReady, signedIn])

  const handleSave = useCallback(async (entry) => {
    const saved = await addEntry(entry)
    setEntries((prev) => [...prev, saved])
    setJustAddedId(saved.id)
    setTimeout(() => setJustAddedId(null), 1400)
  }, [])

  const handleUpdate = useCallback(async (id, patch) => {
    // 先に画面を動かす。★を付け直した手応えが待たされるとつまらない
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    try {
      await updateEntry(id, patch)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const handleRemove = useCallback(async (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setSelectedId(null)
    try {
      await removeEntry(id)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  async function handleImport(file) {
    setMenuOpen(false)
    try {
      const data = await readJsonFile(file)
      const list = Array.isArray(data) ? data : (data.entries ?? [])
      const n = await importEntries(list)
      setEntries(await listEntries())
      setError(n ? `Imported ${n} ${n === 1 ? 'entry' : 'entries'}.` : 'Nothing new to add.')
    } catch (e) {
      setError(e.message)
    }
  }

  if (!authReady) return <div className="boot">…</div>
  if (!signedIn) return <Auth />

  const selected = entries.find((e) => e.id === selectedId) ?? null

  return (
    <div className={`app${selected ? ' app--detail' : ''}`}>
      <header className="topbar">
        <h1 className="brand">MOVIE WALL</h1>
        <GrowthBar entries={entries} />
        <nav className="tabs">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`tab${view === v.id ? ' tab--on' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <div className="menu">
          <button
            className="icon-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="menu__scrim" onClick={() => setMenuOpen(false)} />
              <div className="menu__list">
                <button
                  onClick={() => {
                    setShowStats(true)
                    setMenuOpen(false)
                  }}
                >
                  See stats
                </button>
                <button
                  onClick={() => {
                    downloadJson(entries, `movie-wall-${new Date().toLocaleDateString('sv-SE')}.json`)
                    setMenuOpen(false)
                  }}
                >
                  Export JSON
                </button>
                <button onClick={() => fileRef.current.click()}>Import JSON</button>
                {hasFirebase && <button onClick={() => signOut(auth)}>Log out</button>}
                <p className="menu__note">
                  Storage: {hasFirebase ? 'Firebase (synced across devices)' : 'This browser only'}
                  {hasFirebase && user?.email && (
                    <>
                      <br />
                      Signed in as {user.email}
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files[0] && handleImport(e.target.files[0])}
        />
      </header>

      {error && (
        <p className="notice notice--error notice--float" onClick={() => setError('')}>
          {error} (tap to dismiss)
        </p>
      )}

      <main className="stage">
        {loading ? (
          <p className="empty">Loading…</p>
        ) : view === 'shelf' ? (
          <Shelf
            entries={entries}
            sort={sort}
            onSortChange={setSort}
            selectedId={selectedId}
            onSelect={setSelectedId}
            justAddedId={justAddedId}
          />
        ) : (
          <Sky
            entries={entries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            justAddedId={justAddedId}
          />
        )}
      </main>

      {selected && (
        <DetailPanel
          // 別の作品を選んだら中の下書き状態ごと作り直す（effectで消して回らない）
          key={selected.id}
          entry={selected}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onClose={() => setSelectedId(null)}
        />
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Add a movie">
        ＋
      </button>

      {adding && (
        <AddFlow entries={entries} onSave={handleSave} onClose={() => setAdding(false)} />
      )}

      {showStats && <Stats entries={entries} onClose={() => setShowStats(false)} />}
    </div>
  )
}
