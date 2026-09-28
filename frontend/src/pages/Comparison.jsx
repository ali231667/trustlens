import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import PageShell from '../components/site/PageShell'
import ScoreRing from '../components/site/ScoreRing'
import Reveal from '../components/site/Reveal'
import { analyzeProfile } from '../api/trustlens'
import { useAuth } from '../context/AuthContext'
import { parseUsername, USERNAME_HELP } from '../lib/scanFlow'
import { toneFor } from '../lib/verdict'
import './Comparison.css'

function summarySentence(resultA, resultB) {
  const a = resultA.trust_score.trust_score
  const b = resultB.trust_score.trust_score
  const diff = Math.abs(a - b)

  if (diff < 5) {
    return `Both profiles score about the same (${a} vs ${b}). Neither stands out as clearly more trustworthy.`
  }
  const higher = a > b ? resultA.username : resultB.username
  const lower = a > b ? resultB.username : resultA.username
  return `@${higher} scores notably higher than @${lower} (${Math.max(a, b)} vs ${Math.min(a, b)}).`
}

function engagementText(eng) {
  return eng.engagement_score === null || eng.engagement_score === undefined ? 'Not measured' : `${eng.engagement_rate}%`
}

function ProfileCard({ result, winner }) {
  const tone = toneFor(result.trust_score.verdict)
  return (
    <div className={`cmp-card tl-card ${winner ? 'is-winner' : ''}`}>
      {winner && <span className="cmp-winner tl-chip tl-chip-ink tl-chip-plain">Scores higher</span>}
      <div className="cmp-card-who">
        <span className="tl-avatar" aria-hidden="true">{result.username.charAt(0).toUpperCase()}</span>
        <div>
          <strong>@{result.username}</strong>
          <span>{result.full_name || ' '}</span>
        </div>
      </div>
      <ScoreRing score={result.trust_score.trust_score} tone={tone} size={200} />
      <span className={`tl-chip tl-chip-${tone}`}>{result.trust_score.verdict}</span>
      <dl className="cmp-card-facts">
        <div><dt>Followers</dt><dd>{result.raw_profile_data.followers.toLocaleString()}</dd></div>
        <div><dt>Engagement</dt><dd>{engagementText(result.engagement_analysis)}</dd></div>
        <div><dt>Likely genuine</dt><dd>{Math.round((100 - result.fake_follower_analysis.bot_percentage) * 10) / 10}%</dd></div>
      </dl>
      <Link to={`/results?id=${result.scan_id ?? ''}`} state={{ result }} className="tl-btn tl-btn-outline tl-btn-sm">Open full result</Link>
    </div>
  )
}

// better: 'high' | 'low' | null — which side gets the highlight, if any.
function Row({ label, a, b, better = null, rawA, rawB }) {
  let win = null
  if (better && typeof rawA === 'number' && typeof rawB === 'number' && rawA !== rawB) {
    win = (better === 'high' ? rawA > rawB : rawA < rawB) ? 'a' : 'b'
  }
  return (
    <div className="cmp-row">
      <span className={`cmp-row-val ${win === 'a' ? 'is-win' : ''}`}>{a}</span>
      <span className="cmp-row-label">{label}</span>
      <span className={`cmp-row-val ${win === 'b' ? 'is-win' : ''}`}>{b}</span>
    </div>
  )
}

function HeadToHead({ resultA, resultB }) {
  const pA = resultA.raw_profile_data
  const pB = resultB.raw_profile_data
  const ffA = resultA.fake_follower_analysis
  const ffB = resultB.fake_follower_analysis
  const engA = resultA.engagement_analysis
  const engB = resultB.engagement_analysis
  const miA = resultA.misinformation_analysis
  const miB = resultB.misinformation_analysis
  const misinfoText = (m) => (m?.status === 'success' ? (m.misinformation_flag ? 'Flagged' : 'Clear') : 'Not checked')

  return (
    <div className="cmp-h2h tl-card">
      <div className="cmp-h2h-head">
        <span>@{resultA.username}</span>
        <span className="tl-mono">vs</span>
        <span>@{resultB.username}</span>
      </div>

      <div className="cmp-group">Overall</div>
      <Row label="Trust Score" a={resultA.trust_score.trust_score} b={resultB.trust_score.trust_score} better="high"
        rawA={resultA.trust_score.trust_score} rawB={resultB.trust_score.trust_score} />
      <Row label="Verdict" a={resultA.trust_score.verdict} b={resultB.trust_score.verdict} />

      <div className="cmp-group">Profile</div>
      <Row label="Followers" a={pA.followers.toLocaleString()} b={pB.followers.toLocaleString()} />
      <Row label="Posts" a={pA.posts} b={pB.posts} />
      <Row label="Private account" a={pA.is_private ? 'Yes' : 'No'} b={pB.is_private ? 'Yes' : 'No'} />

      {/* The model judges each account itself from its own profile — it
          does not inspect followers — so the section says so. */}
      <div className="cmp-group">Account authenticity</div>
      <Row label="Fake-account likelihood" a={`${ffA.bot_percentage}%`} b={`${ffB.bot_percentage}%`} better="low"
        rawA={ffA.bot_percentage} rawB={ffB.bot_percentage} />
      <Row label="Follower / following ratio" a={ffA.follower_follow_ratio} b={ffB.follower_follow_ratio} />
      <Row label="Model’s call" a={ffA.prediction ? 'Looks fake' : 'Looks genuine'} b={ffB.prediction ? 'Looks fake' : 'Looks genuine'} />

      <div className="cmp-group">Engagement</div>
      <Row label="Engagement rate" a={engagementText(engA)} b={engagementText(engB)} />
      <Row label="Engagement score" a={engA.engagement_score ?? 'n/a'} b={engB.engagement_score ?? 'n/a'} better="high"
        rawA={engA.engagement_score} rawB={engB.engagement_score} />
      <Row label="Normal for its size"
        a={engA.benchmark === null || engA.benchmark === undefined ? 'n/a' : `${engA.benchmark}% (${engA.tier})`}
        b={engB.benchmark === null || engB.benchmark === undefined ? 'n/a' : `${engB.benchmark}% (${engB.tier})`} />

      <div className="cmp-group">Content</div>
      <Row label="Misinformation" a={misinfoText(miA)} b={misinfoText(miB)} />
      <Row label="Credential claims"
        a={resultA.credential_analysis?.claims_found?.length ? resultA.credential_analysis.claims_found.join(', ') : 'None'}
        b={resultB.credential_analysis?.claims_found?.length ? resultB.credential_analysis.claims_found.join(', ') : 'None'} />
    </div>
  )
}

function Comparison() {
  const { user, loading: authLoading, signedOut } = useAuth()
  const location = useLocation()
  const [inputA, setInputA] = useState(location.state?.a || '')
  const [inputB, setInputB] = useState('')
  const [results, setResults] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running) return
    const started = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250)
    return () => clearInterval(t)
  }, [running])

  if (authLoading) return null
  if (!user) return <Navigate to={signedOut ? '/' : '/login?next=/comparison'} replace />

  async function handleCompare(e) {
    e.preventDefault()
    const a = parseUsername(inputA)
    const b = parseUsername(inputB)
    if (!a || !b) {
      setError(!inputA.trim() || !inputB.trim() ? 'Enter two usernames to compare.' : USERNAME_HELP)
      return
    }
    if (a === b) {
      setError('Those are the same account. Pick two different ones.')
      return
    }

    setRunning(true)
    setElapsed(0)
    setError('')
    setResults(null)
    try {
      // Both are real scans (they're saved to your history too), run at once.
      const [ra, rb] = await Promise.all([analyzeProfile(a), analyzeProfile(b)])
      setResults([ra, rb])
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setRunning(false)
    }
  }

  function swap() {
    setInputA(inputB)
    setInputB(inputA)
    if (results) setResults([results[1], results[0]])
  }

  const [ra, rb] = results || []
  const diff = results ? ra.trust_score.trust_score - rb.trust_score.trust_score : 0

  return (
    <PageShell title="Compare" className="cmp-page">
      <section className="cmp-head">
        <div className="tl-pagehead-blob" aria-hidden="true" />
        <div className="tl-wrap cmp-head-inner">
          <span className="tl-eyebrow">Compare two profiles</span>
          <h1 className="tl-display cmp-title">This<br /><span className="tl-grad-text">or that?</span></h1>
          <p className="tl-lede">
            Choosing between two creators for a campaign, or just curious? Both go through the same checks, side by side.
            Each one is a real scan and is saved to your dashboard.
          </p>

          <form className="cmp-form" onSubmit={handleCompare} noValidate>
            <div className="tl-scanbar cmp-bar">
              <span className="tl-scanbar-at" aria-hidden="true">@</span>
              <input
                aria-label="First Instagram username"
                value={inputA}
                onChange={(e) => { setInputA(e.target.value); setError('') }}
                placeholder="first_username"
                autoComplete="off"
                spellCheck="false"
                disabled={running}
              />
            </div>
            <button type="button" className="cmp-vs" onClick={swap} disabled={running} title="Swap sides" aria-label="Swap the two usernames">
              VS
            </button>
            <div className="tl-scanbar cmp-bar">
              <span className="tl-scanbar-at" aria-hidden="true">@</span>
              <input
                aria-label="Second Instagram username"
                value={inputB}
                onChange={(e) => { setInputB(e.target.value); setError('') }}
                placeholder="second_username"
                autoComplete="off"
                spellCheck="false"
                disabled={running}
              />
            </div>
            <button type="submit" className="tl-btn tl-btn-grad tl-btn-lg cmp-go" disabled={running}>
              {running ? 'Comparing…' : 'Compare'}
            </button>
          </form>
          {error && <p className="tl-alert tl-alert-bad cmp-error" role="alert">{error}</p>}
        </div>
      </section>

      <section className="tl-band tl-band-tint cmp-results">
        <div className="tl-wrap">
          {running && (
            <div className="cmp-running">
              <span className="tl-spinner" aria-hidden="true" />
              <div>
                <strong>Scanning both profiles</strong>
                <span className="tl-mono">{elapsed}s elapsed</span>
              </div>
            </div>
          )}

          {!running && !results && (
            <div className="tl-empty">
              <h3>Two usernames, one answer</h3>
              <p>Enter both above. Tap VS to swap them round.</p>
            </div>
          )}

          {!running && results && (
            <>
              <Reveal>
                <p className="cmp-summary">{summarySentence(ra, rb)}</p>
              </Reveal>
              <div className="cmp-grid">
                <Reveal delay={0}><ProfileCard result={ra} winner={diff >= 5} /></Reveal>
                <div className="cmp-mid" aria-hidden="true">VS</div>
                <Reveal delay={120}><ProfileCard result={rb} winner={diff <= -5} /></Reveal>
              </div>
              <Reveal><HeadToHead resultA={ra} resultB={rb} /></Reveal>
            </>
          )}
        </div>
      </section>
    </PageShell>
  )
}

export default Comparison
