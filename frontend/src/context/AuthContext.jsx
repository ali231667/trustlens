import { createContext, useContext, useEffect, useState } from 'react'
import { signup as apiSignup, login as apiLogin, verifyEmail, getCurrentUser } from '../api/trustlens'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('trustlens_token')
    if (!token) {
      setLoading(false)
      return
    }
    getCurrentUser(token)
      .then(setUser)
      .catch(() => localStorage.removeItem('trustlens_token'))
      .finally(() => setLoading(false))
  }, [])

  function _completeLogin(token, user) {
    localStorage.setItem('trustlens_token', token)
    setUser(user)
  }

  // Password check. Normally logs in directly ({ token, user }). If the
  // account was never verified (e.g. they closed the tab during signup),
  // the backend instead resends a code and returns { requires_verification,
  // email, message } — same shape signup() returns in that case.
  async function login(email, password) {
    const result = await apiLogin(email, password)
    if (result.token) {
      _completeLogin(result.token, result.user)
    }
    return result
  }

  // Creates the account. Never logs in directly — always returns
  // { requires_verification, email, message }; verifyCode() finishes it.
  async function signup(fullName, email, password) {
    return apiSignup(fullName, email, password)
  }

  // Confirms the emailed code — for both a fresh signup and a resent code
  // from an unverified login attempt. This is the only thing that can turn
  // an unverified account into a logged-in session.
  async function verifyCode(email, code) {
    const { token, user } = await verifyEmail(email, code)
    _completeLogin(token, user)
  }

  function logout() {
    localStorage.removeItem('trustlens_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifyCode, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
