import { useState, useEffect } from 'react'
import UploadPage from './pages/UploadPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import Navbar from './components/Navbar.jsx'

export default function App() {
  const [analysisData, setAnalysisData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [username, setUsername] = useState(null) // null = unknown, '' = takeout only, 'string' = lastfm id

  useEffect(() => {
    const stored = localStorage.getItem('lastfm_username')
    if (stored !== null) setUsername(stored)
  }, [])

  const handleAnalysisComplete = (data, name) => {
    setAnalysisData(data)
    setFileName(name)
  }

  const handleSaveUsername = (name) => {
    localStorage.setItem('lastfm_username', name)
    setUsername(name)
  }

  const handleReset = () => {
    setAnalysisData(null)
    setFileName('')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onReset={analysisData ? handleReset : null} fileName={fileName} />
      <main style={{ flex: 1 }}>
        {!analysisData
          ? <UploadPage 
              onAnalysisComplete={handleAnalysisComplete} 
              username={username} 
              onSaveUsername={handleSaveUsername} 
            />
          : <DashboardPage data={analysisData} />
        }
      </main>
    </div>
  )
}