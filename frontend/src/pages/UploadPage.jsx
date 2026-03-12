import { useState, useRef, useCallback } from 'react'
import styles from './UploadPage.module.css'

export default function UploadPage({ onAnalysisComplete, userId, lastFmUser, onSaveLastFm }) {
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const [localInput, setLocalInput] = useState('')
  const inputRef = useRef()

  const startProgressPolling = () => {
    const startTime = Date.now() // Track when we started to calculate speed

    return setInterval(async () => {
      try {
        const res = await fetch('/api/progress')
        const data = await res.json()
        
        if (data.total > 0 && data.processed > 0) {
          // Calculate Estimated Time Remaining
          const elapsedSec = (Date.now() - startTime) / 1000
          const tracksPerSec = data.processed / elapsedSec
          const remainingTracks = data.total - data.processed
          const remainingSec = Math.round(remainingTracks / tracksPerSec)

          let etaStr = ''
          if (remainingSec > 60) {
            const m = Math.floor(remainingSec / 60)
            const s = remainingSec % 60
            etaStr = `~${m}m ${s}s remaining`
          } else if (remainingSec > 0) {
            etaStr = `~${remainingSec}s remaining`
          } else {
            etaStr = 'Almost done...'
          }

          setLoadingMsg(`${data.message}\n(${data.processed} / ${data.total} tracks)\n${etaStr}`)
        } else if (data.total > 0) {
          setLoadingMsg(`${data.message}\n(0 / ${data.total} tracks)\nCalculating time...`)
        } else {
          setLoadingMsg(data.message)
        }
      } catch (err) {}
    }, 1000)
  }

  const handleSync = async () => {
    setError('')
    setSyncing(true)
    setLoadingMsg('Starting sync...')
    const pollId = startProgressPolling()

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [], user_id: userId, lastfm_username: lastFmUser }), 
      })
      clearInterval(pollId)
      if (!response.ok) throw new Error((await response.json()).error || 'Server error')
      
      const data = await response.json()
      setSyncing(false)
      onAnalysisComplete(data, 'Synced & Loaded')
    } catch (err) {
      clearInterval(pollId)
      setError(err.message || 'Make sure the backend is running.')
      setSyncing(false)
    }
  }

  const processFile = useCallback(async (file) => {
    if (!file) return
    if (!file.name.endsWith('.json')) return setError('Please upload a .json file from Google Takeout.')

    setError('')
    setLoading(true)
    setLoadingMsg('Reading your history file…')

    try {
      const text = await file.text()
      const raw = JSON.parse(text)
      const entries = raw.filter(e => e.header === 'YouTube Music' && e.titleUrl && e.time && e.title?.startsWith('Watched '))

      if (entries.length === 0) throw new Error('No YouTube Music watch history found in this file.')

      setLoadingMsg('Starting analysis...')
      const pollId = startProgressPolling()

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, user_id: userId, lastfm_username: lastFmUser || "" }),
      })
      clearInterval(pollId)
      if (!response.ok) throw new Error((await response.json()).error || 'Server error')

      const data = await response.json()
      setLoading(false)
      onAnalysisComplete(data, file.name)
    } catch (err) {
      clearInterval(pollId)
      setError(err.message || 'Something went wrong.')
      setLoading(false)
    }
  }, [onAnalysisComplete, userId, lastFmUser])
  
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  // ── CINEMATIC LOADING OVERLAY ──
  if (loading || syncing) {
    const msgParts = loadingMsg.split('\n')
    const mainText = msgParts[0] || 'Unwrapping...'
    const progressText = msgParts[1] || ''
    const etaText = msgParts[2] || ''

    return (
      <div className={styles.cinematicWrapper}>
        <div className={styles.ambientOrb} />
        <div className={styles.cinematicContent}>
          <div className={styles.logoRingCinematic}>
            <svg width="80" height="80" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="28" fill="#FF0000" opacity="0.12"/>
              <circle cx="28" cy="28" r="20" fill="#FF0000" opacity="0.18"/>
              <circle cx="28" cy="28" r="13" fill="#FF0000"/>
              <circle cx="28" cy="28" r="5.5" fill="white"/>
              <circle cx="28" cy="28" r="2.5" fill="#FF0000"/>
            </svg>
          </div>
          <h2 className={styles.cinematicText}>{mainText}</h2>
          <div className={styles.cinematicSubtext}>
            {progressText && <p className={styles.progressLine}>{progressText}</p>}
            {etaText && <p className={styles.etaLine}>{etaText}</p>}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.logoRing}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="#FF0000" opacity="0.12"/>
            <circle cx="28" cy="28" r="20" fill="#FF0000" opacity="0.18"/>
            <circle cx="28" cy="28" r="13" fill="#FF0000"/>
            <circle cx="28" cy="28" r="5.5" fill="white"/>
            <circle cx="28" cy="28" r="2.5" fill="#FF0000"/>
          </svg>
        </div>
        <h1 className={styles.title}>Your Music, Unwrapped</h1>
        <p className={styles.subtitle}>Choose how you want to import your listening history.</p>
      </div>

      <div className={styles.optionsGrid}>
        
        {/* CARD 1: TAKEOUT */}
        <div className={styles.optionCard}>
          <div className={styles.optionHeader}>
            <h2 className={styles.optionTitle}>Google Takeout</h2>
            <p className={styles.optionDesc}>Upload your watch-history.json file for deep historical data.</p>
          </div>
          
          <div
            className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''} ${loading ? styles.loading : ''}`}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !loading && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <input ref={inputRef} type="file" accept=".json" className={styles.hiddenInput} onChange={e => processFile(e.target.files[0])} />
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p className={styles.loadingMsg} style={{ whiteSpace: 'pre-line' }}>{loadingMsg}</p>
              </div>
            ) : (
              <div className={styles.dropContent}>
                <div className={styles.uploadIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <p className={styles.dropMain}>Drop JSON here</p>
                <p className={styles.dropSub}>or click to browse</p>
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: LAST.FM */}
        <div className={styles.optionCard}>
          <div className={styles.optionHeader}>
            <h2 className={styles.optionTitle}>Last.fm Sync</h2>
            <p className={styles.optionDesc}>Connect your account to fetch your most recent scrobbles.</p>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
            {!lastFmUser ? (
              <div className={styles.setupInputRow} style={{ flexDirection: 'column' }}>
                <input 
                  type="text" 
                  placeholder="Last.fm username" 
                  className={styles.setupInput}
                  value={localInput}
                  onChange={e => setLocalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && localInput.trim()) onSaveLastFm(localInput.trim()) }}
                />
                <button 
                  className={styles.primaryBtn} 
                  style={{ padding: '12px' }}
                  onClick={() => localInput.trim() && onSaveLastFm(localInput.trim())}
                  disabled={!localInput.trim()}
                >
                  Connect Account
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p className={styles.setupLabel}>Connected as <strong>@{lastFmUser}</strong></p>
                {syncing ? (
                  <div className={styles.loadingState} style={{ padding: '10px 0' }}>
                    <div className={styles.spinner} />
                    <p className={styles.loadingMsg} style={{ whiteSpace: 'pre-line' }}>{loadingMsg}</p>
                  </div>
                ) : (
                  <>
                    <button className={styles.syncButton} onClick={handleSync}>
                      Sync Data Now
                    </button>
                    <button className={styles.secondaryBtn} onClick={() => onSaveLastFm('')}>
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}