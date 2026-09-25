import { useState } from 'react'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import CountUp from '../components/CountUp'
import './Comparison.css'
import { analyzeProfile } from '../api/trustlens'

function colorFromVerdict(verdict) {
  if (verdict === 'Trusted') return 'green'
  if (verdict === 'Moderate Risk') return 'yellow'
  return 'red'
}

function ComparisonCard({ result, delay = 0 }) {
  const profile = {
    username: result.username,
    score: result.trust_score.trust_score,
    verdict: result.trust_score.verdict,
    color: colorFromVerdict(result.trust_score.verdict),
    followers: result.raw_profile_data.followers.toLocaleString(),
    engagement: `${result.engagement_analysis.engagement_rate}%`,
  }

  return (
    <div className={`comparison-card card-${profile.color} stagger-item`} style={{ animationDelay: `${delay}ms` }}>
      <div className="comparison-card-top">
        <div className={`comparison-avatar avatar-${profile.color}`}>
          {profile.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="comparison-username">@{profile.username}</div>
          <div className={`comparison-verdict verdict-text-${profile.color}`}>{profile.verdict}</div>
        </div>
      </div>

      <div className="comparison-score-block">
        <span className="comparison-score-number"><CountUp value={profile.score} decimals={1} duration={1100} /></span>
        <span className="comparison-score-label">TRUST SCORE</span>
      </div>

      <div className="comparison-stats">
        <div className="comparison-stat">
          <span className="comparison-stat-label">Followers</span>
          <span className="comparison-stat-value">{profile.followers}</span>
        </div>
        <div className="comparison-stat">
          <span className="comparison-stat-label">Engagement</span>
          <span className="comparison-stat-value">{profile.engagement}</span>
        </div>
      </div>
    </div>
  )
}

function ComparisonCardSkeleton() {
  return (
    <div className="comparison-card comparison-card-skeleton">
      <div className="comparison-card-top">
        <div className="comparison-avatar avatar-skeleton"></div>
        <div>
          <div className="skeleton-line skeleton-line-short"></div>
          <div className="skeleton-line skeleton-line-shorter"></div>
        </div>
      </div>
      <div className="comparison-score-block">
        <div className="skeleton-line skeleton-line-score"></div>
      </div>
    </div>
  )
}

function summarySentence(resultA, resultB) {
  const a = resultA.trust_score.trust_score
  const b = resultB.trust_score.trust_score
  const nameA = resultA.username
  const nameB = resultB.username
  const diff = Math.abs(a - b)

  if (diff < 5) {
    return `Both profiles score similarly (${a} vs ${b}) — neither stands out as clearly more trustworthy.`
  }
  const higher = a > b ? nameA : nameB
  const lower = a > b ? nameB : nameA
  const higherScore = Math.max(a, b)
  const lowerScore = Math.min(a, b)
  return `@${higher} scores notably higher than @${lower} (${higherScore} vs ${lowerScore}).`
}

function InDepthRow({ label, valueA, valueB }) {
  return (
    <div className="indepth-row">
      <span className="indepth-value">{valueA}</span>
      <span className="indepth-label">{label}</span>
      <span className="indepth-value">{valueB}</span>
    </div>
  )
}

function InDepthComparison({ resultA, resultB }) {
  const pA = resultA.raw_profile_data
  const pB = resultB.raw_profile_data
  const ffA = resultA.fake_follower_analysis
  const ffB = resultB.fake_follower_analysis
  const engA = resultA.engagement_analysis
  const engB = resultB.engagement_analysis

  return (
    <div className="indepth">
      <div className="indepth-eyebrow">IN-DEPTH COMPARISON</div>

      <div className="indepth-section-title">PROFILE BASICS</div>
      <InDepthRow label="Total posts" valueA={pA.posts} valueB={pB.posts} />
      <InDepthRow label="Private account" valueA={pA.is_private ? 'Yes' : 'No'} valueB={pB.is_private ? 'Yes' : 'No'} />
      <InDepthRow label="Bio length" valueA={`${pA.bio_length} chars`} valueB={`${pB.bio_length} chars`} />

      <div className="indepth-section-title">FAKE FOLLOWER DETECTION</div>
      <InDepthRow label="Bot percentage" valueA={`${ffA.bot_percentage}%`} valueB={`${ffB.bot_percentage}%`} />
      <InDepthRow label="Follower/following ratio" valueA={ffA.follower_follow_ratio} valueB={ffB.follower_follow_ratio} />
      <InDepthRow label="Posts per follower" valueA={ffA.posts_per_follower} valueB={ffB.posts_per_follower} />
      <InDepthRow label="Model prediction" valueA={ffA.prediction} valueB={ffB.prediction} />

      <div className="indepth-section-title">ENGAGEMENT ANALYSIS</div>
      <InDepthRow label="Engagement rate" valueA={`${engA.engagement_rate}%`} valueB={`${engB.engagement_rate}%`} />
      <InDepthRow label="Benchmark for tier" valueA={`${engA.benchmark}% (${engA.tier})`} valueB={`${engB.benchmark}% (${engB.tier})`} />
      <InDepthRow label="Like-to-comment ratio" valueA={engA.like_comment_ratio} valueB={engB.like_comment_ratio} />
    </div>
  )
}

function Comparison() {
  const [usernameA, setUsernameA] = useState('')
  const [usernameB, setUsernameB] = useState('')
  const [resultA, setResultA] = useState(null)
  const [resultB, setResultB] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showInDepth, setShowInDepth] = useState(false)

  async function handleCompare() {
    if (!usernameA.trim() || !usernameB.trim()) return

    setLoading(true)
    setError('')
    setResultA(null)
    setResultB(null)

    try {
      const [a, b] = await Promise.all([
        analyzeProfile(usernameA.trim()),
        analyzeProfile(usernameB.trim()),
      ])
      setResultA(a)
      setResultB(b)
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasResults = resultA && resultB

  return (
    <div className="comparison-page">
      <div className="glow-backdrop" />
      <Navbar />

      <div className="comparison-hero">
        <div className="comparison-eyebrow">SIDE-BY-SIDE VERIFICATION</div>
        <h1 className="comparison-title">Compare two profiles head-to-head</h1>
        <p className="comparison-lede">
          Deciding between two influencers for a campaign, or just curious who's more trustworthy?
          Run both through the same real AI pipeline and see the numbers side by side.
        </p>

        <div className="comparison-input-row">
          <input
            type="text"
            placeholder="first_username"
            value={usernameA}
            onChange={(e) => setUsernameA(e.target.value)}
            className="comparison-input"
            disabled={loading}
          />
          <span className="comparison-input-vs">vs</span>
          <input
            type="text"
            placeholder="second_username"
            value={usernameB}
            onChange={(e) => setUsernameB(e.target.value)}
            className="comparison-input"
            disabled={loading}
          />
          <button className="comparison-compare-button" onClick={handleCompare} disabled={loading}>
            {loading ? 'Comparing...' : 'Compare'}
          </button>
        </div>

        {error && <p className="comparison-error">{error}</p>}
      </div>

      <div className="comparison-content">
        {!loading && hasResults && (
          <p className="comparison-summary">{summarySentence(resultA, resultB)}</p>
        )}

        <div className="comparison-grid">
          {loading && (
            <>
              <ComparisonCardSkeleton />
              <ComparisonCardSkeleton />
            </>
          )}
          {!loading && hasResults && (
            <>
              <ComparisonCard result={resultA} delay={0} />
              <ComparisonCard result={resultB} delay={120} />
            </>
          )}
          {!loading && !hasResults && (
            <div className="comparison-empty-state">
              Enter two usernames above to see how they stack up.
            </div>
          )}
        </div>

        {!loading && hasResults && <div className="comparison-vs">VS</div>}

        {!loading && hasResults && (
          <>
            <button
              className="comparison-indepth-toggle"
              onClick={() => setShowInDepth((v) => !v)}
            >
              {showInDepth ? 'Hide' : 'Show'} in-depth comparison {showInDepth ? '▲' : '▼'}
            </button>
            {showInDepth && <InDepthComparison resultA={resultA} resultB={resultB} />}
          </>
        )}
      </div>
    </div>
  )
}

export default Comparison
