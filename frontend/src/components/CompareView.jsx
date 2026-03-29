import React from 'react'
import styles from './CompareView.module.css'

function formatDetailedTime(total_minutes) {
  if (!total_minutes || total_minutes === 0) return '0m'
  const d_days = Math.floor(total_minutes / (60 * 24))
  const d_hrs  = Math.floor((total_minutes % (60 * 24)) / 60)
  const d_mins = Math.round(total_minutes % 60)
  
  const parts = [];
  if (d_days > 0) parts.push(`${d_days}d`);
  if (d_hrs > 0) parts.push(`${d_hrs}h`);
  if (d_mins > 0 || parts.length === 0) parts.push(`${d_mins}m`);
  
  return parts.join(' ');
}

function Top5List({ title, myItems = [], friendItems = [], friendName }) {
  const maxLen = Math.max(
    Math.min(myItems?.length || 0, 5), 
    Math.min(friendItems?.length || 0, 5)
  );
  if (maxLen === 0) return null;
  
  return (
    <div className={styles.listCard}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <div className={styles.listHeader}>
        <span className={styles.listWhoSide}>You</span>
        <span className={styles.listWhoCenter}>#</span>
        <span className={styles.listWhoSide} style={{ textAlign: 'right' }}>{friendName}</span>
      </div>
      <div className={styles.listBody}>
        {Array.from({ length: 5 }).map((_, i) => {
          const mine = myItems?.[i];
          const theirs = friendItems?.[i];
          if (!mine && !theirs) return null;
          
          return (
            <div key={i} className={styles.listRow}>
              <div className={styles.listColLeft}>
                {mine ? (
                  <>
                    <span className={styles.listItemName}>{mine.name}</span>
                    <span className={styles.listItemSub}>
                      {mine.artist && `${mine.artist} • `}
                      {mine.plays ? `${mine.plays} plays` : mine.minutes ? `${mine.minutes} mins` : ''}
                    </span>
                  </>
                ) : <span className={styles.listItemSub}>-</span>}
              </div>
              <div className={styles.listColCenter}>{i + 1}</div>
              <div className={styles.listColRight}>
                {theirs ? (
                  <>
                    <span className={styles.listItemName}>{theirs.name}</span>
                    <span className={styles.listItemSub}>
                      {theirs.plays ? `${theirs.plays} plays` : theirs.minutes ? `${theirs.minutes} mins` : ''}
                      {theirs.artist && ` • ${theirs.artist}`}
                    </span>
                  </>
                ) : <span className={styles.listItemSub}>-</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
}

export default function CompareView({ myData, friendData, friendName, periodLabel, onGoBack }) {
  if (!myData || !friendData) return null;

  const myMins = Math.round(myData.total_minutes || 0);
  const friendMins = Math.round(friendData.total_minutes || 0);
  const totalMins = myMins + friendMins;
  const myMinsScale = Math.max((myMins / totalMins) * 100, 5);
  const friendMinsScale = Math.max((friendMins / totalMins) * 100, 5);

  const winnerPlaytime = myMins > friendMins ? 'You' : (friendMins > myMins ? friendName : 'Tie');

  return (
    <div className={styles.compareWrapper}>
      <button className={styles.backBtn} onClick={onGoBack}>
        ← Back to Dashboard
      </button>

      <div className={styles.header}>
        <h2 className={styles.title}>VS Battle: {periodLabel}</h2>
        <div className={styles.versusStrip}>
          <span className={styles.nameBadge}>You</span>
          <span className={styles.vsIcon}>⚔️</span>
          <span className={styles.nameBadgeOff}>{friendName}</span>
        </div>
      </div>

      <div className={styles.grid}>
        
        {/* Playtime Battle */}
        <div className={styles.cardFull}>
          <h3 className={styles.cardTitle}>Total Playtime</h3>
          <p className={styles.cardSub}>{winnerPlaytime} listened more this period!</p>
          
          <div className={styles.barsContainer}>
            <div className={styles.barWrapper}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
                  <span className={styles.barLabel}>You</span>
                  <span className={styles.barPill}>{myMins.toLocaleString()} mins  <span style={{ opacity: 0.6, marginLeft: '6px', fontWeight: 500 }}>({formatDetailedTime(myMins)})</span></span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${myMinsScale}%`, background: 'var(--yt-red)' }} />
              </div>
            </div>
            
            <div className={styles.barWrapper}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
                  <span className={styles.barLabel} style={{ color: '#ff8800' }}>{friendName}</span>
                  <span className={styles.barPill}>{friendMins.toLocaleString()} mins <span style={{ opacity: 0.6, marginLeft: '6px', fontWeight: 500 }}>({formatDetailedTime(friendMins)})</span></span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${friendMinsScale}%`, background: '#ff8800' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Unique Artists */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Variety (Unique Artists)</h3>
          <div className={styles.splitBox}>
            <div className={styles.splitSideCenter}>
              <span className={styles.splitMassive}>{myData.unique_artists || 0}</span>
              <span className={styles.splitWho}>You</span>
            </div>
            <div className={styles.splitDivider} />
            <div className={styles.splitSideCenter}>
              <span className={styles.splitMassive} style={{ color: '#ffb3b3'}}>{friendData.unique_artists || 0}</span>
              <span className={styles.splitWho}>{friendName}</span>
            </div>
          </div>
        </div>
        
        {/* Unique Songs */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Exploration (Unique Songs)</h3>
          <div className={styles.splitBox}>
            <div className={styles.splitSideCenter}>
              <span className={styles.splitMassive}>{myData.unique_songs || 0}</span>
              <span className={styles.splitWho}>You</span>
            </div>
            <div className={styles.splitDivider} />
            <div className={styles.splitSideCenter}>
              <span className={styles.splitMassive} style={{ color: '#ffb3b3'}}>{friendData.unique_songs || 0}</span>
              <span className={styles.splitWho}>{friendName}</span>
            </div>
          </div>
        </div>

        {/* Detailed Top 5 Battles */}
        <div className={styles.cardFull}>
           <Top5List title="Top 5 Songs" myItems={myData.top_songs} friendItems={friendData.top_songs} friendName={friendName} />
        </div>
        
        <div className={styles.cardFull}>
           <Top5List title="Top 5 Artists" myItems={myData.top_artists} friendItems={friendData.top_artists} friendName={friendName} />
        </div>
        
        <div className={styles.cardFull}>
           <Top5List title="Top 5 Albums" myItems={myData.top_albums} friendItems={friendData.top_albums} friendName={friendName} />
        </div>
        
        {/* Only show Music Directors if there's data */}
        {(myData.top_music_directors?.length > 0 || friendData.top_music_directors?.length > 0) && (
          <div className={styles.cardFull}>
             <Top5List title="Top 5 Music Directors" myItems={myData.top_music_directors} friendItems={friendData.top_music_directors} friendName={friendName} />
          </div>
        )}

      </div>
    </div>
  )
}
