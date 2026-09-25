import { useRef, useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import AuthPanel from '../components/AuthPanel'
import VerifyCodeForm from '../components/VerifyCodeForm'
import './Auth.css'
import { useAuth } from '../context/AuthContext'

function Login() {
  const navigate = useNavigate()
  const { login, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingVerification, setPendingVerification] = useState(null) // { email, message } | null
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false) // blocks a fast double-click/Enter+click double-submit

  // Same redirect-on-success guard as SignUp — covers both the normal
  // password login path and the "this account was never verified" path
  // where VerifyCodeForm completes the login instead.
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.requires_verification) {
        // Account exists and password is correct, but was never verified
        // (e.g. they closed the tab during signup) — finish that instead.
        setPendingVerification({ email: result.email, message: result.message })
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="auth-page">
      <div className="glow-backdrop" />
      <Navbar />
      <div className="auth-layout">
        <AuthPanel />

        <div className="auth-card">
          <Link to="/" className="auth-back-link">← Back to home</Link>

          {pendingVerification ? (
            <VerifyCodeForm
              email={pendingVerification.email}
              message={pendingVerification.message}
              onBack={() => setPendingVerification(null)}
            />
          ) : (
            <>
              <div className="auth-eyebrow">WELCOME BACK</div>
              <h1 className="auth-title">Log in to TrustLens</h1>

              <form className="auth-form" onSubmit={handleSubmit}>
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                {error && <p className="auth-error">{error}</p>}

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? 'Logging in…' : 'Log in'}
                </button>
              </form>

              <p className="auth-footer">
                Don't have an account? <Link to="/signup">Sign up</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
