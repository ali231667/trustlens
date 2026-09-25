import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Shared by Login and SignUp — whenever the backend says
// { requires_verification: true }, this collects the emailed code and
// completes the login. `email` and `message` come from that response.
function VerifyCodeForm({ email, message, onBack }) {
  const { verifyCode } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // A fast double-click (or Enter + click) can fire handleSubmit twice
  // before React re-renders the button's `disabled` state, since that
  // state update isn't synchronous. That was silently sending TWO
  // /verify-email requests with the same code: the first one correctly
  // used up the code and logged the account in, and the second one then
  // failed with "already used" — and if that second response landed after
  // the first, its failure message is what showed on screen, even though
  // verification had already genuinely succeeded a moment earlier. A ref
  // (unlike state) updates immediately, so it actually blocks the second
  // call instead of just visually disabling a button a few milliseconds
  // too late.
  const submittingRef = useRef(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setError('')
    setLoading(true)
    try {
      await verifyCode(email, code)
      // On success AuthContext sets `user`, and both parent pages
      // (Login.jsx / SignUp.jsx) redirect to /dashboard the moment that
      // happens. That redirect is what was missing originally — success
      // left the user staring at an unchanged screen, so they clicked
      // again and the second attempt failed on an already-used code.
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <>
      <div className="auth-eyebrow">VERIFY IT'S YOU</div>
      <h1 className="auth-title">Enter your code</h1>
      <p className="auth-2fa-message">{message}</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>6-digit code</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="auth-code-input"
          autoFocus
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={loading || code.length !== 6}>
          {loading ? 'Verifying…' : 'Verify & continue'}
        </button>
      </form>

      <p className="auth-footer">
        <button type="button" className="auth-link-button" onClick={onBack}>
          ← Start over
        </button>
      </p>
    </>
  )
}

export default VerifyCodeForm
