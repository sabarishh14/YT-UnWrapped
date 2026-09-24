import { useState, useMemo, useEffect, useRef } from 'react'
import styles from './DashboardPage.module.css'
import MonthCapsule from '../components/MonthCapsule.jsx'
import YearWrappedCapsule from '../components/YearWrappedCapsule.jsx'
import AllTimeCapsule from '../components/AllTimeCapsule.jsx'
import CompareView from '../components/CompareView.jsx'
import { apiFetch, API_BASE } from '../api.js'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const ALL_TIME = 'all'

function labelFor(period) {
  if (period === ALL_TIME) return 'All Time'
  if (!period.includes('-')) return `${period} Wrapped`
  const [y, m] = period.split('-').map(Number)
  return `${FULL_MONTH_NAMES[m - 1]} ${y}`
}

// A friend's stats for one period, shaped for CompareView. Throws with a
// readable message if they have no stats for it.
async function loadFriendComparison(friend, period) {
  const res = await apiFetch(`/api/friends/${friend.code}/compare?period=${encodeURIComponent(period)}`)
  const d = await res.json()
  if (!res.ok) throw new Error(d.error || "Couldn't load your friend's stats.")
  if (!d.data) throw new Error(`${friend.name} doesn't have stats for ${labelFor(period)} yet.`)
  return { stats: d.data, name: friend.name, blend: d.blend, lastSynced: d.last_synced }
}

// VS Battle: pick a friend (live stats for this period) or paste a share link.
function CompareAction({ onPickFriend, onResult }) {
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    apiFetch('/api/friends')
      .then(res => res.json())
      .then(d => setFriends(d.friends || []))
      .catch(() => setFriends([]))
  }, [open])

  const compareWithFriend = async (friend) => {
    setBusy(friend.code)
    setError('')
    try {
      await onPickFriend(friend)
    } catch (e) {
      setError(e.message || "Couldn't load your friend's stats.")
    }
    setBusy(null)
  }

  const compareWithLink = async () => {
    let t = token.trim()
    if (!t) return
    if (t.includes('/share/')) t = t.split('/share/')[1].split('?')[0]
    setBusy('link')
    setError('')
    try {
      const d = await (await fetch(`${API_BASE}/api/shared/${t}`)).json()
      if (d.error) throw new Error(d.error)
      onResult({ stats: d.dashboard_data, name: d.dashboard_data.shared_by || 'Friend' })
    } catch (e) {
      setError(e.message || "Failed to fetch friend's data.")
    }
    setBusy(null)
  }

  if (!open) {
    return (
      <div className={styles.compareActionWrapper}>
        <button className={styles.compareToggleBtn} onClick={() => setOpen(true)}>⚔️ VS Battle</button>
      </div>
    )
  }

  return (
    <div className={styles.compareActionWrapper}>
      <div className={styles.comparePanel}>
        <p className={styles.comparePanelLabel}>Battle a friend</p>
        {friends === null ? (
          <span className={styles.spinner} />
        ) : friends.length === 0 ? (
          <p className={styles.compareHint}>No friends yet - add one with their friend code in Settings.</p>
        ) : (
          <div className={styles.friendChips}>
            {friends.map(f => (
              <button
                key={f.code}
                className={styles.friendChip}
                disabled={!!busy}
                onClick={() => compareWithFriend(f)}
              >
                {f.photo ? <img src={f.photo} alt="" referrerPolicy="no-referrer" /> : <span className={styles.friendInitial}>{f.name[0]}</span>}
                {busy === f.code ? <span className={styles.spinner} /> : f.name}
              </button>
            ))}
          </div>
        )}

        <div className={styles.linkRow}>
          <input
            type="text"
            placeholder="…or paste a share link"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && compareWithLink()}
            disabled={!!busy}
          />
          <button onClick={compareWithLink} disabled={!!busy || !token.trim()}>
            {busy === 'link' ? <span className={styles.spinner} /> : 'Go'}
          </button>
        </div>

        {error && <p className={styles.compareError}>{error}</p>}
        <button className={styles.compareCancel} onClick={() => { setOpen(false); setError('') }}>Cancel</button>
      </div>
    </div>
  )
}

export default function DashboardPage({ data, onRefresh }) {
  const { months_available, monthly_stats, yearly_stats, summary, all_time } = data

  const [selectedMonth, setSelectedMonth] = useState(() => months_available[months_available.length - 1])
  const [friendData, setFriendData] = useState(null)
  const [viewYear, setViewYear] = useState(() => months_available[months_available.length - 1].split('-')[0])

  const availableYears = useMemo(() => {
    const years = new Set(months_available.map(m => m.split('-')[0]))
    return Array.from(years).sort((a, b) => b - a) // Show newest years first
  }, [months_available])

  const monthsForViewYear = useMemo(() => {
    return months_available.filter(m => m.startsWith(viewYear))
  }, [months_available, viewYear])

  const isAllTime = selectedMonth === ALL_TIME
  const isYearView = !isAllTime && !selectedMonth.includes('-')

  const capsuleData = useMemo(() => {
    if (isAllTime) return all_time
    return isYearView ? yearly_stats?.[selectedMonth] : monthly_stats?.[selectedMonth]
  }, [monthly_stats, yearly_stats, all_time, selectedMonth, isYearView, isAllTime])

  const [year, month] = selectedMonth.split('-').map(Number)
  const periodLabel = labelFor(selectedMonth)

  // The friend you're battling stays selected while you switch periods, so
  // clicking another month / year / All Time loads *their* stats for it too.
  // (A pasted share link is a snapshot of one period, so switching ends it.)
  const [opponent, setOpponent] = useState(null)
  const [battleStatus, setBattleStatus] = useState({ loading: false, error: '' })
  const latestRequest = useRef(0)

  const pickFriend = async (friend) => {
    const result = await loadFriendComparison(friend, selectedMonth)  // throws -> shown in the picker
    setOpponent(friend)
    setFriendData(result)
    setBattleStatus({ loading: false, error: '' })
  }

  const endBattle = () => {
    latestRequest.current++  // ignore any in-flight period load
    setOpponent(null)
    setFriendData(null)
    setBattleStatus({ loading: false, error: '' })
  }

  const select = async (period) => {
    setSelectedMonth(period)
    if (!opponent) {
      setFriendData(null)
      return
    }
    const request = ++latestRequest.current
    setBattleStatus({ loading: true, error: '' })
    try {
      const result = await loadFriendComparison(opponent, period)
      if (request !== latestRequest.current) return  // a newer click won
      setFriendData(result)
      setBattleStatus({ loading: false, error: '' })
    } catch (e) {
      if (request !== latestRequest.current) return
      setFriendData(null)
      setBattleStatus({ loading: false, error: e.message })
    }
  }

  const inBattle = opponent || friendData

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

      {/* ── Year Wrapped + All-Time ── */}
      <div className={styles.bigButtons}>
        {yearly_stats && yearly_stats[viewYear] && (
          <button
            className={selectedMonth === viewYear ? styles.yearWrappedBtnActive : styles.yearWrappedBtn}
            style={{ marginTop: 0, padding: '20px', borderRadius: '24px' }}
            onClick={() => select(viewYear)}
          >
             ✨ View {viewYear} Year Wrapped ✨
          </button>
        )}
        {all_time && (
          <button
            className={isAllTime ? styles.yearWrappedBtnActive : styles.yearWrappedBtn}
            style={{ marginTop: 0, padding: '20px', borderRadius: '24px' }}
            onClick={() => select(ALL_TIME)}
          >
            ∞ All-Time Stats
          </button>
        )}
      </div>

      {/* ── Timeline Explorer ── */}
      <div className={styles.monthSection}>
        <div className={styles.yearScroller}>
          {availableYears.map(y => (
            <button
              key={y}
              className={`${styles.yearChip} ${y === viewYear ? styles.yearChipActive : ''}`}
              onClick={() => setViewYear(y)}
            >
              {y}
            </button>
          ))}
        </div>

        <div className={styles.monthGrid}>
          {monthsForViewYear.map(m => {
            const [, mo] = m.split('-').map(Number)
            return (
              <button
                key={m}
                className={`${styles.monthChip} ${m === selectedMonth ? styles.monthChipActive : ''}`}
                onClick={() => select(m)}
              >
                {MONTH_NAMES[mo - 1]}
              </button>
            )
          })}
        </div>
      </div>

      {inBattle ? (
        battleStatus.loading || battleStatus.error || !friendData || !capsuleData ? (
          <div className={styles.battleStatus}>
            {battleStatus.loading ? (
              <>
                <span className={styles.spinner} />
                <p>Loading {opponent?.name}'s {periodLabel}…</p>
              </>
            ) : (
              <p>{battleStatus.error || `You don't have stats for ${periodLabel} yet.`}</p>
            )}
            <button className={styles.compareToggleBtn} onClick={endBattle}>← Back to my stats</button>
          </div>
        ) : (
          <CompareView
            myData={capsuleData}
            friendData={friendData.stats}
            friendName={friendData.name}
            blend={friendData.blend}
            lastSynced={friendData.lastSynced}
            periodLabel={periodLabel}
            onGoBack={endBattle}
          />
        )
      ) : capsuleData && (
        <div className={styles.capsuleSection}>
          <div className={styles.capsuleHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isAllTime ? (
                <>
                  <h2 className={styles.capsuleTitle}>
                    <span className={styles.capTitleMonth}>All Time</span>
                  </h2>
                  <div className={styles.capsuleBadge} style={{ alignSelf: 'flex-start' }}>Lifetime</div>
                </>
              ) : isYearView ? (
                <>
                  <h2 className={styles.capsuleTitle}>
                    <span className={styles.capTitleMonth}>{selectedMonth}</span>
                    <span className={styles.capTitleYear}>Wrapped</span>
                  </h2>
                  <div className={styles.capsuleBadge} style={{ background: 'rgba(255,0,0,0.15)', borderColor: 'rgba(255,0,0,0.4)', color: '#ffb3b3', alignSelf: 'flex-start'}}>Yearly Recap</div>
                </>
              ) : (
                <>
                  <h2 className={styles.capsuleTitle}>
                    <span className={styles.capTitleMonth}>{FULL_MONTH_NAMES[month - 1]}</span>
                    <span className={styles.capTitleYear}>{year}</span>
                  </h2>
                  <div className={styles.capsuleBadge} style={{ alignSelf: 'flex-start' }}>Monthly Capsule</div>
                </>
              )}
            </div>

            <CompareAction key={selectedMonth} onPickFriend={pickFriend} onResult={setFriendData} />
          </div>

          {isAllTime ? (
            <AllTimeCapsule data={capsuleData} />
          ) : isYearView ? (
            <YearWrappedCapsule
              data={capsuleData}
              yearLabel={selectedMonth}
              onRefresh={onRefresh}
              artistProfiles={all_time?.artist_profiles}
            />
          ) : (
            <MonthCapsule
              data={capsuleData}
              monthLabel={`${FULL_MONTH_NAMES[month - 1]} ${year}`}
              onRefresh={onRefresh}
              artistProfiles={all_time?.artist_profiles}
            />
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '40px', color: '#666', fontSize: '13px', fontWeight: '500', letterSpacing: '1px' }}>
        © {new Date().getFullYear()} SB Creations. All rights reserved.
      </div>
    </div>
  )
}
