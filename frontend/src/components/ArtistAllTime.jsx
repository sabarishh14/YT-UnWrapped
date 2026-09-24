import styles from './ArtistAllTime.module.css'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatMinutes(mins) {
  const h = Math.floor(Math.round(mins) / 60)
  const m = Math.round(mins) % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// All-time deep-dive for one artist (shown in the artist drawer).
export default function ArtistAllTime({ profile }) {
  if (!profile) return null
  const maxMonth = Math.max(...profile.monthly.map(m => m.minutes), 1)

  return (
    <div className={styles.wrap}>
      <p className={styles.heading}>All time</p>

      <div className={styles.stats}>
        <div>
          <span className={styles.statValue}>{formatMinutes(profile.minutes)}</span>
          <span className={styles.statLabel}>together</span>
        </div>
        <div>
          <span className={styles.statValue}>{profile.plays.toLocaleString()}</span>
          <span className={styles.statLabel}>plays</span>
        </div>
      </div>

      <p className={styles.first}>
        First heard on <strong>{profile.first_heard.date}</strong> with <strong>{profile.first_heard.song}</strong>
      </p>

      {profile.monthly.length > 1 && (
        <div className={styles.chart} aria-label="Minutes per month">
          {profile.monthly.map(m => (
            <div key={m.month} className={styles.col} title={`${formatMinutes(m.minutes)} in ${m.month}`}>
              <div className={styles.track}>
                <div className={styles.fill} style={{ height: `${Math.max((m.minutes / maxMonth) * 100, 4)}%` }} />
              </div>
              <span className={styles.colLabel}>{MONTHS[Number(m.month.split('-')[1]) - 1]}</span>
            </div>
          ))}
        </div>
      )}

      {profile.top_songs.length > 0 && (
        <>
          <p className={styles.subheading}>Your top songs</p>
          <ol className={styles.songs}>
            {profile.top_songs.map((s, i) => (
              <li key={s.name} className={styles.song}>
                <span className={styles.songIdx}>{i + 1}</span>
                <span className={styles.songName}>{s.name}</span>
                <span className={styles.songPlays}>{s.plays}×</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
