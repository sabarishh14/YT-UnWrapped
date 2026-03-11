import styles from './Navbar.module.css'

const YTMusicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#FF0000"/>
    <circle cx="12" cy="12" r="4.5" fill="white"/>
    <circle cx="12" cy="12" r="2" fill="#FF0000"/>
  </svg>
)

export default function Navbar({ onReset, fileName }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <button className={styles.brand} onClick={onReset || undefined}>
          <YTMusicIcon />
          <span className={styles.brandText}>
            <span className={styles.brandYT}>YT Music</span>
            <span className={styles.brandStats}>UnWrapped</span>
          </span>
        </button>

        <div className={styles.right}>
          {fileName && (
            <span className={styles.fileName} title={fileName}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {fileName}
            </span>
          )}
          {onReset && (
            <button className={styles.resetBtn} onClick={onReset}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
              New file
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}