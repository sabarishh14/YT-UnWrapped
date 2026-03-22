import { useState, useEffect } from 'react';
import { auth } from '../firebase.js'
import styles from './Navbar.module.css';

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const YTMusicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#FF0000"/>
    <circle cx="12" cy="12" r="4.5" fill="white"/>
    <circle cx="12" cy="12" r="2" fill="#FF0000"/>
  </svg>
)

export default function Navbar({ onGoBack, onClear, onLogout, fileName, onRefresh }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hiddenTracks, setHiddenTracks] = useState([]);
  const API_BASE = import.meta.env.VITE_API_URL || "";

  // 1. Fetch tracks instantly in the background so the modal never has to load!
  const fetchHiddenTracks = () => {
    if (auth.currentUser) {
       fetch(`${API_BASE}/api/hidden_tracks?user_id=${auth.currentUser.uid}`)
         .then(res => res.json())
         .then(data => setHiddenTracks(data.hidden_tracks || []))
         .catch(err => console.error(err));
    }
  };

  // Run on boot
  useEffect(() => {
    fetchHiddenTracks();
  }, [auth.currentUser]);

  // Listen for the "Hide" button click from the dashboard so the list stays updated
  useEffect(() => {
    window.addEventListener('trackHidden', fetchHiddenTracks);
    return () => window.removeEventListener('trackHidden', fetchHiddenTracks);
  }, []);

  const handleUnhide = async (video_id) => {
    // Instantly remove from the modal UI
    setHiddenTracks(prev => prev.filter(t => t.video_id !== video_id)); 
    
    // Tell the backend to restore it
    await fetch(`${API_BASE}/api/unhide_track`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ user_id: auth.currentUser.uid, video_id })
    });
    
    // Silently refresh the dashboard stats
    if (onRefresh) onRefresh();
  }

  return (
    <>
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

          {/* Settings Button (Replaces Clear/Logout) */}
          <button type="button" className={styles.resetBtn} onClick={() => setIsSettingsOpen(true)}>
            <GearIcon />
            Settings
          </button>
        </div>
      </div>
    </nav>

    {/* --- Settings Modal --- */}
    {isSettingsOpen && (
      <div className={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2>Settings</h2>
            <button className={styles.closeBtn} onClick={() => setIsSettingsOpen(false)}>✕</button>
          </div>
          
          <div className={styles.modalBody}>
            
            {/* 1. Cloud Sync Section */}
            <div className={styles.settingsSection} style={{ marginBottom: '16px' }}>
              <h3>Cloud Sync</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Fake Last.fm Red Badge */}
                  <div style={{ width: '32px', height: '32px', background: '#d51007', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                    fm
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: '600' }}>Last.fm</p>
                    <p style={{ margin: '2px 0 0 0', color: '#aaa', fontSize: '13px' }}>Scrobbling active</p>
                  </div>
                </div>
                {/* Active Status Pill */}
                <span style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                  Connected
                </span>
              </div>

              {/* --- NEW: Moved File Name / Last Sync Date Here --- */}
              {fileName && (
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  {fileName}
                </div>
              )}
            </div>

            {/* 2. Account & Data Section */}
            <div className={styles.settingsSection}>
              <h3>Account & Data</h3>
              <p className={styles.settingsText}>Manage your uploaded Takeout data or log out of your session.</p>
              
              <div className={styles.settingsActions}>
                {onClear && (
                  <button className={styles.dangerBtn} onClick={() => { onClear(); setIsSettingsOpen(false); }}>
                    Clear Data
                  </button>
                )}
                {onLogout && (
                  <button className={styles.dangerBtn} onClick={() => { onLogout(); setIsSettingsOpen(false); }}>
                    Logout
                  </button>
                )}
              </div>
            </div>

            {/* 3. Hidden Tracks Section */}
            <div className={styles.settingsSection} style={{ marginTop: '16px' }}>
              <h3>Hidden Tracks</h3>
              {hiddenTracks.length === 0 ? (
                <p className={styles.settingsText} style={{ fontSize: '13px', margin: 0 }}>No tracks hidden.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                  {hiddenTracks.map(t => (
                    <div key={t.video_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: '12px' }}>
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                        <span style={{ color: '#888', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{t.artist}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.target.innerText = "Restoring...";
                          e.target.style.opacity = "0.5";
                          handleUnhide(t.video_id);
                        }} 
                        style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    )}
    </>
  )
}