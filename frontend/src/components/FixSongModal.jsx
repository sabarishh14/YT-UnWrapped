import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../api.js'
import styles from './FixSongModal.module.css'

// Search YouTube Music and pick the song a play should really count as.
export default function FixSongModal({ item, sourceTitle, playCount, onClose, onFixed, onReset }) {
  const [query, setQuery] = useState(sourceTitle)
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')
  const latestSearch = useRef(0)

  const search = async (text) => {
    const q = text.trim()
    if (!q) return
    const request = ++latestSearch.current
    setSearching(true)
    setError('')
    try {
      const res = await apiFetch(`/api/song_search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (request !== latestSearch.current) return  // a newer search won
      if (!res.ok) throw new Error(data.error)
      setResults(data.results || [])
    } catch (e) {
      if (request !== latestSearch.current) return
      setResults([])
      setError(e.message || "Search didn't work. Try again.")
    }
    setSearching(false)
  }

  useEffect(() => {
    search(sourceTitle)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // Runs once for the song this modal was opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = async (result) => {
    setSaving(result.video_id)
    setError('')
    try {
      const res = await apiFetch('/api/song_fix', {
        method: 'POST',
        body: JSON.stringify({ title: sourceTitle, video_id: result.video_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onFixed(data.fix)
    } catch (e) {
      setError(e.message || "Couldn't save that. Try again.")
      setSaving(null)
    }
  }

  const reset = async () => {
    setSaving('reset')
    setError('')
    try {
      const res = await apiFetch('/api/song_fix/reset', { method: 'POST', body: JSON.stringify({ title: sourceTitle }) })
      if (!res.ok) throw new Error((await res.json()).error)
      onReset()
    } catch (e) {
      setError(e.message || "Couldn't reset that. Try again.")
      setSaving(null)
    }
  }

  const busy = saving !== null

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fix-song-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="fix-song-title" className={styles.heading}>Wrong song?</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className={styles.current}>
          {sourceTitle !== item.title && <>You played <strong>{sourceTitle}</strong>, shown as </>}
          {sourceTitle === item.title && <>Shown as </>}
          <strong>{item.title}</strong> by {item.artist}.
        </p>

        <form className={styles.searchRow} onSubmit={e => { e.preventDefault(); search(query) }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search YouTube Music"
            aria-label="Search YouTube Music"
            autoComplete="off"
            spellCheck="false"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !query.trim()}>Search</button>
        </form>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.results}>
          {results === null || searching ? (
            <div className={styles.status}><span className={styles.spinner} /> Searching YouTube Music…</div>
          ) : results.length === 0 ? (
            !error && <p className={styles.status}>Nothing found. Try different words, like the song and film name.</p>
          ) : (
            results.map(r => {
              const isCurrent = r.video_id === item.video_id
              return (
                <button key={r.video_id} className={styles.result} disabled={busy || isCurrent} onClick={() => pick(r)}>
                  {r.image
                    ? <img src={r.image} alt="" loading="lazy" className={styles.art} referrerPolicy="no-referrer" />
                    : <span className={styles.artFallback}>🎵</span>}
                  <span className={styles.resultText}>
                    <span className={styles.resultTitle}>{r.title}</span>
                    <span className={styles.resultMeta}>{[r.artist, r.album].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={styles.resultSide}>
                    {saving === r.video_id ? <span className={styles.spinner} /> : isCurrent ? 'Current' : r.duration}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className={styles.footer}>
          <p className={styles.note}>
            Changes {playCount === 1 ? 'this play' : `all ${playCount.toLocaleString()} plays of this song`}, on your account only.
          </p>
          {item.corrected && (
            <button className={styles.reset} onClick={reset} disabled={busy}>
              {saving === 'reset' ? 'Resetting…' : 'Reset to automatic'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
