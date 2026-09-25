import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import './Dashboard.css'
import { getScanHistory } from '../api/trustlens'
import { useAuth } from '../context/AuthContext'
import CountUp from '../components/CountUp'

function scoreColorClass(score) {
  if (score >= 70) return ''
  if (score >= 40) return 'score-yellow'
  return 'score-red'
}

function Dashboard() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    getScanHistory()
      .then(setScans)
      .catch((err) => setError(err.message || 'Could not load scan history.'))
      .finally(() => setLoading(false))
  }, [user])

  if (authLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const totalScans = scans.length
  const flaggedHighRisk = scans.filter((s) => s.verdict === 'High Risk').length
  const avgScore = totalScans
    ? (scans.reduce((sum, s) => sum + s.trust_score, 0) / totalScans).toFixed(1)
    : '—'

  const firstName = user.full_name?.split(' ')[0] || 'there'

  return (
    <div className="dashboard-page">
      <div className="glow-backdrop" />
      <Navbar />
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <div className="dashboard-eyebrow">WELCOME BACK, {firstName.toUpperCase()}</div>
            <h1 className="dashboard-title">Your scans</h1>
          </div>
          <button className="dashboard-new-scan" onClick={() => navigate('/')}>+ New scan</button>
        </div>

        {totalScans > 0 && (
          <div className="dashboard-tip">
            <span className="dashboard-tip-label">TIP</span>
            <span>
              Before trusting a sponsorship, collab, or financial advice from any account,
              run it through TrustLens first — it takes under a minute and could save you from a scam.
            </span>
          </div>
        )}

        <div className="dashboard-stats">
          <div className="stat-block stagger-item" style={{ animationDelay: '0ms' }}>
            <span className="stat-value"><CountUp value={totalScans} /></span>
            <span className="stat-label">Total scans</span>
          </div>
          <div className="stat-block stagger-item" style={{ animationDelay: '90ms' }}>
            <span className="stat-value"><CountUp value={flaggedHighRisk} /></span>
            <span className="stat-label">Flagged high risk</span>
          </div>
          <div className="stat-block stagger-item" style={{ animationDelay: '180ms' }}>
            <span className={`stat-value ${scoreColorClass(Number(avgScore))}`}>
              {totalScans ? <CountUp value={Number(avgScore)} decimals={1} /> : '—'}
            </span>
            <span className="stat-label">Avg trust score</span>
          </div>
        </div>

        <div className="scan-log">
          <div className="scan-log-header">
            <span>Profile</span>
            <span>Trust score</span>
            <span>Verdict</span>
          </div>

          {loading && <div className="dashboard-empty">Loading scan history…</div>}
          {!loading && error && <div className="dashboard-empty">{error}</div>}
          {!loading && !error && totalScans === 0 && (
            <div className="dashboard-empty">
              No scans on your account yet. Scans you run <strong>while logged in</strong> will show up here —
              if you scanned a profile before logging in, that one isn't tied to your account, so it won't appear.
              <br />
              <button className="dashboard-empty-cta" onClick={() => navigate('/')}>
                Run a new scan now →
              </button>
            </div>
          )}

          {!loading && !error && scans.map((scan) => (
            <div className="scan-log-row" key={scan.id}>
              <div className="scan-log-profile">
                <span className={`scan-avatar avatar-${scan.color}`}>
                  {scan.username.charAt(0).toUpperCase()}
                </span>
                <span className="scan-log-username">@{scan.username}</span>
              </div>
              <span className="scan-log-score">{scan.trust_score}</span>
              <span className={`scan-log-verdict verdict-pill-${scan.color}`}>
                <span className="verdict-dot"></span>
                {scan.verdict}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
