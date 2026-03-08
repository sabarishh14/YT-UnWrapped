import React from 'react'
import styles from './MonthCapsule.module.css'

function formatMinutes(mins) {
  if (!mins || mins === 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function RankedList({ items, valueKey, valueFormatter, maxValue }) {
  return (
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
                <span className={styles.rankName}>{item.name}</span>
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
}

const TIME_SLOTS = [
  { label: 'Late Night', sub: '12am – 6am',  emoji: '🌙', hours: [0,1,2,3,4,5] },
  { label: 'Morning',    sub: '6am – 12pm',  emoji: '🌅', hours: [6,7,8,9,10,11] },
  { label: 'Afternoon',  sub: '12pm – 5pm',  emoji: '☀️',  hours: [12,13,14,15,16] },
  { label: 'Evening',    sub: '5pm – 9pm',   emoji: '🌆', hours: [17,18,19,20] },
  { label: 'Night',      sub: '9pm – 12am',  emoji: '🌃', hours: [21,22,23] },
]

function buildSlots(hourData) {
  return TIME_SLOTS.map(slot => ({
    ...slot,
    minutes: (hourData || [])
      .filter(h => slot.hours.includes(h.hour))
      .reduce((sum, h) => sum + h.minutes, 0),
  }))
}

function TimeBreakdown({ weekly, dow, hours }) {
  const maxWeek = Math.max(...(weekly || []).map(w => w.minutes), 1)
  const maxDow  = Math.max(...(dow    || []).map(d => d.minutes), 1)
  const slots   = buildSlots(hours)
  const maxSlot = Math.max(...slots.map(s => s.minutes), 1)
  const peak    = slots.reduce((a, b) => a.minutes > b.minutes ? a : b)

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Listening Patterns</div>

      <div className={styles.patternsGrid}>

        {/* Week by week — vertical bars */}
        <div className={styles.patternCard}>
          <p className={styles.patternTitle}>Week by Week</p>
          <div className={styles.weekChart}>
            {(weekly || []).map(w => (
              <div key={w.week} className={styles.weekCol}>
                <span className={styles.weekVal}>{formatMinutes(w.minutes)}</span>
                <div className={styles.weekTrack}>
                  <div
                    className={styles.weekFill}
                    style={{ height: `${Math.max((w.minutes / maxWeek) * 100, 3)}%` }}
                  />
                </div>
                <span className={styles.weekLabel}>{w.label}</span>
                <span className={styles.weekRange}>{w.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day of week — horizontal bars */}
        <div className={styles.patternCard}>
          <p className={styles.patternTitle}>Day of Week</p>
          <div className={styles.dowChart}>
            {(dow || []).map(d => (
              <div key={d.day} className={styles.dowRow}>
                <span className={styles.dowLabel}>{d.short}</span>
                <div className={styles.dowTrack}>
                  <div
                    className={styles.dowFill}
                    style={{ width: `${Math.max((d.minutes / maxDow) * 100, 2)}%` }}
                  />
                </div>
                <span className={styles.dowVal}>{formatMinutes(d.minutes)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time of day — contextual slots */}
        <div className={styles.patternCard}>
          <p className={styles.patternTitle}>
            Time of Day
            <span className={styles.peakBadge}>{peak.emoji} {peak.label} listener</span>
          </p>
          <div className={styles.slotsGrid}>
            {slots.map(s => {
              const isPeak = s.label === peak.label
              const pct = (s.minutes / maxSlot) * 100
              return (
                <div key={s.label} className={`${styles.slotItem} ${isPeak ? styles.slotPeak : ''}`}>
                  <div className={styles.slotTop}>
                    <span className={styles.slotEmoji}>{s.emoji}</span>
                    <span className={styles.slotLabel}>{s.label} <span className={styles.slotSub}>{s.sub}</span></span>
                    <span className={styles.slotVal}>{formatMinutes(s.minutes)}</span>
                  </div>
                  <div className={styles.slotBar}>
                    <div className={styles.slotFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

function HistorySection({ history }) {
  const [expanded, setExpanded] = React.useState(false)
  const visible = expanded ? history : history?.slice(0, 50)

  return (
    <div className={styles.section}>
      <div className={styles.historyHeader}>
        <div className={styles.sectionLabel}>Full History</div>
        <span className={styles.historyCount}>{history?.length?.toLocaleString()} plays</span>
      </div>

      <div className={styles.historyTable}>
        <div className={styles.historyHead}>
          <span>#</span>
          <span>Song</span>
          <span>Artist</span>
        </div>
        <div className={styles.historyBody}>
          {(visible || []).map((item, i) => (
            <a
              key={i}
              className={styles.historyRow}
              href={`https://music.youtube.com/watch?v=${item.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.historyIdx}>{i + 1}</span>
              <span className={styles.historyTitle}>{item.title}</span>
              <span className={styles.historyArtist}>{item.artist}</span>
            </a>
          ))}
        </div>
      </div>

      {history?.length > 50 && (
        <button className={styles.showMore} onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show all ${history.length.toLocaleString()} plays`}
        </button>
      )}
    </div>
  )
}

export default function MonthCapsule({ data }) {
  const {
    total_plays, total_minutes, top_artists, top_songs,
    streak, throwback, days_active,
    weekly_breakdown, day_of_week, hour_heatmap, history,
  } = data

  const maxArtist = top_artists?.[0]?.minutes || 1
  const maxSong   = top_songs?.[0]?.plays || 1
  const hrs  = Math.floor(total_minutes / 60)
  const mins = Math.round(total_minutes % 60)

  return (
    <div className={styles.capsule}>

      {/* ── Top row: Playtime + Artists + Songs ── */}
      <div className={styles.topRow}>

        <div className={`${styles.card} ${styles.playtimeCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>⏱</span>
            <span className={styles.cardTitle}>Total Playtime</span>
          </div>
          <div className={styles.playtimeBody}>
            <div className={styles.playtimeMain}>
              <span className={styles.playtimeMins}>{Math.round(total_minutes).toLocaleString()}</span>
              <span className={styles.playtimeUnit}>min</span>
            </div>
            <div className={styles.playtimeHours}>{hrs}h {mins}m</div>
            <div className={styles.playtimeMeta}>{total_plays.toLocaleString()} plays · {days_active} active days</div>
          </div>
        </div>

        <div className={`${styles.card} ${styles.rankCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🎤</span>
            <span className={styles.cardTitle}>Top Artists <span className={styles.cardSub}>by time</span></span>
          </div>
          <div className={styles.cardBody}>
            {top_artists?.length > 0
              ? <RankedList items={top_artists} valueKey="minutes" valueFormatter={formatMinutes} maxValue={maxArtist} />
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

      </div>

      {/* ── Mid row: Streak + Throwback ── */}
      <div className={styles.midRow}>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🔥</span>
            <span className={styles.cardTitle}>The Streak</span>
          </div>
          <div className={styles.cardBody}>
            {streak ? (
              <div className={styles.streakContent}>
                <div className={styles.streakNum}>
                  <span className={styles.streakDays}>{streak.days}</span>
                  <span className={styles.streakLabel}>days</span>
                </div>
                <div className={styles.streakInfo}>
                  <p className={styles.streakArtist}>{streak.artist}</p>
                  <p className={styles.streakDates}>{streak.start} → {streak.end}</p>
                  <p className={styles.streakDesc}>Consecutive days listening to your #1 artist</p>
                </div>
              </div>
            ) : <p className={styles.empty}>Not enough data</p>}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>📼</span>
            <span className={styles.cardTitle}>The Throwback</span>
          </div>
          <div className={styles.cardBody}>
            {throwback ? (
              <div className={styles.throwbackContent}>
                <div className={styles.throwbackSong}>
                  <span className={styles.throwbackArrow}>↩</span>
                  <div>
                    <p className={styles.throwbackTitle}>{throwback.song}</p>
                    <p className={styles.throwbackArtist}>{throwback.artist}</p>
                  </div>
                </div>
                <div className={styles.throwbackStats}>
                  <div className={styles.tbStat}>
                    <span className={styles.tbVal}>{throwback.plays_then}</span>
                    <span className={styles.tbMeta}>3 months ago</span>
                  </div>
                  <span className={styles.tbArrow}>→</span>
                  <div className={styles.tbStat}>
                    <span className={styles.tbVal}>{throwback.plays_now}</span>
                    <span className={styles.tbMeta}>this month</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className={styles.empty}>Not enough history yet — check back in 3 months.</p>
            )}
          </div>
        </div>

      </div>

      {/* ── Patterns ── */}
      <TimeBreakdown weekly={weekly_breakdown} dow={day_of_week} hours={hour_heatmap} />

      {/* ── History ── */}
      <HistorySection history={history} />

    </div>
  )
}