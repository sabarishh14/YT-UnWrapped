import { useState, useMemo, useDeferredValue } from 'react'
import { auth } from '../firebase.js'
import { apiFetch } from '../api.js'
import styles from './HistorySection.module.css'

const FIELDS = [
  { key: 'all', label: 'All' },
  { key: 'title', label: 'Songs' },
  { key: 'artist', label: 'Artists' },
  { key: 'album', label: 'Albums' },
]
const PAGE_SIZE = 50
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const THIS_YEAR = String(new Date().getFullYear())

// Search ignores case and accents, and every word must match somewhere.
const normalize = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function matches(item, terms, field) {
  const text = field === 'all' ? `${item.title} ${item.artist} ${item.album || ''}` : item[field]
  const haystack = normalize(text)
  return terms.every(term => haystack.includes(term))
}

// "2026-11-06 14:05" -> "6 Nov, 2:05 PM". Done by hand because the list can
// have thousands of rows and locale formatters are slow when called per row.
function formatPlayedAt(playedAt) {
  const [date, time] = (playedAt || '').split(' ')
  if (!time) return ''
  const [y, m, d] = date.split('-')
  const [hour, minute] = time.split(':').map(Number)
  const year = y === THIS_YEAR ? '' : ` ${y}`
  return `${Number(d)} ${MONTHS[Number(m) - 1]}${year}, ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Plays Last.fm reported that YouTube Music never matched have no real video.
function songLink(item) {
  if (String(item.video_id).startsWith('lfm_')) {
    return `https://music.youtube.com/search?q=${encodeURIComponent(`${item.title} ${item.artist}`)}`
  }
  return `https://music.youtube.com/watch?v=${item.video_id}`
}

// Every play in the selected period, searchable by song, artist or album.
// `allHistory` adds a "search all time" option when viewing a single period.
export default function HistorySection({ history, allHistory, periodLabel, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [hiddenIds, setHiddenIds] = useState(new Set())
  const [query, setQuery] = useState('')
  const [field, setField] = useState('all')
  const [searchAllTime, setSearchAllTime] = useState(false)

  // Keeps typing smooth while thousands of rows are filtered.
  const deferredQuery = useDeferredValue(query)
  const terms = useMemo(() => normalize(deferredQuery).split(/\s+/).filter(Boolean), [deferredQuery])
  const searching = terms.length > 0
  const canWiden = Boolean(allHistory) && allHistory !== history
  const source = searching && searchAllTime && canWiden ? allHistory : history

  const visibleRows = useMemo(() => {
    const active = (source || []).filter(item => !hiddenIds.has(item.video_id))
    return searching ? active.filter(item => matches(item, terms, field)) : active
  }, [source, hiddenIds, searching, terms, field])

  const summary = useMemo(() => {
    if (!searching) return null
    return {
      seconds: visibleRows.reduce((sum, item) => sum + (item.duration_seconds || 0), 0),
      songs: new Set(visibleRows.map(item => `${item.title}|${item.artist}`)).size,
    }
  }, [searching, visibleRows])

  const shown = expanded ? visibleRows : visibleRows.slice(0, PAGE_SIZE)

  const updateQuery = (value) => {
    setQuery(value)
    setExpanded(false)
  }

  const handleHideTrack = async (e, video_id) => {
    e.preventDefault()
    e.stopPropagation()
    setHiddenIds(prev => new Set(prev).add(video_id))
    if (!auth.currentUser) return

    try {
      await apiFetch('/api/hide_track', { method: 'POST', body: JSON.stringify({ video_id }) })
      window.dispatchEvent(new Event('trackHidden'))
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Failed to hide track:', err)
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.label}>Full History</div>
        <span className={styles.count}>
          {searching ? `${visibleRows.length.toLocaleString()} of ${source.length.toLocaleString()}` : visibleRows.length.toLocaleString()} plays
        </span>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => updateQuery(e.target.value)}
            placeholder="Search songs, artists or albums"
            aria-label="Search your plays"
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => updateQuery('')} aria-label="Clear search">✕</button>
          )}
        </div>

        <div className={styles.chips}>
          {FIELDS.map(f => (
            <button
              key={f.key}
              className={`${styles.chip} ${field === f.key ? styles.chipActive : ''}`}
              aria-pressed={field === f.key}
              onClick={() => { setField(f.key); setExpanded(false) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {searching && (
        <div className={styles.summaryRow}>
          <p className={styles.summary}>
            {visibleRows.length > 0
              ? <><strong>{visibleRows.length.toLocaleString()}</strong> {visibleRows.length === 1 ? 'play' : 'plays'} · <strong>{formatDuration(summary.seconds)}</strong> · <strong>{summary.songs.toLocaleString()}</strong> {summary.songs === 1 ? 'song' : 'songs'}</>
              : <>No plays match "{deferredQuery.trim()}"{searchAllTime || !canWiden ? '.' : ` in ${periodLabel}.`}</>}
          </p>
          {canWiden && (
            <div className={styles.chips}>
              <button className={`${styles.chip} ${!searchAllTime ? styles.chipActive : ''}`} aria-pressed={!searchAllTime} onClick={() => { setSearchAllTime(false); setExpanded(false) }}>
                {periodLabel}
              </button>
              <button className={`${styles.chip} ${searchAllTime ? styles.chipActive : ''}`} aria-pressed={searchAllTime} onClick={() => { setSearchAllTime(true); setExpanded(false) }}>
                All time
              </button>
            </div>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <div className={styles.table}>
          <div className={styles.head}>
            <span>#</span>
            <span>Song</span>
            <span>Artist</span>
            <span>Album</span>
            <span>Played</span>
          </div>

          <div className={styles.body}>
            {shown.map((item, i) => {
              const playedAt = formatPlayedAt(item.played_at)
              return (
                <a
                  // A stable key stops React from redrawing every row at once.
                  key={`${item.video_id}-${item.played_at}`}
                  className={styles.row}
                  href={songLink(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.idx}>{i + 1}</span>
                  <div className={styles.songCol}>
                    {item.image ? (
                      <img src={item.image} alt="" className={styles.image} loading="lazy" />
                    ) : (
                      <div className={styles.imageFallback}>🎵</div>
                    )}
                    <div className={styles.songText}>
                      <span className={styles.title} title={item.title}>{item.title}</span>
                      {/* Artist, album and date have their own columns except on phones */}
                      <span className={styles.compactMeta}>{item.artist}</span>
                      <span className={styles.compactMeta}>{[playedAt, item.album].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  <span className={styles.meta} title={item.artist}>{item.artist}</span>
                  <span className={styles.meta} title={item.album}>{item.album || '-'}</span>
                  <span className={styles.played}>{playedAt}</span>

                  <div className={styles.actions}>
                    <button
                      className={styles.actionBtn}
                      onClick={(e) => handleHideTrack(e, item.video_id)}
                      title="Hide this track from your stats"
                      aria-label={`Hide ${item.title} from your stats`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                    </button>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {visibleRows.length > PAGE_SIZE && (
        <button className={styles.showMore} onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show all ${visibleRows.length.toLocaleString()} plays`}
        </button>
      )}
    </div>
  )
}
