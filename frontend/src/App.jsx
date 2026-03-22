import { useState, useEffect, startTransition } from 'react' // <--- Add startTransition
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
  const [isFetchingCloud, setIsFetchingCloud] = useState(false) // <-- ADDED THIS

  // The Silent Refresh Engine
  // The Silent Refresh Engine
  const fetchCloudData = (uid, lfm, silent = false) => {
    if (!silent) {
      setIsFetchingCloud(true); 
    } else {
      // NEW: Instant visual feedback so you know it's working!
      setFileName("Syncing changes..."); 
    }
    
    fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        entries: [], 
        user_id: uid, 
        lastfm_username: lfm || "",
        quick_refresh: silent 
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.months_available?.length > 0) {
          // NEW: startTransition tells React to paint the new heavy dashboard 
          // in the background WITHOUT freezing the user's screen!
          startTransition(() => {
            setAnalysisData(data);
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setFileName(`Cloud Data (Synced: ${timeStr})`); 
          });
        }
      })
      .catch(err => console.log('No existing data found.'))
      .finally(() => {
        setIsInitializing(false);
        if (!silent) setIsFetchingCloud(false);
      })
  }

  useEffect(() => {
    const storedLastFm = localStorage.getItem('yt_lastfm')
    if (storedLastFm !== null) setLastFmUser(storedLastFm)

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setIsFetchingCloud(true); // Show loading briefly while checking cache

        // 1. Try to load the instant mathematical cache first!
        fetch(`${API_BASE}/api/get_cache?user_id=${currentUser.uid}`)
          .then(res => res.ok ? res.json() : Promise.reject('No cache'))
          .then(data => {
            if (!data.error && data.months_available) {
              startTransition(() => {
                setAnalysisData(data);
                setFileName(`Offline Cache (Syncing new tracks...)`);
              });
              setIsFetchingCloud(false); // Drop the loading screen instantly
              
              // 2. Silently sync Last.fm in the background!
              fetchCloudData(currentUser.uid, storedLastFm, true); 
            } else {
              throw new Error("Invalid cache");
            }
          })
          .catch(() => {
            // 3. If no cache exists (first time login), do a normal, loud boot
            fetchCloudData(currentUser.uid, storedLastFm, false);
          });

      } else {
        // User is logged out
        setAnalysisData(null);
        setFileName('');
        setIsInitializing(false);
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

  const handleClearData = async () => {
    if (!user) return
    const confirmed = window.confirm("Are you sure you want to permanently delete all your saved listening history from the cloud?")
    if (!confirmed) return

    try {
      await fetch(`${API_BASE}/api/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid })
      })
      // Clear local state so they drop back to the upload screen
      setAnalysisData(null)
      setFileName('')
    } catch (err) {
      console.error("Failed to clear data:", err)
      alert("Something went wrong while clearing your data.")
    }
  }

  const handleLogout = async () => {
    await logout()
    setAnalysisData(null)
    setFileName('')
  }

  if (isInitializing || isFetchingCloud) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,0,0,0.2)', borderTopColor: '#FF0000', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p>{isFetchingCloud ? "Pulling your Unwrapped from the cloud..." : "Starting up..."}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Show Login Screen if not authenticated ──
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px'
      }}>
        {/* Ambient glowing orb matching your global background */}
        <div style={{
          position: 'absolute',
          width: '60vw',
          height: '60vh',
          background: 'radial-gradient(circle, rgba(255, 0, 0, 0.12) 0%, transparent 60%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        {/* Glassmorphic Login Card */}
        <div style={{
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
          textAlign: 'center',
          padding: '48px 40px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '32px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)',
          maxWidth: '420px',
          width: '100%'
        }}>
          {/* Animated Logo Ring */}
          <div style={{ filter: 'drop-shadow(0 0 24px rgba(255,0,0,0.3))' }}>
            <svg width="64" height="64" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="28" fill="#FF0000" opacity="0.12"/>
              <circle cx="28" cy="28" r="20" fill="#FF0000" opacity="0.18"/>
              <circle cx="28" cy="28" r="13" fill="#FF0000"/>
              <circle cx="28" cy="28" r="5.5" fill="white"/>
              <circle cx="28" cy="28" r="2.5" fill="#FF0000"/>
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h1 style={{
              fontSize: 'clamp(28px, 6vw, 36px)',
              fontWeight: 800,
              letterSpacing: '-1px',
              margin: 0,
              background: 'linear-gradient(90deg, #ffffff, #ffb3b3)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1
            }}>
              YT Music Unwrapped
            </h1>
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '15px', 
              margin: '0 auto', 
              maxWidth: '280px', 
              lineHeight: '1.5' 
            }}>
              Sign in to analyze your history and sync your data securely.
            </p>
          </div>

          <button
            onClick={loginWithGoogle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '100px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Google "G" Logo SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      <Navbar 
        onGoBack={analysisData ? handleGoBack : null} 
        onClear={user ? handleClearData : null} 
        onLogout={user ? handleLogout : null} 
        fileName={fileName} 
        onRefresh={() => user && fetchCloudData(user.uid, lastFmUser, true)} // True = Silent!
      />
      
      <main style={{ flex: 1 }}>
        {!analysisData
          ? <UploadPage 
              onAnalysisComplete={handleAnalysisComplete} 
              userId={user.uid} 
              lastFmUser={lastFmUser} 
              onSaveLastFm={handleSaveLastFm} 
            />
          : <DashboardPage 
              data={analysisData} 
              onRefresh={() => user && fetchCloudData(user.uid, lastFmUser, true)} 
            />
        }
      </main>
      
    </div>
  )
}