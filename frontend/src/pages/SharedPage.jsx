import { useState, useEffect } from 'react';
import MonthCapsule from '../components/MonthCapsule.jsx';

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function SharedPage({ token }) {
  const [sharedData, setSharedData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/shared/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setSharedData(data);
      })
      .catch(() => setError("Failed to load shared Unwrapped."));
  }, [token]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4444', background: '#050505' }}>
        <h2>{error}</h2>
      </div>
    );
  }

  if (!sharedData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#050505', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,0,0,0.2)', borderTopColor: '#FF0000', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p>Loading Unwrapped magic...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', position: 'relative', overflowX: 'hidden' }}>
      {/* Background Orbs */}
      <div style={{ position: 'fixed', top: '-10%', left: '-10%', width: '50vw', height: '50vh', background: 'radial-gradient(circle, rgba(255,0,0,0.4) 0%, transparent 70%)', filter: 'blur(120px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-10%', right: '-10%', width: '45vw', height: '45vh', background: 'radial-gradient(circle, #ff3333 0%, transparent 70%)', filter: 'blur(120px)', zIndex: 0, opacity: 0.5 }} />
      
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: '40px 5vw 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px', animation: 'fadeIn 1s ease' }}>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: '800', color: 'white', letterSpacing: '-1px', marginBottom: '8px' }}>
            {sharedData.month_label} Unwrapped
          </h1>
          <p style={{ color: '#aaa', fontSize: '15px' }}>Shared by a friend • YT Music Unwrapped</p>
        </div>

        {/* We pass isReadOnly=true to disable the "Hide Track" and "Share" buttons! */}
        <MonthCapsule 
          data={sharedData.dashboard_data} 
          monthLabel={sharedData.month_label} 
          isReadOnly={true} 
        />
      </div>
    </div>
  );
}