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
      // (Login.jsx / SignUp.jsx) redirect the moment that happens — to a
      // waiting scan if there is one, otherwise the dashboard. That
      // redirect is what was missing originally: success left the user
      // staring at an unchanged screen, so they clicked again and the second
      // attempt failed on an already-used code.
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  // Six boxes drawn over one real input, so typing, pasting and screen
  // readers all behave like a normal text field.
  const digits = Array.from({ length: 6 }, (_, i) => code[i] || '')

  return (
    <>
      <span className="tl-eyebrow">Check your inbox</span>
      <h1 className="tl-display au-title">Enter your<br />code.</h1>
      <p className="au-sub">{message}</p>

      <form className="au-form" onSubmit={handleSubmit}>
        <label className="au-code" htmlFor="au-code-input">
          <span className="au-sr">6-digit code</span>
          <input
            id="au-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
            required
          />
          <span className="au-code-boxes" aria-hidden="true">
            {digits.map((d, i) => (
              <span key={i} className={`au-code-box ${d ? 'is-filled' : ''} ${i === code.length ? 'is-next' : ''}`}>{d}</span>
            ))}
          </span>
        </label>

        {error && <p className="tl-alert tl-alert-bad" role="alert">{error}</p>}

        <button type="submit" className="tl-btn tl-btn-grad tl-btn-lg tl-btn-block" disabled={loading || code.length !== 6}>
          {loading ? 'Verifying…' : 'Verify & continue'}
        </button>
      </form>

      <p className="au-switch">
        Wrong email, or no code after a minute?{' '}
        <button type="button" className="tl-link" onClick={onBack}>Start over</button>
      </p>
    </>
  )
}

export default VerifyCodeForm
