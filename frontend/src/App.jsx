import { useState, useEffect } from 'react'
import UploadPage from './pages/UploadPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import Navbar from './components/Navbar.jsx'

export default function App() {
  const [analysisData, setAnalysisData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [userId, setUserId] = useState('')
  const [lastFmUser, setLastFmUser] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    // Generate or retrieve persistent ID for this browser
    let storedId = localStorage.getItem('yt_user_id')
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substring(2, 10)
      localStorage.setItem('yt_user_id', storedId)
    }
    setUserId(storedId)

    const storedLastFm = localStorage.getItem('yt_lastfm')
    if (storedLastFm !== null) setLastFmUser(storedLastFm)

    // Try auto-loading data from local DB immediately
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [], user_id: storedId, lastfm_username: storedLastFm || "" })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.months_available?.length > 0) {
          setAnalysisData(data)
          setFileName('Loaded from Local Sync')
        }
      })
      .catch(err => console.log('No existing data found, showing upload screen.'))
      .finally(() => setIsInitializing(false))
  }, [])

  const handleAnalysisComplete = (data, name) => {
    setAnalysisData(data)
    setFileName(name)
  }

  const handleSaveLastFm = (name) => {
    // FIX: If they already had a username and are changing or disconnecting it, start fresh!
    if (lastFmUser && lastFmUser !== name) {
      const newId = 'user_' + Math.random().toString(36).substring(2, 10)
      localStorage.setItem('yt_user_id', newId)
      setUserId(newId)
      setAnalysisData(null)
      setFileName('')
    }
    localStorage.setItem('yt_lastfm', name)
    setLastFmUser(name)
  }

  const handleGoBack = () => {
    // Just go back to the upload screen, keep the ID so data merges!
    setAnalysisData(null)
  }

  const handleClearData = () => {
    // Truly wipe everything and start fresh
    setAnalysisData(null)
    setFileName('')
    
    const newId = 'user_' + Math.random().toString(36).substring(2, 10)
    localStorage.setItem('yt_user_id', newId)
    setUserId(newId)
  }

  if (isInitializing) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Checking for saved data...</div>
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        onGoBack={analysisData ? handleGoBack : null} 
        onClear={analysisData ? handleClearData : null} 
        fileName={fileName} 
      />
      <main style={{ flex: 1 }}>
        {!analysisData
          ? <UploadPage 
              onAnalysisComplete={handleAnalysisComplete} 
              userId={userId}
              lastFmUser={lastFmUser} 
              onSaveLastFm={handleSaveLastFm} 
            />
          : <DashboardPage data={analysisData} />
        }
      </main>
    </div>
  )
}