import { auth } from './firebase.js'

export const API_BASE = import.meta.env.VITE_API_URL || ''

// Calls the backend with the signed-in user's Firebase ID token. The backend
// identifies the user from this token (not from any user_id we send), so
// nobody can read or change another account's data by guessing its ID.
// getIdToken() transparently refreshes the token when it has expired.
export async function apiFetch(path, options = {}) {
  const token = await auth.currentUser?.getIdToken()
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
