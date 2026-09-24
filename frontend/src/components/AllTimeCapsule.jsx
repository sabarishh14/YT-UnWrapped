import { useState } from 'react'
import cap from './MonthCapsule.module.css'
import styles from './AllTimeCapsule.module.css'
import TopRankings from './TopRankings.jsx'
import Highlights from './Highlights.jsx'
import ArtistAllTime from './ArtistAllTime.jsx'

function formatMinutes(mins) {
  const h = Math.floor(Math.round(mins) / 60)
  const m = Math.round(mins) % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Lifetime view across every month of history.
export default function AllTimeCapsule({ data }) {
  const [artistDetail, setArtistDetail] = useState(null)
  const [showMore, setShowMore] = useState(false)
  const [artFailed, setArtFailed] = useState(false)
  if (!data) return null

  const n = showMore ? 25 : 10
  const topSong = data.top_songs?.[0]
  const timeline = [...(data.taste_timeline || [])].reverse()
  const maxTimeline = Math.max(...timeline.map(t => t.minutes), 1)

  return (
    <div>
      <div className={cap.capsule} style={{ padding: '24px' }}>

        <div className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.pre}>Since {data.since}</p>
            <h2 className={styles.big}>
              {Math.round(data.total_minutes / 60).toLocaleString()}<span className={styles.unit}>hours</span>
            </h2>
            <p className={styles.sub}>of music, across {data.days_active.toLocaleString()} days of listening</p>
          </div>
          <div className={styles.heroStats}>
            {[
              [data.total_plays, 'plays'],
              [data.unique_artists, 'artists'],
              [data.unique_songs, 'songs'],
            ].map(([value, label]) => (
              <div key={label} className={styles.heroStat}>
                <span className={styles.heroStatValue}>{value.toLocaleString()}</span>
                <span className={styles.heroStatLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {topSong && (
          <div className={styles.mostPlayed}>
            {topSong.image && !artFailed
              ? <img src={topSong.image} alt="" className={styles.mostPlayedArt} onError={() => setArtFailed(true)} />
              : <div className={styles.mostPlayedArtFallback}>🎵</div>}
            <div className={styles.mostPlayedText}>
              <p className={styles.pre}>Your most-played song ever</p>
              <p className={styles.mostPlayedName} title={topSong.name}>{topSong.name}</p>
              <p className={styles.mostPlayedArtist} title={topSong.artist}>{topSong.artist}</p>
            </div>
            <div className={styles.mostPlayedCount}>
              {topSong.plays}<span>plays</span>
            </div>
          </div>
        )}

        <div className={cap.rankingsSection}>
          <div className={cap.historyHeader}>
            <div className={cap.sectionLabel}>Your all-time top {n}</div>
            <button
              className={cap.showMore}
              style={{ padding: '6px 16px', fontSize: '11px', marginTop: '-4px' }}
              onClick={() => setShowMore(m => !m)}
            >
              {showMore ? 'View Top 10' : 'View Top 25'}
            </button>
          </div>
          <div className={cap.rankingsGrid}>
            <TopRankings
              top_artists={data.top_artists?.slice(0, n)}
              top_songs={data.top_songs?.slice(0, n)}
              top_albums={data.top_albums?.slice(0, n)}
              top_music_directors={data.top_music_directors?.slice(0, n)}
              maxArtist={data.top_artists?.[0]?.minutes || 1}
              maxSong={data.top_songs?.[0]?.plays || 1}
              maxDirector={data.top_music_directors?.[0]?.minutes || 1}
              setArtistDetail={setArtistDetail}
            />
          </div>
        </div>

        <Highlights highlights={data.highlights} period="all time" />

        {timeline.length > 1 && (
          <div className={cap.section}>
            <div className={cap.sectionLabel}>How your taste shifted</div>
            <div className={styles.timeline}>
              {timeline.map(t => (
                <div key={t.month} className={styles.timelineRow}>
                  <span className={styles.timelineMonth}>{t.label}</span>
                  <div className={styles.timelineMain}>
                    <button
                      className={styles.timelineArtist}
                      onClick={() => t.top_artist && setArtistDetail(t.top_artist)}
                    >
                      {t.top_artist || '-'}
                    </button>
                    <span className={styles.timelineSong}>{t.top_song}</span>
                    <div className={styles.timelineBar}>
                      <div className={styles.timelineFill} style={{ width: `${(t.minutes / maxTimeline) * 100}%` }} />
                    </div>
                  </div>
                  <span className={styles.timelineMins}>{formatMinutes(t.minutes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {artistDetail && (
        <div className={cap.drawerOverlay} onClick={() => setArtistDetail(null)}>
          <div className={cap.drawer} onClick={e => e.stopPropagation()}>
            <div className={cap.drawerHeader}>
              <div>
                <p className={cap.drawerSub}>Artist deep-dive</p>
                <h3 className={cap.drawerTitle}>{artistDetail}</h3>
              </div>
              <button className={cap.drawerClose} onClick={() => setArtistDetail(null)}>✕</button>
            </div>
            <div className={cap.drawerBody}>
              {data.artist_profiles?.[artistDetail]
                ? <ArtistAllTime profile={data.artist_profiles[artistDetail]} />
                : <p className={cap.empty}>No details for this artist yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
