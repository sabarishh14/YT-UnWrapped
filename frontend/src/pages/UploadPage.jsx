import { useState, useRef, useCallback } from 'react'
import styles from './UploadPage.module.css'

export default function UploadPage({ onAnalysisComplete }) {
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef()

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

      // Filter to YouTube Music entries only
      const entries = raw.filter(e =>
        e.header === 'YouTube Music' &&
        e.titleUrl &&
        e.time &&
        e.title?.startsWith('Watched ')
      )

      if (entries.length === 0) {
        setError('No YouTube Music watch history found in this file. Make sure you\'re uploading the watch history JSON from Google Takeout.')
        setLoading(false)
        return
      }

      setLoadingMsg(`Found ${entries.length.toLocaleString()} plays. Sending to server for analysis…`)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })

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
  }, [onAnalysisComplete])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

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
        <p className={styles.subtitle}>
          Upload your Google Takeout history and get a monthly deep-dive into your listening habits.
        </p>
      </div>

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''} ${loading ? styles.loading : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !loading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && !loading && inputRef.current?.click()}
        aria-label="Upload JSON file"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className={styles.hiddenInput}
          onChange={e => processFile(e.target.files[0])}
        />

        {loading ? (
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
            <p className={styles.dropMain}>
              {dragOver ? 'Drop it here!' : 'Drop your Takeout JSON here'}
            </p>
            <p className={styles.dropSub}>or click to browse</p>
            <div className={styles.fileTag}>.json</div>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className={styles.howTo}>
        <p className={styles.howToTitle}>How to get your history file</p>
        <ol className={styles.steps}>
          <li>Go to <strong>myaccount.google.com</strong> → Data & Privacy → Download your data</li>
          <li>Select <strong>YouTube and YouTube Music</strong> only</li>
          <li>In format options, choose <strong>JSON</strong></li>
          <li>After download, find <code>Takeout/YouTube and YouTube Music/history/watch-history.json</code></li>
          <li>Upload that file here</li>
        </ol>
      </div>
    </div>
  )
}
