import { auth } from './firebase.js'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Render's free tier puts the server to sleep after 15 idle minutes. Rather
// than guess from how long something is taking (which can't tell a sleeping
// server from a sync doing real work), we ask it: until /api/health answers,
// the server is asleep, and once it has, any waiting is real processing.
const SLOW_MS = 2000                // no answer by now means asleep, not a slow network
const PING_TIMEOUT_MS = 20000
const GIVE_UP_MS = 120000
const AWAKE_FOR_MS = 5 * 60 * 1000  // well inside the idle window, so no need to re-check

let lastAnsweredAt = 0
let wakeInFlight = null
let status = 'unknown'              // 'unknown' | 'waking' | 'ready' | 'down'
const listeners = new Set()

function setStatus(next) {
  status = next
  listeners.forEach(fn => fn(next))
}

export function subscribeServerStatus(fn) {
  listeners.add(fn)
  fn(status)
  return () => listeners.delete(fn)
}

async function pingOnce() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal, cache: 'no-store' })
    // Render can answer for a sleeping or deploying server itself (an error
    // or an HTML page), so only our own JSON counts as awake.
    return res.ok && (await res.json()).status === 'ok'
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

// Resolves true once the server answers, or false if it never does.
export function wakeServer() {
  if (Date.now() - lastAnsweredAt < AWAKE_FOR_MS) return Promise.resolve(true)
  if (wakeInFlight) return wakeInFlight

  wakeInFlight = (async () => {
    const startedAt = Date.now()
    const slowTimer = setTimeout(() => setStatus('waking'), SLOW_MS)
    let awake = await pingOnce()
    while (!awake && Date.now() - startedAt < GIVE_UP_MS) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      awake = await pingOnce()
    }
    clearTimeout(slowTimer)
    if (awake) lastAnsweredAt = Date.now()
    wakeInFlight = null
    setStatus(awake ? 'ready' : 'down')
    return awake
  })()
  return wakeInFlight
}

// Calls the backend with the signed-in user's Firebase ID token. The backend
// identifies the user from this token (not from any user_id we send), so
// nobody can read or change another account's data by guessing its ID.
// getIdToken() transparently refreshes the token when it has expired.
export async function apiFetch(path, options = {}) {
  if (!(await wakeServer())) throw new Error("Can't reach the server right now.")

  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status < 500) lastAnsweredAt = Date.now()
  return res
}
