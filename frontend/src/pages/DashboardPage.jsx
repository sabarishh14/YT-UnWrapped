import { useState, useMemo } from 'react'
import styles from './DashboardPage.module.css'
import MonthCapsule from '../components/MonthCapsule.jsx'
import YearWrappedCapsule from '../components/YearWrappedCapsule.jsx'
import CompareView from '../components/CompareView.jsx'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function DashboardPage({ data, onRefresh }) {
  const { months_available, monthly_stats, yearly_stats, summary } = data

  const [selectedMonth, setSelectedMonth] = useState(() => months_available[months_available.length - 1])
  
  // Compare State
  const [isComparing, setIsComparing] = useState(false)
  const [compareToken, setCompareToken] = useState("")
  const [friendData, setFriendData] = useState(null)
  const [compareError, setCompareError] = useState("")
  const [isCompareLoading, setIsCompareLoading] = useState(false)

  // --- ADD THESE NEW LINES ---
  const [viewYear, setViewYear] = useState(() => months_available[months_available.length - 1].split('-')[0])

  const availableYears = useMemo(() => {
    const years = new Set(months_available.map(m => m.split('-')[0]))
    return Array.from(years).sort((a, b) => b - a) // Show newest years first
  }, [months_available])

  const monthsForViewYear = useMemo(() => {
    return months_available.filter(m => m.startsWith(viewYear))
  }, [months_available, viewYear])

  const isYearView = !selectedMonth.includes('-');
  
  const capsuleData = useMemo(() => {
    return isYearView ? yearly_stats?.[selectedMonth] : monthly_stats?.[selectedMonth]
  }, [monthly_stats, yearly_stats, selectedMonth, isYearView])

  const [year, month] = selectedMonth.split('-').map(Number)

  const handleCompare = async () => {
    if (!compareToken.trim()) return;
    setIsCompareLoading(true);
    setCompareError("");
    
    let token = compareToken.trim();
    if (token.includes('/share/')) token = token.split('/share/')[1].split('?')[0];
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/shared/${token}`);
      const d = await res.json();
      if (d.error) setCompareError(d.error);
      else setFriendData(d);
    } catch (e) {
      setCompareError("Failed to fetch friend's data.");
    }
    setIsCompareLoading(false);
  };

  return (
    <div className={styles.page}>
      {/* Lifetime Hero */}
      <div className={styles.lifetimeHero}>
        <h1 className={styles.lifetimeHeadline}>
          Across <span className={styles.highlight}>{months_available.length}</span> {months_available.length === 1 ? 'month' : 'months'}, you've played <span className={styles.highlight}>{summary.total_plays.toLocaleString()}</span> tracks.
        </h1>
        <p className={styles.lifetimeSub}>
          Discovering <span className={styles.highlightSub}>{summary.unique_artists.toLocaleString()}</span> artists and <span className={styles.highlightSub}>{summary.unique_songs.toLocaleString()}</span> unique songs along the way.
        </p>
      </div>

      {/* ── Year Wrapped Section ── */}
      {yearly_stats && yearly_stats[viewYear] && (
        <div style={{ marginBottom: '12px' }}>
          <button 
            className={selectedMonth === viewYear ? styles.yearWrappedBtnActive : styles.yearWrappedBtn}
            style={{ marginTop: 0, padding: '20px', borderRadius: '24px' }}
            onClick={() => { setSelectedMonth(viewYear); setFriendData(null); setIsComparing(false); }}
          >
             ✨ View {viewYear} Year Wrapped ✨
          </button>
        </div>
      )}

      {/* ── Timeline Explorer ── */}
      <div className={styles.monthSection}>
        <div className={styles.yearScroller}>
          {availableYears.map(year => (
            <button
              key={year}
              className={`${styles.yearChip} ${year === viewYear ? styles.yearChipActive : ''}`}
              onClick={() => setViewYear(year)}
            >
              {year}
            </button>
          ))}
        </div>

        <div className={styles.monthGrid}>
          {monthsForViewYear.map(m => {
            const [, mo] = m.split('-').map(Number)
            const isSelected = m === selectedMonth
            return (
              <button
                key={m}
                className={`${styles.monthChip} ${isSelected ? styles.monthChipActive : ''}`}
                onClick={() => { setSelectedMonth(m); setFriendData(null); setIsComparing(false); }}
              >
                {MONTH_NAMES[mo - 1]}
              </button>
            )
          })}
        </div>
      </div>

      {friendData && capsuleData ? (
        <CompareView 
          myData={capsuleData}
          friendData={friendData.dashboard_data}
          friendName={friendData.dashboard_data.shared_by || "Friend"}
          periodLabel={isYearView ? `${selectedMonth} Wrapped` : `${FULL_MONTH_NAMES[month - 1]} ${year}`}
          onGoBack={() => { setFriendData(null); setIsComparing(false); setCompareToken(""); }}
        />
      ) : (
        <>
          {capsuleData && !isYearView && (
            <div className={styles.capsuleSection}>
              <div className={styles.capsuleHeader}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   <h2 className={styles.capsuleTitle}>
                     <span className={styles.capTitleMonth}>{FULL_MONTH_NAMES[month - 1]}</span>
                     <span className={styles.capTitleYear}>{year}</span>
                   </h2>
                   <div className={styles.capsuleBadge} style={{ alignSelf: 'flex-start' }}>Monthly Capsule</div>
                </div>
                
                {/* Compare Action */}
                <div className={styles.compareActionWrapper}>
                  {!isComparing ? (
                    <button className={styles.compareToggleBtn} onClick={() => setIsComparing(true)}>⚔️ VS Battle</button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '100%', width: '320px' }}>
                      <div style={{ display: 'flex', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                        <input 
                          type="text" 
                          placeholder="Paste Friend's Link..." 
                          value={compareToken}
                          onChange={(e) => setCompareToken(e.target.value)}
                          disabled={isCompareLoading}
                          style={{ flex: 1, padding: '12px 16px', background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: '14px', minWidth: 0 }}
                        />
                        <button 
                          disabled={isCompareLoading}
                          onClick={handleCompare}
                          style={{ padding: '0 20px', background: isCompareLoading ? 'rgba(255,0,0,0.5)' : 'var(--yt-red)', color: 'white', border: 'none', fontWeight: 700, cursor: isCompareLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          {isCompareLoading ? <span className={styles.spinner} /> : 'VS Battle'}
                        </button>
                      </div>
                      <button onClick={() => { setIsComparing(false); setCompareError(""); }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', alignSelf: 'flex-start', paddingLeft: '16px' }}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
              
              {compareError && <div style={{ color: '#ffb3b3', fontSize: '14px', background: 'rgba(255,0,0,0.1)', padding: '12px 16px', borderRadius: '8px' }}>Error: {compareError}</div>}
              
              <MonthCapsule 
                data={capsuleData} 
                monthLabel={`${FULL_MONTH_NAMES[month - 1]} ${year}`} 
                onRefresh={onRefresh}
              />
            </div>
          )}

          {capsuleData && isYearView && (
            <div className={styles.capsuleSection}>
              <div className={styles.capsuleHeader}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h2 className={styles.capsuleTitle}>
                    <span className={styles.capTitleMonth}>{selectedMonth}</span>
                    <span className={styles.capTitleYear}>Wrapped</span>
                  </h2>
                  <div className={styles.capsuleBadge} style={{ background: 'rgba(255,0,0,0.15)', borderColor: 'rgba(255,0,0,0.4)', color: '#ffb3b3', alignSelf: 'flex-start'}}>Yearly Recap</div>
                </div>

                {/* Compare Action for Year */}
                <div className={styles.compareActionWrapper}>
                  {!isComparing ? (
                    <button className={styles.compareToggleBtn} onClick={() => setIsComparing(true)}>⚔️ VS Battle</button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '100%', width: '320px' }}>
                      <div style={{ display: 'flex', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                        <input 
                          type="text" 
                          placeholder="Paste Friend's Link..." 
                          value={compareToken}
                          onChange={(e) => setCompareToken(e.target.value)}
                          disabled={isCompareLoading}
                          style={{ flex: 1, padding: '12px 16px', background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: '14px', minWidth: 0 }}
                        />
                        <button 
                          disabled={isCompareLoading}
                          onClick={handleCompare}
                          style={{ padding: '0 20px', background: isCompareLoading ? 'rgba(255,0,0,0.5)' : 'var(--yt-red)', color: 'white', border: 'none', fontWeight: 700, cursor: isCompareLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          {isCompareLoading ? <span className={styles.spinner} /> : 'VS Battle'}
                        </button>
                      </div>
                      <button onClick={() => { setIsComparing(false); setCompareError(""); }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', alignSelf: 'flex-start', paddingLeft: '16px' }}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>

              {compareError && <div style={{ color: '#ffb3b3', fontSize: '14px', background: 'rgba(255,0,0,0.1)', padding: '12px 16px', borderRadius: '8px' }}>Error: {compareError}</div>}

              <YearWrappedCapsule 
                data={capsuleData} 
                yearLabel={selectedMonth} 
                onRefresh={onRefresh}
              />
            </div>
          )}
        </>
      )}

      {/* NEW: SB Creations Copyright Footer */}
      <div style={{ textAlign: 'center', marginTop: '40px', color: '#666', fontSize: '13px', fontWeight: '500', letterSpacing: '1px' }}>
        © {new Date().getFullYear()} SB Creations. All rights reserved.
      </div>
      
    </div>
  )
}