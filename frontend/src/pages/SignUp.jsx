import { useRef, useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import AuthPanel from '../components/AuthPanel'
import VerifyCodeForm from '../components/VerifyCodeForm'
import './Auth.css'
import { useAuth } from '../context/AuthContext'

// Mirrors the backend's real rule (auth.py's password_strength_error): 8+
// characters, at least one letter, at least one digit — a password that
// fails any of those would be rejected server-side too, so "Weak" here
// means "the backend will actually reject this," not a vague guess.
function passwordStrength(password) {
  if (!password) return null
  const hasLetter = /[A-Za-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  if (password.length < 8 || !hasLetter || !hasDigit) {
    return { label: 'Weak', color: 'red' }
  }
  if (password.length >= 12 && hasSymbol) {
    return { label: 'Strong', color: 'green' }
  }
  return { label: 'Medium', color: 'yellow' }
}

function SignUp() {
  const navigate = useNavigate()
  const { signup, user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingVerification, setPendingVerification] = useState(null) // { email, message } | null
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false) // blocks a fast double-click/Enter+click double-submit

  const strength = passwordStrength(password)

  // The moment verification succeeds, AuthContext sets `user` — that's what
  // actually sends you to the dashboard. Without this, a successful code
  // entry silently did nothing on screen, so people clicked "Verify" again
  // and the second click legitimately failed ("code already used"), which
  // looked exactly like the correct code being rejected. Real bug, reported
  // by Hamza three times before it was diagnosed properly.
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
      const result = await signup(fullName, email, password)
      setPendingVerification({ email: result.email, message: result.message })
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
              <div className="auth-eyebrow">GET STARTED</div>
              <h1 className="auth-title">Create your account</h1>

              <form className="auth-form" onSubmit={handleSubmit}>
                <label>Full name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />

                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="auth-hint">We'll email a code here to confirm it's real before your account works.</p>

                <label>Password</label>
                <input
                  type="password"
                  placeholder="At least 8 characters, one letter, one number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  maxLength={72}
                  required
                />
                {strength && (
                  <div className="password-strength">
                    <div className="password-strength-track">
                      <div className={`password-strength-fill strength-${strength.color}`} />
                    </div>
                    <span className={`password-strength-label strength-text-${strength.color}`}>{strength.label}</span>
                  </div>
                )}

                {error && <p className="auth-error">{error}</p>}

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p className="auth-footer">
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SignUp
