// ============================================================================
// The "type a username → sign up / log in → see the result" pipeline.
//
// A logged-out visitor who types a username is sent to sign up first. The
// username is remembered here (sessionStorage: this tab only, gone when the
// tab closes) so that the moment they finish signing up or logging in, the
// scan they asked for runs automatically instead of dropping them on the
// Dashboard and making them type it again.
// ============================================================================

const PENDING_KEY = 'trustlens_pending_scan'

// Instagram's own rule: 1-30 characters, letters, numbers, dots, underscores.
const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/

// Paths on instagram.com that are pages, not accounts.
const NOT_ACCOUNTS = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct', 'tv'])

/**
 * Turns whatever someone pasted into a bare username, or null if it can't
 * be one. Accepts "cristiano", "@cristiano", "instagram.com/cristiano" and
 * full profile URLs like "https://www.instagram.com/cristiano/?hl=en".
 * A post or reel link is refused rather than guessed at, since it doesn't
 * say whose account it is.
 */
export function parseUsername(input) {
  let s = (input || '').trim()
  if (!s) return null

  const urlMatch = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i)
  if (urlMatch) {
    const first = urlMatch[1]
    if (NOT_ACCOUNTS.has(first.toLowerCase())) return null
    s = first
  }

  s = s.replace(/^@+/, '')
  return USERNAME_RE.test(s) ? s.toLowerCase() : null
}

export const USERNAME_HELP =
  'Enter an Instagram username like @lahore.eats, or paste a profile link. Post and reel links don’t say whose account it is, so use the profile link.'

export function savePendingScan(username) {
  try { sessionStorage.setItem(PENDING_KEY, username) } catch { /* storage blocked: the user just types it again */ }
}

export function peekPendingScan() {
  try { return sessionStorage.getItem(PENDING_KEY) } catch { return null }
}

export function clearPendingScan() {
  try { sessionStorage.removeItem(PENDING_KEY) } catch { /* nothing to clear */ }
}

export function scanPath(username) {
  return `/scan?u=${encodeURIComponent(username)}`
}

/**
 * Where to send someone right after they log in or finish signing up:
 * a waiting scan first, then wherever they were headed, then the Dashboard.
 * Only same-site paths are honoured for `next`, so a crafted link can't
 * bounce a freshly logged-in user to another website.
 */
export function afterAuthPath(next) {
  const pending = peekPendingScan()
  if (pending) return scanPath(pending)
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return '/dashboard'
}
