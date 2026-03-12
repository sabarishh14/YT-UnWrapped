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

  // Reusable Ranked List Component (Wrapped Style)
  const RankedList = ({ items, valueKey, valueFormatter, maxValue, onClickName }) => {
    if (!items || items.length === 0) return null;

    const topItem = items[0];
    const restItems = items.slice(1);

    return (
      <div className={styles.rankedContainer}>
        {/* ── #1 Spotlight ── */}
        <div className={styles.rankHero}>
          <div className={styles.rankHeroCrown}>#1</div>
          <div className={styles.rankHeroInfo}>
            <span
              className={`${styles.rankHeroName} ${onClickName ? styles.rankNameClickable : ''}`}
              onClick={() => onClickName && onClickName(topItem.name)}
            >
              {topItem.name}
            </span>
            <span className={styles.rankHeroValue}>{valueFormatter(topItem[valueKey])}</span>
          </div>
        </div>

        {/* ── Runners up (2-N) ── */}
        {restItems.length > 0 && (
          <ol className={styles.rankedList} start="2">
            {restItems.map((item, i) => {
              const actualRank = i + 2; // Because we sliced off the first item
              const value = item[valueKey];
              const pct = maxValue ? (value / maxValue) * 100 : 0;
              return (
                <li key={i} className={styles.rankItem}>
                  <span className={`${styles.rankNum} ${actualRank <= 3 ? styles.rankSilver : ''}`}>
                    {actualRank}
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
                      <div className={styles.rankFill} style={{ width: `${pct}%`, opacity: 0.9 - actualRank * 0.08 }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  };

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