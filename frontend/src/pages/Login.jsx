import { useEffect, useRef, useState } from 'react'
import { Navigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import AuthSide from '../components/site/AuthSide'
import VerifyCodeForm from '../components/VerifyCodeForm'
import './Auth.css'
import { useAuth } from '../context/AuthContext'
import { afterAuthPath, clearPendingScan, peekPendingScan } from '../lib/scanFlow'

function Login() {
  const { login, user } = useAuth()
  const location = useLocation()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(null) // { email, message } | null
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(() => peekPendingScan())
  const submittingRef = useRef(false) // blocks a fast double-click/Enter+click double-submit

  useEffect(() => { document.title = 'Log in · TrustLens' }, [])

  const next = params.get('next') || location.state?.from || null

  // The one redirect for every way of finishing a login — password, or the
  // "never verified" path where VerifyCodeForm completes it instead. A
  // waiting scan goes first, then wherever they were headed, then the
  // dashboard (see lib/scanFlow.js).
  if (user) {
    return <Navigate to={afterAuthPath(next)} replace />
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
      }
      // Otherwise AuthContext now has `user`, and the guard above redirects.
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  function dropPending() {
    clearPendingScan()
    setPending(null)
  }

  const switchTo = `/signup${location.search}`

  return (
    <div className="tl-page au-page">
      <AuthSide pending={pending} mode="login" />

      <section className="au-main">
        <div className="au-main-top">
          <Link to="/" className="au-back">← Home</Link>
          <span className="au-main-switch">New here? <Link to={switchTo}>Create an account</Link></span>
        </div>

        <div className="au-card">
          {pendingVerification ? (
            <VerifyCodeForm
              email={pendingVerification.email}
              message={pendingVerification.message}
              onBack={() => setPendingVerification(null)}
            />
          ) : (
            <>
              <span className="tl-eyebrow">Log in</span>
              <h1 className="tl-display au-title">
                {pending ? <>One step<br />to go.</> : <>Good to<br />see you.</>}
              </h1>
              {location.state?.reason === 'expired' && (
                <p className="tl-alert tl-alert-warn">Your session ended. Log in again and your scan picks up where it stopped.</p>
              )}
              {pending && (
                <p className="au-pending">
                  Log in to see the Trust Score for <strong>@{pending}</strong>.{' '}
                  <button type="button" className="tl-link" onClick={dropPending}>Not now</button>
                </p>
              )}

              <form className="au-form" onSubmit={handleSubmit}>
                <label className="tl-field">
                  <span>Email</span>
                  <input
                    className="tl-input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>

                <label className="tl-field">
                  <span>Password</span>
                  <span className="au-pw">
                    <input
                      className="tl-input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="au-pw-toggle" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </label>

                {error && <p className="tl-alert tl-alert-bad" role="alert">{error}</p>}

                <button type="submit" className="tl-btn tl-btn-grad tl-btn-lg tl-btn-block" disabled={loading}>
                  {loading ? 'Logging in…' : pending ? `Log in and scan @${pending}` : 'Log in'}
                </button>
              </form>

              <p className="au-switch">Don’t have an account? <Link to={switchTo}>Sign up free</Link></p>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default Login
