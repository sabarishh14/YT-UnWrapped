import React from 'react'
import styles from './MonthCapsule.module.css'

export default function TopRankings({ top_artists, top_songs, top_albums, top_music_directors, maxArtist, maxSong, maxDirector, setArtistDetail }) {  
  // Helper to format minutes into "1h 20m" etc.
  const formatMinutes = (mins) => {
    if (!mins || mins === 0) return '0m'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  // Reusable Ranked List Component
  const RankedList = ({ items, valueKey, valueFormatter, maxValue, onClickName }) => (
    <ol className={styles.rankedList}>
      {items.map((item, i) => {
        const value = item[valueKey]
        const pct = maxValue ? (value / maxValue) * 100 : 0
        return (
          <li key={i} className={styles.rankItem}>
            <span className={`${styles.rankNum} ${i === 0 ? styles.rankGold : i < 3 ? styles.rankSilver : ''}`}>
              {i + 1}
            </span>
            <div className={styles.rankInfo}>
              <div className={styles.rankNameRow}>
                <span
                  className={`${styles.rankName} ${onClickName ? styles.rankNameClickable : ''}`}
                  onClick={() => onClickName && onClickName(item.name)}
                >
                  {item.name}
                </span>
                <span className={styles.rankValue}>{valueFormatter(value)}</span>
              </div>
              <div className={styles.rankBar}>
                <div className={styles.rankFill} style={{ width: `${pct}%`, opacity: 0.9 - i * 0.06 }} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )

  return (
    <>
      <div className={`${styles.card} ${styles.rankCard}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>🎤</span>
          <span className={styles.cardTitle}>Top Artists <span className={styles.cardSub}>by time</span></span>
        </div>
        <div className={styles.cardBody}>
          {top_artists?.length > 0
            ? <RankedList items={top_artists} valueKey="minutes" valueFormatter={formatMinutes} maxValue={maxArtist} onClickName={setArtistDetail} />
            : <p className={styles.empty}>No data</p>}
        </div>
      </div>

      <div className={`${styles.card} ${styles.rankCard}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>🎵</span>
          <span className={styles.cardTitle}>Top Songs <span className={styles.cardSub}>by plays</span></span>
        </div>
        <div className={styles.cardBody}>
          {top_songs?.length > 0
            ? <RankedList items={top_songs} valueKey="plays" valueFormatter={v => `${v}×`} maxValue={maxSong} />
            : <p className={styles.empty}>No data</p>}
        </div>
      </div>

      <div className={`${styles.card} ${styles.rankCard}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>💿</span>
          <span className={styles.cardTitle}>Top Albums <span className={styles.cardSub}>by plays</span></span>
        </div>
        <div className={styles.cardBody}>
          {top_albums?.length > 0
            ? <RankedList items={top_albums} valueKey="plays" valueFormatter={v => `${v}×`} maxValue={top_albums[0]?.plays || 1} />
            : <p className={styles.empty}>No data</p>}
        </div>
      </div>
      <div className={`${styles.card} ${styles.rankCard}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>🎼</span>
          <span className={styles.cardTitle}>Top Music Directors <span className={styles.cardSub}>by time</span></span>
        </div>
        <div className={styles.cardBody}>
          {top_music_directors?.length > 0
            ? <RankedList items={top_music_directors} valueKey="minutes" valueFormatter={formatMinutes} maxValue={maxDirector} onClickName={setArtistDetail} />
            : <p className={styles.empty}>No data</p>}
        </div>
      </div>
    </>
  )
}