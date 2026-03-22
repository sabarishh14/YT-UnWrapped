import React from 'react'
import { auth } from '../firebase.js' /* <-- NEW: Grab the current user */
import styles from './MonthCapsule.module.css'
import TopRankings from './TopRankings.jsx'

function formatMinutes(mins) {
  if (!mins || mins === 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
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

function HistorySection({ history, onRefresh }) {
  const [expanded, setExpanded] = React.useState(false)
  const [hiddenIds, setHiddenIds] = React.useState(new Set()) // Track hidden songs instantly

  const handleHideTrack = async (e, video_id) => {
    e.preventDefault()
    e.stopPropagation()
    
    // 1. Optimistic UI: Instantly vanish the row from the screen
    setHiddenIds(prev => new Set(prev).add(video_id))

    const user_id = auth.currentUser?.uid
    if (!user_id) return

    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hide_track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, video_id })
      })
      
      // 2. Tell the Navbar to update the hidden list!
      window.dispatchEvent(new Event('trackHidden'));

      // 3. Silently update the Dashboard Playtime/Top Artists
      if (onRefresh) onRefresh()

    } catch (err) {
      console.error("Failed to hide track:", err)
    }
  }

  // Filter out the hidden tracks before we render the list
  const activeHistory = (history || []).filter(item => !hiddenIds.has(item.video_id))
  const visible = expanded ? activeHistory : activeHistory.slice(0, 50)

  return (
    <div className={styles.section}>
      <div className={styles.historyHeader}>
        <div className={styles.sectionLabel}>Full History</div>
        <span className={styles.historyCount}>{activeHistory.length.toLocaleString()} plays</span>
      </div>

      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '12px' }}>
        <div className={styles.historyTable} style={{ minWidth: '600px' }}>
          
          <div className={styles.historyHead}>
            <span>#</span>
            <span>Song</span>
            <span>Artist</span>
            <span>Album</span>
          </div>
          
          <div className={styles.historyBody}>
            {(visible || []).map((item, i) => (
              <a
                // CRITICAL FIX: A stable key stops React from redrawing 500 rows at once!
                key={`${item.video_id}-${item.played_at}`} 
                className={styles.historyRow}
                href={`https://music.youtube.com/watch?v=${item.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.historyIdx}>{i + 1}</span>
                <div className={styles.historySongCol}>
                  {item.image ? (
                    <img src={item.image} alt="Album Art" className={styles.historyImage} loading="lazy" />
                  ) : (
                    <div className={styles.historyImageFallback}>🎵</div>
                  )}
                  <span className={styles.historyTitle} title={item.title}>{item.title}</span>
                </div>
                <span className={styles.historyArtist} title={item.artist}>{item.artist}</span>
                <span className={styles.historyAlbum} title={item.album}>{item.album || '-'}</span>
                
                {/* --- WIRED UP: Hide Track Button --- */}
                <button 
                  className={styles.hideBtn} 
                  onClick={(e) => handleHideTrack(e, item.video_id)}
                  title="Hide this track from your stats"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                </button>

              </a>
            ))}
          </div>
        </div>
      </div>

      {activeHistory.length > 50 && (
        <button className={styles.showMore} onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show all ${activeHistory.length.toLocaleString()} plays`}
        </button>
      )}
    </div>
  )
}

export default function MonthCapsule({ data, monthLabel, onRefresh }) {
  const [artistDetail, setArtistDetail] = React.useState(null)
  const capsuleRef = React.useRef(null)
  const posterRef = React.useRef(null) // <--- ADD THIS
  const [isDownloading, setIsDownloading] = React.useState(false)
  
  // --- NEW: Let the user control the list size ---
  const [showTop10, setShowTop10] = React.useState(false) 

  const handleDownload = async () => {
    // 1. Make sure the hidden poster exists
    if (!posterRef.current) return
    setIsDownloading(true)
    
    try {
      const { toPng } = await import('html-to-image')
      
      // 2. Instantly take the picture of the HIDDEN poster (no delays needed!)
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        backgroundColor: '#050505',
        canvasWidth: 1080,
        canvasHeight: 1920,
        // Bring back the glowing red glass effect!
        style: {
          backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(255, 0, 0, 0.15) 0%, transparent 60%), radial-gradient(circle at 90% 90%, rgba(255, 50, 50, 0.15) 0%, transparent 60%)',
        }
      })
      
      const filename = `YT-Unwrapped-${monthLabel.replace(' ', '-')}.png`

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], filename, { type: 'image/png' })

      // 3. Try to open the Native Share Menu
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `${monthLabel} Unwrapped`,
            text: `Check out my YouTube Music Unwrapped for ${monthLabel}!`,
            files: [file]
          })
        } catch (shareErr) {
          console.log('User canceled the share.', shareErr)
        }
      } else {
        // Fallback: Download if on HTTP (local Wi-Fi) or unsupported browser
        const link = document.createElement('a')
        link.download = filename
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      console.error('Failed to capture snapshot', err)
    }
    
    setIsDownloading(false)
  }

  const artistSongs = React.useMemo(() => {
    // ... KEEP YOUR EXISTING artistSongs logic here ...
    if (!artistDetail || !data.history) return []
    const songMinutes = {}
    const songPlays = {}
    for (const item of data.history) {
      const artists = item.artist ? item.artist.split(/,|&|ft\.|feat\./i).map(a => a.trim()) : []
      if (artists.some(a => a.toLowerCase() === artistDetail.toLowerCase())) {
        const key = item.title
        songMinutes[key] = (songMinutes[key] || 0) + item.duration_seconds / 60
        songPlays[key] = (songPlays[key] || 0) + 1
      }
    }
    return Object.entries(songMinutes)
      .map(([title, minutes]) => ({ title, minutes: Math.round(minutes * 10) / 10, plays: songPlays[title] }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [artistDetail, data.history])

  const {
    total_plays, total_minutes, top_artists, top_songs, top_albums, top_music_directors,
    streak, throwback, days_active,
    weekly_breakdown, day_of_week, hour_heatmap, history,
  } = data

  const maxArtist = top_artists?.[0]?.minutes || 1
  const maxSong   = top_songs?.[0]?.plays || 1
  const maxDirector = top_music_directors?.[0]?.minutes || 1
  const hrs  = Math.floor(total_minutes / 60)
  const mins = Math.round(total_minutes % 60)
  
  // Calculate unique counts for the Discovery card
  const uniqueArtistsCount = React.useMemo(() => new Set((data.history || []).map(item => item.artist)).size, [data.history])
  const uniqueSongsCount = React.useMemo(() => new Set((data.history || []).map(item => item.title)).size, [data.history])

  return (
    <>
      {/* ── HIDDEN 9:16 EXPORT POSTER ── */}
      <div className={styles.exportPosterWrapper}>
        <div className={styles.exportPoster} ref={posterRef}>
          
          <div className={styles.posterHeader}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#FF0000"/>
              <circle cx="12" cy="12" r="4.5" fill="white"/>
              <circle cx="12" cy="12" r="2" fill="#FF0000"/>
            </svg>
            <h1 className={styles.posterTitle}>{monthLabel}</h1>
          </div>

<div className={styles.posterHero} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
            
            {/* Column 1: Total Playtime */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '20px', color: '#ffb3b3', margin: 0, paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}>Total Playtime</p>
              <h2 style={{ fontSize: '72px', fontWeight: 900, margin: 0, color: 'white', lineHeight: '1', letterSpacing: '-1px', whiteSpace: 'nowrap' }}>
                {Math.round(total_minutes).toLocaleString()} <span style={{ fontSize: '24px', color: '#888', fontWeight: 600, letterSpacing: '0' }}>mins</span>
              </h2>
            </div>

            {/* Column 2: Unique Artists */}
            <div style={{ flex: 1, borderLeft: '2px solid rgba(255, 255, 255, 0.1)', paddingLeft: '40px', marginLeft: '20px' }}>
              <p style={{ fontSize: '20px', color: '#ffb3b3', margin: 0, paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}>Unique Artists</p>
              <h2 style={{ fontSize: '72px', fontWeight: 900, margin: 0, color: 'white', lineHeight: '1', letterSpacing: '-1px', whiteSpace: 'nowrap' }}>
                {uniqueArtistsCount.toLocaleString()}
              </h2>
            </div>
            
            {/* Column 3: Unique Songs */}
            <div style={{ flex: 1, borderLeft: '2px solid rgba(255, 255, 255, 0.1)', paddingLeft: '40px', marginLeft: '20px' }}>
              <p style={{ fontSize: '20px', color: '#ffb3b3', margin: 0, paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}>Unique Songs</p>
              <h2 style={{ fontSize: '72px', fontWeight: 900, margin: 0, color: 'white', lineHeight: '1', letterSpacing: '-1px', whiteSpace: 'nowrap' }}>
                {uniqueSongsCount.toLocaleString()}
              </h2>
            </div>

          </div>
          
          <div className={styles.posterGrid}>
            <div className={styles.posterCard}>
              <h3 className={styles.posterCardTitle}>Top Artists</h3>
              {top_artists?.slice(0, 5).map((a, i) => (
                i === 0 ? (
                  <div key={i} className={styles.posterHeroCard}>
                    <span className={styles.posterHeroCrown}>#1 Artist</span>
                    <span className={styles.posterHeroName}>{a.name}</span>
                  </div>
                ) : (
                  <div key={i} className={styles.posterRow}>
                    <span className={styles.posterNum}>{i + 1}</span>
                    <span className={styles.posterName}>{a.name}</span>
                  </div>
                )
              ))}
            </div>

            <div className={styles.posterCard}>
              <h3 className={styles.posterCardTitle}>Top Songs</h3>
              {top_songs?.slice(0, 5).map((s, i) => (
                i === 0 ? (
                  <div key={i} className={styles.posterHeroCard}>
                    <span className={styles.posterHeroCrown}>#1 Song</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className={styles.posterHeroName}>{s.name}</span>
                      <span style={{ fontSize: '28px', color: '#ffb3b3', marginTop: '4px' }}>{s.artist}</span>
                    </div>
                  </div>
                ) : (
                  <div key={i} className={styles.posterRow}>
                    <span className={styles.posterNum}>{i + 1}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span className={styles.posterName}>{s.name}</span>
                      {/* Removed truncation, added line-height so wrapped text looks clean */}
                      <span style={{ fontSize: '20px', color: '#888', lineHeight: '1.3', marginTop: '4px' }}>{s.artist}</span>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          <div className={styles.posterFooter}>YT Music Unwrapped</div>
        </div>
      </div>
    <div className={styles.capsuleWrapper}>
      {/* We wrap the content in a div with the ref, so the snapshot only captures the stats, not the whole page background */}
      <div className={styles.capsule} style={{ padding: '24px' }}>
        
        {/* ── NEW: Snapshot Header (Only visible during screenshot!) ── */}
        {isDownloading && (
          <div className={styles.snapshotHeader}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#FF0000"/>
              <circle cx="12" cy="12" r="4.5" fill="white"/>
              <circle cx="12" cy="12" r="2" fill="#FF0000"/>
            </svg>
            <h2 className={styles.snapshotTitle}>{monthLabel} Unwrapped</h2>
          </div>
        )}

        {/* ── 1. Immersive Story Hero ── */}
        <div className={styles.storySection}>
          {/* Playtime Poster */}
          <div className={styles.storyCard}>
            <div className={styles.storyGlow} />
            <p className={styles.storyPreTitle}>Total Playtime</p>
            <h2 className={styles.storyMassiveStat}>
              {Math.round(total_minutes).toLocaleString()}
              <span className={styles.storyUnit}>mins</span>
            </h2>
            <p className={styles.storySubTitle}>That's <strong>{hrs}h {mins}m</strong> of pure vibes.</p>
          </div>

          {/* Streak Poster */}
          <div className={styles.storyCard}>
            <p className={styles.storyPreTitle}>Biggest Obsession</p>
            {streak ? (
              <>
                <h2 className={styles.storyMassiveStat}>{streak.days}<span className={styles.storyUnit}>days</span></h2>
                <p className={styles.storySubTitle}>
                  straight listening to 
                  <strong style={{ display: 'block', marginTop: '6px', lineHeight: '1.2' }}>
                    {streak.artist}
                  </strong>
                </p>
              </>
            ) : (
              <p className={styles.empty}>Keep listening to build a streak!</p>
            )}
          </div>

          {/* Discovery Poster (Full Width) */}
        <div className={styles.storyCard}>
          <p className={styles.storyPreTitle}>Your Discovery</p>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8%', flexWrap: 'wrap', zIndex: 1, width: '100%', marginTop: '8px' }}>
            
            <div style={{ flex: 1, textAlign: 'right' }}>
              <h2 className={styles.storyMassiveStat} style={{ fontSize: 'clamp(36px, 6vw, 64px)', marginBottom: '4px' }}>
                {uniqueArtistsCount.toLocaleString()}
              </h2>
              <p className={styles.storySubTitle}>Unique Artists</p>
            </div>

            {/* Vertical Divider */}
            <div style={{ width: '2px', height: '60px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }} />

            <div style={{ flex: 1, textAlign: 'left' }}>
              <h2 className={styles.storyMassiveStat} style={{ fontSize: 'clamp(36px, 6vw, 64px)', marginBottom: '4px' }}>
                {uniqueSongsCount.toLocaleString()}
              </h2>
              <p className={styles.storySubTitle}>Unique Songs</p>
            </div>

          </div>
        </div>
        </div>

        {/* ── 2. Top Boards (User Toggleable 5 or 10) ── */}
        <div className={styles.rankingsSection}>
          <div className={styles.historyHeader}>
            <div className={styles.sectionLabel}>Your Top {showTop10 ? '10' : '5'}</div>
            <button 
              className={styles.showMore} 
              style={{ padding: '6px 16px', fontSize: '11px', marginTop: '-4px' }} 
              onClick={() => setShowTop10(!showTop10)}
            >
              {showTop10 ? 'View Top 5' : 'View Top 10'}
            </button>
          </div>
          <div className={styles.rankingsGrid}>
            <TopRankings 
              top_artists={top_artists?.slice(0, showTop10 ? 10 : 5)} 
              top_songs={top_songs?.slice(0, showTop10 ? 10 : 5)} 
              top_albums={top_albums?.slice(0, showTop10 ? 10 : 5)} 
              top_music_directors={top_music_directors?.slice(0, showTop10 ? 10 : 5)}
              maxArtist={maxArtist} 
              maxSong={maxSong} 
              maxDirector={maxDirector}
              setArtistDetail={setArtistDetail} 
            />
          </div>
        </div>

        {/* ── 3. Patterns ── */}
        <TimeBreakdown weekly={weekly_breakdown} dow={day_of_week} hours={hour_heatmap} />

      </div> {/* End of snapshot reference */}

      {/* ── Share / Download Button ── */}
      <div className={styles.shareActionContainer}>
        <button 
          className={styles.shareBtn} 
          onClick={handleDownload} 
          disabled={isDownloading}
        >
          {isDownloading ? (
            <span className={styles.shareLoading}>Capturing Magic...</span>
          ) : (
            <>
              {/* Using a standard 'Share' icon instead of a 'Download' icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              Share Unwrapped Snapshot
            </>
          )}
        </button>
      </div>

      {/* ── 4. Full History (RESTORED!) ── */}
      <div style={{ marginTop: '32px' }}>
        <HistorySection history={history} onRefresh={onRefresh} />
      </div>

      {/* ── Artist detail drawer ── */}
      {artistDetail && (
        <div className={styles.drawerOverlay} onClick={() => setArtistDetail(null)}>
          <div className={styles.drawer} onClick={e => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.drawerSub}>Artist breakdown</p>
                <h3 className={styles.drawerTitle}>{artistDetail}</h3>
              </div>
              <button className={styles.drawerClose} onClick={() => setArtistDetail(null)}>✕</button>
            </div>
            <div className={styles.drawerBody}>
              {artistSongs.length === 0 ? (
                <p className={styles.empty}>No songs found</p>
              ) : (
                <ol className={styles.drawerList}>
                  {artistSongs.map((s, i) => (
                    <li key={i} className={styles.drawerItem}>
                      <span className={styles.drawerIdx}>{i + 1}</span>
                      <span className={styles.drawerSongName}>{s.title}</span>
                      <span className={styles.drawerPlays}>{s.plays}×</span>
                      <span className={styles.drawerMins}>{formatMinutes(s.minutes)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  )
}