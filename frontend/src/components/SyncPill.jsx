// Small non-blocking status pill for background syncs: live progress while a
// sync runs, then the result for a few seconds.
export default function SyncPill({ syncing, progressMsg, result }) {
  if (!syncing && !result) return null

  const [message, count] = (progressMsg || '').split('\n')
  const text = syncing ? (message || 'Syncing…') : result
  const failed = !syncing && result.startsWith('Sync failed')
  const accent = failed ? '#ffb347' : syncing ? '#ff3333' : '#4ade80'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: 'calc(100vw - 32px)',
        padding: '10px 16px',
        borderRadius: '100px',
        background: 'rgba(20, 20, 20, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          flexShrink: 0,
          background: accent,
          boxShadow: `0 0 10px ${accent}`,
          animation: syncing ? 'syncPillPulse 1s ease-in-out infinite alternate' : 'none',
        }}
      />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      {syncing && count && (
        <span style={{ color: '#aaa', fontFamily: 'monospace', flexShrink: 0 }}>
          {count.replace(/[()]/g, '')}
        </span>
      )}
      <style>{`@keyframes syncPillPulse { from { opacity: 0.35; } to { opacity: 1; } }`}</style>
    </div>
  )
}
