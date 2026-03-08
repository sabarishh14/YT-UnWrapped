import { useState } from 'react'
import UploadPage from './pages/UploadPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import Navbar from './components/Navbar.jsx'

export default function App() {
  const [analysisData, setAnalysisData] = useState(null)
  const [fileName, setFileName] = useState('')

  const handleAnalysisComplete = (data, name) => {
    setAnalysisData(data)
    setFileName(name)
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
          ? <UploadPage onAnalysisComplete={handleAnalysisComplete} />
          : <DashboardPage data={analysisData} />
        }
      </main>
    </div>
  )
}