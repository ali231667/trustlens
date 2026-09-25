const API_BASE = "http://127.0.0.1:8000"

// The browser extension talks to its own local gateway, not the website's
// backend. Kept as a separate base URL rather than hidden inside the page so
// all the network endpoints this app knows about stay listed in one file.
const EXTENSION_GATEWAY = "http://127.0.0.1:8100"

function authHeaders() {
  const token = localStorage.getItem('trustlens_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseErrorMessage(response) {
  try {
    const data = await response.json()
    return data.detail || `Server error: ${response.status}`
  } catch {
    return `Server error: ${response.status}`
  }
}

export async function analyzeProfile(username) {
  const response = await fetch(`${API_BASE}/analyze-live`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}

export async function getScanHistory(limit = 20) {
  const response = await fetch(`${API_BASE}/scans?limit=${limit}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function signup(fullName, email, password) {
  const response = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName, email, password }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function verifyEmail(email, code) {
  const response = await fetch(`${API_BASE}/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

/** Live status of the extension's gateway and the models behind it.
 *
 * Deliberately never throws: the gateway not running is the normal case for
 * someone who has not started it yet, not an error state, and the page should
 * say "not running" rather than show a crash. The short timeout stops the page
 * hanging when nothing is listening on that port.
 */
export async function getExtensionStatus() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`${EXTENSION_GATEWAY}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) return { running: false }
    return { running: true, ...(await response.json()) }
  } catch {
    return { running: false }
  }
}

export async function getCurrentUser(token) {
  const response = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}
