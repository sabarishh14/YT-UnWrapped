import { useEffect, useState } from 'react'
import styles from './FriendsPanel.module.css'
import { apiFetch } from '../api.js'

// Friend code + add/remove friends (lives in the Settings modal).
export default function FriendsPanel() {
  const [myCode, setMyCode] = useState('')
  const [friends, setFriends] = useState([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)

  const loadFriends = () =>
    apiFetch('/api/friends').then(r => r.json()).then(d => setFriends(d.friends || [])).catch(() => {})

  useEffect(() => {
    apiFetch('/api/me').then(r => r.json()).then(d => setMyCode(d.friend_code || '')).catch(() => {})
    loadFriends()
  }, [])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(myCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked - the code is visible to copy by hand
    }
  }

  const addFriend = async () => {
    if (!code.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await apiFetch('/api/friends', { method: 'POST', body: JSON.stringify({ code: code.trim() }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setMessage({ ok: true, text: `${d.friend.name} added! Battle them from any VS Battle.` })
      setCode('')
      loadFriends()
    } catch (e) {
      setMessage({ ok: false, text: e.message || "Couldn't add that friend." })
    }
    setBusy(false)
  }

  const removeFriend = async (friend) => {
    if (!window.confirm(`Remove ${friend.name} from your friends?`)) return
    setFriends(fs => fs.filter(f => f.code !== friend.code))
    await apiFetch(`/api/friends/${friend.code}`, { method: 'DELETE' }).catch(() => loadFriends())
  }

  return (
    <div className={styles.panel}>
      <div className={styles.codeRow}>
        <div>
          <p className={styles.codeLabel}>Your friend code</p>
          <p className={styles.code}>{myCode || '······'}</p>
        </div>
        <button className={styles.copyBtn} onClick={copyCode} disabled={!myCode}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className={styles.hint}>Share it so friends can add you and compare stats.</p>

      <div className={styles.addRow}>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addFriend()}
          placeholder="Friend's code"
          maxLength={6}
          disabled={busy}
          aria-label="Friend's code"
        />
        <button onClick={addFriend} disabled={busy || !code.trim()}>{busy ? 'Adding…' : 'Add'}</button>
      </div>
      {message && <p className={message.ok ? styles.ok : styles.err}>{message.text}</p>}

      {friends.length > 0 && (
        <ul className={styles.list}>
          {friends.map(f => (
            <li key={f.code} className={styles.friend}>
              {f.photo
                ? <img src={f.photo} alt="" referrerPolicy="no-referrer" className={styles.avatar} />
                : <span className={styles.avatarFallback}>{f.name[0]}</span>}
              <div className={styles.friendText}>
                <span className={styles.friendName}>{f.name}</span>
                <span className={styles.friendMeta}>
                  {f.last_synced ? `Synced ${new Date(f.last_synced).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : 'No stats yet'}
                </span>
              </div>
              <button className={styles.removeBtn} onClick={() => removeFriend(f)} title={`Remove ${f.name}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
