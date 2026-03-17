import styles from './Navbar.module.css'

const YTMusicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#FF0000"/>
    <circle cx="12" cy="12" r="4.5" fill="white"/>
    <circle cx="12" cy="12" r="2" fill="#FF0000"/>
  </svg>
)

export default function Navbar({ onGoBack, onClear, onLogout, fileName }) {  
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <button className={styles.brand} onClick={onGoBack || undefined}>
          <YTMusicIcon />
          <span className={styles.brandText}>
            <span className={styles.brandYT}>YT Music</span>
            <span className={styles.brandUnwrapped}>Un-Wrapped</span>
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
          
          {/* Add Data Button */}
          {onGoBack && (
            <button className={styles.resetBtn} onClick={onGoBack}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Data
            </button>
          )}

          {/* Clear Data Button */}
          {onClear && (
            <button className={styles.resetBtn} onClick={onClear} style={{ color: '#ffaa00', borderColor: 'rgba(255,170,0,0.2)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear Data
            </button>
          )}

          {/* Logout Button */}
          {onLogout && (
            <button className={styles.resetBtn} onClick={onLogout} style={{ color: '#ff4444', borderColor: 'rgba(255,0,0,0.2)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}