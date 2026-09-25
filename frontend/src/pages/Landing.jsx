import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import CountUp from '../components/CountUp'
import './Landing.css'
import { analyzeProfile } from '../api/trustlens'

// The hero ring is a KEY to the score, not a result.
//
// It used to show a hardcoded "94 — TRUSTED", captioned "Sample result". That
// number meant nothing: it was not any account's score and was not wired to
// anything, so it was decoration dressed up as data. Anyone could reasonably
// ask "whose 94 is that?" and the only honest answer was "nobody's".
//
// Now the same ring earns its place by showing the three verdict bands the
// product actually uses, so you learn how to read your score before you run a
// scan. The thresholds below are the real ones from backend/trust_score.py
// (>=70 Trusted, >=40 Moderate Risk, else High Risk) — if those ever change,
// change them here too.
const SCORE_BANDS = [
  { from: 0, to: 40, className: 'hero-band-danger' },
  { from: 40, to: 70, className: 'hero-band-warning' },
  { from: 70, to: 100, className: 'hero-band-trusted' },
]

function TrustRingGraphic() {
  const [drawn, setDrawn] = useState(false)
  const radius = 85
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const timer = setTimeout(() => setDrawn(true), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="hero-graphic">
      <div className="hero-graphic-glow" />
      <svg className="hero-ring" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} className="hero-ring-bg" />
        {SCORE_BANDS.map((band) => {
          const length = ((band.to - band.from) / 100) * circumference
          // A 2px visual gap between bands so they read as three distinct
          // zones rather than one continuous ring.
          const shown = drawn ? Math.max(length - 3, 0) : 0
          return (
            <circle
              key={band.className}
              cx="100" cy="100" r={radius}
              className={`hero-ring-band ${band.className}`}
              style={{
                strokeDasharray: `${shown} ${circumference - shown}`,
                strokeDashoffset: -(band.from / 100) * circumference,
              }}
            />
          )
        })}
      </svg>
      <div className="hero-ring-center">
        <span className="hero-ring-score">0–100</span>
        <span className="hero-ring-label">TRUST SCORE</span>
      </div>
      <div className="hero-graphic-caption">
        <span className="hero-band-key"><i className="key-dot key-trusted" />70+ Trusted</span>
        <span className="hero-band-key"><i className="key-dot key-warning" />40–69 Moderate</span>
        <span className="hero-band-key"><i className="key-dot key-danger" />Under 40 High risk</span>
      </div>
    </div>
  )
}

function Landing() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleScan() {
    if (!username.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await analyzeProfile(username.trim())
      navigate('/results', { state: { result } })
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="landing">
      <div className="glow-backdrop" />
      <Navbar />

      <section className="hero">
        <div className="hero-left">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" />
            AI-Powered Authenticity Check
          </div>

          <h1 className="hero-title">
            KNOW WHO'S REAL
            <br />
            BEFORE YOU
            <br />
            <span className="hero-bracket">[ TRUST THEM ]</span>
          </h1>

          <p className="hero-subtitle">
            TrustLens scans any public Instagram profile for fake followers, suspicious
            engagement, and manipulated credentials — with real trained AI models, free,
            in under a minute.
          </p>

          <div className="scan-box">
            <span className="scan-box-at">@</span>
            <input
              type="text"
              placeholder="instagram_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="scan-box-input"
              disabled={loading}
            />
            <button className="scan-box-button" onClick={handleScan} disabled={loading}>
              {loading ? 'Scanning…' : 'Start a scan'}
            </button>
          </div>

          {error && <p className="scan-error">{error}</p>}

          <div className="hero-tags">
            <span>✓ Fake follower detection</span>
            <span>✓ Engagement authenticity</span>
            <span>✓ Misinformation check</span>
            <span>✓ Credential verification</span>
          </div>
        </div>

        <div className="hero-right">
          <TrustRingGraphic />
        </div>
      </section>

      <section className="how-it-works">
        <div className="how-eyebrow">HOW IT WORKS</div>
        <div className="how-grid">
          <div className="how-card stagger-item" style={{ animationDelay: '0ms' }}>
            <span className="how-number">01</span>
            <h3>Paste a username</h3>
            <p>Any public Instagram profile — no login or permission from them required.</p>
          </div>
          <div className="how-card stagger-item" style={{ animationDelay: '120ms' }}>
            <span className="how-number">02</span>
            <h3>Real trained AI models run</h3>
            <p>A trained fake-follower classifier and a fine-tuned language model reading the bio and captions — both real, both trained by us. Plus rule-based checks for engagement and credential claims.</p>
          </div>
          <div className="how-card stagger-item" style={{ animationDelay: '240ms' }}>
            <span className="how-number">03</span>
            <h3>Get a full breakdown</h3>
            <p>Not just a score — every number explained in plain English, with the raw data available if you want to dig deeper.</p>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="trust-strip-item">
          <span className="trust-strip-value"><CountUp value={95.8} decimals={1} duration={1200} />%</span>
          <span className="trust-strip-label">Fake follower model accuracy</span>
        </div>
        <div className="trust-strip-item">
          <span className="trust-strip-value"><CountUp value={77} duration={1200} />%</span>
          <span className="trust-strip-label">Misinformation classifier accuracy</span>
        </div>
        <div className="trust-strip-item">
          <span className="trust-strip-value">Free</span>
          <span className="trust-strip-label">No subscription to check a profile</span>
        </div>
      </section>
    </div>
  )
}

export default Landing
