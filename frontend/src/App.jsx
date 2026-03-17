import { useState, useEffect } from 'react'
import UploadPage from './pages/UploadPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import Navbar from './components/Navbar.jsx'
import { auth, loginWithGoogle, logout } from './firebase.js'
import { onAuthStateChanged } from 'firebase/auth'

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [analysisData, setAnalysisData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [user, setUser] = useState(null) // Holds the Firebase user
  const [lastFmUser, setLastFmUser] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const storedLastFm = localStorage.getItem('yt_lastfm')
    if (storedLastFm !== null) setLastFmUser(storedLastFm)

    // Listen for Firebase login state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // User is logged in, fetch their saved history using their permanent UID
        fetch(`${API_BASE}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: [], user_id: currentUser.uid, lastfm_username: storedLastFm || "" })
        })
          .then(res => res.json())
          .then(data => {
            if (!data.error && data.months_available?.length > 0) {
              setAnalysisData(data)
              setFileName('Loaded from Cloud Sync')
            }
          })
          .catch(err => console.log('No existing data found, ready for upload.'))
          .finally(() => setIsInitializing(false))
      } else {
        // User is logged out
        setAnalysisData(null)
        setFileName('')
        setIsInitializing(false)
      }
    });

    return () => unsubscribe();
  }, [])

  const handleAnalysisComplete = (data, name) => {
    setAnalysisData(data)
    setFileName(name)
  }

  const handleSaveLastFm = (name) => {
    localStorage.setItem('yt_lastfm', name)
    setLastFmUser(name)
  }

  const handleGoBack = () => setAnalysisData(null)

  const handleLogout = async () => {
    await logout()
    setAnalysisData(null)
    setFileName('')
  }

  if (isInitializing) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Loading Unwrapped...</div>
  }

  // ── Show Login Screen if not authenticated ──
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <h2>Welcome to YT Music Unwrapped</h2>
        <button 
          onClick={loginWithGoogle}
          style={{ padding: '12px 24px', fontSize: '16px', background: 'white', color: 'black', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        onGoBack={analysisData ? handleGoBack : null} 
        onClear={handleLogout} // Replaced "Clear All" with Logout
        fileName={fileName} 
      />
      <main style={{ flex: 1 }}>
        {!analysisData
          ? <UploadPage 
              onAnalysisComplete={handleAnalysisComplete} 
              userId={user.uid} // Pass the permanent Firebase UID
              lastFmUser={lastFmUser} 
              onSaveLastFm={handleSaveLastFm} 
            />
          : <DashboardPage data={analysisData} />
        }
      </main>
    </div>
  )
}