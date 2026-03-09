import { useState, useRef, useCallback } from 'react'
import styles from './UploadPage.module.css'

export default function UploadPage({ onAnalysisComplete, username, onSaveUsername }) {
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const [localInput, setLocalInput] = useState('')
  const inputRef = useRef()

  const startProgressPolling = () => {
    return setInterval(async () => {
      try {
        const res = await fetch('/api/progress')
        const data = await res.json()
        if (data.total > 0) {
          setLoadingMsg(`${data.message} (${data.processed} / ${data.total} tracks)`)
        } else {
          setLoadingMsg(data.message)
        }
      } catch (err) {
        // Ignore polling errors
      }
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
        body: JSON.stringify({ entries: [], lastfm_username: username }), 
      })

      clearInterval(pollId)

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Server error')
      }

      const data = await response.json()
      setSyncing(false)
      onAnalysisComplete(data, 'Synced & Loaded')
    } catch (err) {
      clearInterval(pollId)
      console.error(err)
      setError(err.message || 'Make sure the backend is running.')
      setSyncing(false)
    }
  }

  const processFile = useCallback(async (file) => {
    if (!file) return
    if (!file.name.endsWith('.json')) {
      setError('Please upload a .json file from Google Takeout.')
      return
    }

    setError('')
    setLoading(true)
    setLoadingMsg('Reading your history file…')

    try {
      const text = await file.text()
      const raw = JSON.parse(text)

      const entries = raw.filter(e =>
        e.header === 'YouTube Music' &&
        e.titleUrl &&
        e.time &&
        e.title?.startsWith('Watched ')
      )

      if (entries.length === 0) {
        setError('No YouTube Music watch history found in this file.')
        setLoading(false)
        return
      }

      setLoadingMsg('Starting analysis...')
      const pollId = startProgressPolling()

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, lastfm_username: username || "" }),
      })

      clearInterval(pollId)

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Server error')
      }

      const data = await response.json()
      setLoading(false)
      onAnalysisComplete(data, file.name)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Something went wrong. Make sure the backend is running.')
      setLoading(false)
    }
  }, [onAnalysisComplete, username])
  
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

  // -- STEP 1: ONBOARDING SCREEN --
  if (username === null) {
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
        </div>

        <div className={styles.setupCard}>
          <p className={styles.setupLabel}>Connect your Last.fm to automatically track new listens, or skip to just use Google Takeout.</p>
          <div className={styles.setupInputRow}>
            <input 
              type="text" 
              placeholder="Last.fm username" 
              className={styles.setupInput}
              value={localInput}
              onChange={e => setLocalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && localInput.trim() && onSaveUsername(localInput.trim())}
            />
            <button 
              className={styles.primaryBtn} 
              onClick={() => localInput.trim() && onSaveUsername(localInput.trim())}
              disabled={!localInput.trim()}
            >
              Connect
            </button>
          </div>
          
          <div className={styles.divider}><span>OR</span></div>
          
          <button className={styles.secondaryBtn} onClick={() => onSaveUsername('')}>
            Skip / I only have Google Takeout
          </button>
        </div>
      </div>
    )
  }

  // -- STEP 2: UPLOAD / SYNC SCREEN --
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Welcome back.</h1>
        <p className={styles.subtitle}>
          {username 
            ? `Load your saved history and sync fresh scrobbles for @${username}.` 
            : 'Drop your Takeout file below to analyze your history.'}
        </p>
      </div>

      {username !== '' && (
        <div className={styles.syncSection}>
          <button 
            className={styles.syncButton} 
            onClick={handleSync}
            disabled={loading || syncing}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
            {syncing ? 'Syncing...' : 'Sync Last.fm & Load Dashboard'}
          </button>
          
          <div className={styles.divider}>
            <span>OR UPLOAD TAKEOUT</span>
          </div>
        </div>
      )}

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''} ${loading || syncing ? styles.loading : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !(loading || syncing) && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className={styles.hiddenInput}
          onChange={e => processFile(e.target.files[0])}
        />

        {loading || syncing ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p className={styles.loadingMsg}>{loadingMsg}</p>
          </div>
        ) : (
          <div className={styles.dropContent}>
            <div className={styles.uploadIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className={styles.dropMain}>Drop your Takeout JSON here</p>
            <p className={styles.dropSub}>or click to browse</p>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}