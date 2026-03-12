import { useState, useMemo } from 'react'
import styles from './DashboardPage.module.css'
import MonthCapsule from '../components/MonthCapsule.jsx'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function DashboardPage({ data }) {
  const { months_available, monthly_stats, summary } = data

  const [selectedMonth, setSelectedMonth] = useState(() => months_available[months_available.length - 1])
  
  // --- ADD THESE NEW LINES ---
  const [viewYear, setViewYear] = useState(() => months_available[months_available.length - 1].split('-')[0])

  const availableYears = useMemo(() => {
    const years = new Set(months_available.map(m => m.split('-')[0]))
    return Array.from(years).sort((a, b) => b - a) // Show newest years first
  }, [months_available])

  const monthsForViewYear = useMemo(() => {
    return months_available.filter(m => m.startsWith(viewYear))
  }, [months_available, viewYear])

  const capsuleData = useMemo(() => {
    return monthly_stats[selectedMonth] || null
  }, [monthly_stats, selectedMonth])

  const [year, month] = selectedMonth.split('-').map(Number)

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
                onClick={() => setSelectedMonth(m)}
              >
                {MONTH_NAMES[mo - 1]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Capsule */}
      {capsuleData && (
        <div className={styles.capsuleSection}>
          <div className={styles.capsuleHeader}>
            <h2 className={styles.capsuleTitle}>
              <span className={styles.capTitleMonth}>{FULL_MONTH_NAMES[month - 1]}</span>
              <span className={styles.capTitleYear}>{year}</span>
            </h2>
            <div className={styles.capsuleBadge}>Monthly Capsule</div>
          </div>
          <MonthCapsule 
            data={capsuleData} 
            monthLabel={`${FULL_MONTH_NAMES[month - 1]} ${year}`} 
          />
        </div>
      )}
    </div>
  )
}