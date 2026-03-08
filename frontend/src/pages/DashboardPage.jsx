import { useState, useMemo } from 'react'
import styles from './DashboardPage.module.css'
import MonthCapsule from '../components/MonthCapsule.jsx'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function DashboardPage({ data }) {
  const { months_available, monthly_stats, summary } = data

  const [selectedMonth, setSelectedMonth] = useState(() => months_available[months_available.length - 1])

  const capsuleData = useMemo(() => {
    return monthly_stats[selectedMonth] || null
  }, [monthly_stats, selectedMonth])

  const [year, month] = selectedMonth.split('-').map(Number)

  return (
    <div className={styles.page}>
      {/* Summary strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryVal}>{summary.total_plays.toLocaleString()}</span>
          <span className={styles.summaryLabel}>Total Plays</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryVal}>{months_available.length}</span>
          <span className={styles.summaryLabel}>Months of Data</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryVal}>{summary.unique_artists.toLocaleString()}</span>
          <span className={styles.summaryLabel}>Unique Artists</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryVal}>{summary.unique_songs.toLocaleString()}</span>
          <span className={styles.summaryLabel}>Unique Songs</span>
        </div>
      </div>

      {/* Month picker */}
      <div className={styles.monthSection}>
        <p className={styles.monthLabel}>Select a month</p>
        <div className={styles.monthGrid}>
          {months_available.map(m => {
            const [y, mo] = m.split('-').map(Number)
            const isSelected = m === selectedMonth
            return (
              <button
                key={m}
                className={`${styles.monthChip} ${isSelected ? styles.monthChipActive : ''}`}
                onClick={() => setSelectedMonth(m)}
              >
                <span className={styles.chipMonth}>{MONTH_NAMES[mo - 1]}</span>
                <span className={styles.chipYear}>{y}</span>
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
          <MonthCapsule data={capsuleData} />
        </div>
      )}
    </div>
  )
}