import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import CountUp from '../components/CountUp'
import './Results.css'

function MisinfoCard({ misinfo, sources }) {
  const checkedCount = sources?.length || 0

  if (!misinfo || misinfo.status !== 'success') {
    return (
      <div className="module-card module-pending">
        <div className="module-eyebrow">MISINFORMATION CHECK</div>
        <div className="module-score">—</div>
        <div className="module-desc">{misinfo?.message || 'No bio or caption text to check'}</div>
      </div>
    )
  }

  const flagged = misinfo.misinformation_flag
  const sourceLabel = misinfo.source === 'caption' ? 'a caption' : 'the bio'
  return (
    <div className="module-card">
      <div className="module-eyebrow">MISINFORMATION CHECK</div>
      <div className={`module-score ${flagged ? 'score-red' : 'score-green'}`}>
        {flagged ? 'Flagged' : 'Credible'}
      </div>
      <div className="module-desc">
        Worst result from {sourceLabel}: {misinfo.primary_category?.replace(/_/g, ' ')} — {Math.round(misinfo.confidence * 100)}% confidence
        {checkedCount > 1 && ` (checked ${checkedCount} texts total)`}
      </div>
    </div>
  )
}

function VerdictBadge({ text, color }) {
  return <span className={`breakdown-badge badge-${color}`}>{text}</span>
}

function BreakdownModule({ title, score, weight, badgeText, badgeColor, explanation, metrics }) {
  return (
    <div className="breakdown-module">
      <div className="breakdown-module-top">
        <span className="breakdown-module-title">{title}</span>
        <span className="breakdown-module-weight">{weight}% of Trust Score</span>
      </div>

      <div className="breakdown-bar-track">
        <div className="breakdown-bar-fill" style={{ width: `${score}%` }} />
      </div>
      <div className="breakdown-module-score">
        Module score: {score}/100 {badgeText && <VerdictBadge text={badgeText} color={badgeColor} />}
      </div>

      {explanation && <p className="breakdown-explanation">{explanation}</p>}

      {metrics?.length > 0 && (
        <details className="breakdown-raw">
          <summary>Show the raw numbers behind this</summary>
          <div className="breakdown-metrics">
            {metrics.map(([label, value]) => (
              <div className="breakdown-metric" key={label}>
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ---- Plain-language interpretation helpers ----
// These translate real computed numbers into a sentence a non-technical
// reader can follow. The thresholds mirror the same logic the backend's
// own rule-based fallback uses (data_ingestion / fake_follower.py), so
// nothing here is invented — it's the same reasoning, just written out.

function describeFollowRatio(ratio, followersCount) {
  if (ratio >= 5) {
    return `This account follows very few people compared to its ${followersCount.toLocaleString()} followers (about ${Math.round(ratio).toLocaleString()} followers for every account it follows). That lopsided ratio is typical of a genuinely popular account — bought followers usually don't produce it.`
  }
  if (ratio >= 0.5) {
    return `This account's ratio of followers to accounts it follows is fairly ordinary — not a strong signal either way.`
  }
  return `This account follows more people than follow it back, which shows up more often on newer or less-established accounts. Not automatically suspicious, but worth weighing alongside the other checks here.`
}

function describeEngagementRate(rate, benchmark, tier) {
  const relation = rate >= benchmark * 1.5 ? 'well above' : rate >= benchmark ? 'at or above' : rate >= benchmark * 0.5 ? 'somewhat below' : 'far below'
  return `On average, ${rate}% of this account's followers interact with each post. For an account this size (the "${tier}" tier), a typical rate is around ${benchmark}% — so this account sits ${relation} what's normal for its size.`
}

function describeLikeCommentRatio(ratio) {
  if (ratio > 500) {
    return `For every comment, this account gets about ${Math.round(ratio).toLocaleString()} likes — an unusually extreme gap that can indicate comments aren't organic.`
  }
  return `For every comment, this account gets about ${Math.round(ratio)} likes. Likes naturally far outnumber comments on real accounts, so this on its own isn't a red flag.`
}

// The one-line summary, for anyone who does not want to read four cards.
//
// Every clause is built from a real value in the API response — nothing here
// is written in advance or padded. When a check did not run, it says so rather
// than quietly leaving it out, so a short summary can never imply that more
// was verified than actually was.
function buildSummary(result) {
  const ff = result.fake_follower_analysis
  const eng = result.engagement_analysis
  const misinfo = result.misinformation_analysis
  const misinfoSources = result.misinformation_sources || []
  const cred = result.credential_analysis
  const verdict = result.trust_score.verdict

  const opening = verdict === 'Trusted' ? 'looks genuine'
    : verdict === 'Moderate Risk' ? 'is a mixed picture'
    : 'looks risky'

  const parts = []

  const genuine = Math.round((100 - ff.bot_percentage) * 10) / 10
  parts.push(`${genuine}% follower authenticity`)

  parts.push(`${String(eng.status).toLowerCase()} engagement (${eng.engagement_rate}%)`)

  if (misinfo && misinfo.status === 'success') {
    const checked = misinfoSources.length
    const scope = `${checked} text${checked === 1 ? '' : 's'}`
    if (misinfo.misinformation_flag) {
      const where = misinfo.source === 'caption' ? 'a caption' : 'the bio'
      parts.push(
        `${String(misinfo.primary_category).replace(/_/g, ' ')} flagged in ${where} (${scope} checked)`
      )
    } else {
      parts.push(`no misinformation across ${scope} checked`)
    }
  } else {
    parts.push('no bio or caption text was available to check')
  }

  // Only mentioned when the bio actually claims something, since "no
  // credentials claimed" is the normal case and not worth a clause.
  if (cred && cred.claims_found && cred.claims_found.length) {
    parts.push(`bio claims ${cred.claims_found.join(', ')} (unverified)`)
  }

  const last = parts.pop()
  return `@${result.username} ${opening} — ${parts.join(', ')}, and ${last}.`
}

function ScoreBreakdown({ result }) {
  const ff = result.fake_follower_analysis
  const eng = result.engagement_analysis
  const misinfo = result.misinformation_analysis
  const misinfoSources = result.misinformation_sources || []
  const cred = result.credential_analysis
  const followersCount = result.raw_profile_data.followers

  // Real weights the backend actually used for this scan — always sums to
  // 100%, since unused modules' weight is redistributed onto whichever
  // modules DID apply (see trust_score.py). Never hardcode these on the
  // frontend; they legitimately change scan to scan.
  const weights = result.trust_score.weights_used || {}
  const misinfoApplicable = 'misinformation' in weights
  const credentialApplicable = 'credential' in weights

  const WEIGHT_FF = weights.fake_follower ?? 0
  const WEIGHT_ENG = weights.engagement ?? 0
  const WEIGHT_MISINFO = weights.misinformation ?? 0
  const WEIGHT_CREDENTIAL = weights.credential ?? 0

  const ffScore = Math.round(100 - ff.bot_percentage)
  const misinfoScore = misinfoApplicable ? Math.round(100 - misinfo.risk_score) : null

  return (
    <div className="breakdown">
      <div className="breakdown-eyebrow">HOW THIS SCORE WAS CALCULATED</div>
      <p className="breakdown-intro">
        Every number below comes straight from the actual checks that ran on this profile — nothing here is estimated or made up for display.
        Weights below aren't fixed — whatever doesn't apply to this specific profile (e.g. no bio text, no credential claim) has its share
        redistributed onto the checks that did run, so the percentages always add up to 100% of real signal, never a filler number.
      </p>

      <BreakdownModule
        title="Fake Follower Detection"
        score={ffScore}
        weight={WEIGHT_FF}
        badgeText={ff.verdict}
        badgeColor={ff.color}
        explanation={describeFollowRatio(ff.follower_follow_ratio, followersCount)}
        metrics={[
          ['Follower-to-following ratio', ff.follower_follow_ratio],
          ['Posts per follower', ff.posts_per_follower],
          ['Has bio text', ff.has_bio ? 'Yes' : 'No'],
        ]}
      />

      <BreakdownModule
        title="Engagement Analysis"
        score={eng.engagement_score}
        weight={WEIGHT_ENG}
        badgeText={eng.status}
        badgeColor={eng.color}
        explanation={`${describeEngagementRate(eng.engagement_rate, eng.benchmark, eng.tier)} ${describeLikeCommentRatio(eng.like_comment_ratio)}`}
        metrics={[
          ['Engagement rate', `${eng.engagement_rate}%`],
          ['Benchmark for its size', `${eng.benchmark}% (${eng.tier} tier)`],
          ['Like-to-comment ratio', eng.like_comment_ratio],
        ]}
      />

      {misinfoApplicable ? (
        <BreakdownModule
          title="Misinformation Check (bio + captions)"
          score={misinfoScore}
          weight={WEIGHT_MISINFO}
          badgeText={misinfo.misinformation_flag ? 'Flagged' : 'Credible'}
          badgeColor={misinfo.misinformation_flag ? 'red' : 'green'}
          explanation={
            `Checked ${misinfoSources.length} piece${misinfoSources.length === 1 ? '' : 's'} of text (bio + recent post captions). ` +
            (misinfo.misinformation_flag
              ? `The worst result came from ${misinfo.source === 'caption' ? 'a post caption' : 'the bio'}: "${misinfo.text_preview}" — flagged as possible "${misinfo.primary_category.replace(/_/g, ' ')}" content, ${Math.round(misinfo.confidence * 100)}% confidence.`
              : `Nothing concerning was found — the least-credible result was still classified as credible with ${Math.round(misinfo.confidence * 100)}% confidence.`)
          }
          metrics={[
            ['Worst result source', misinfo.source === 'caption' ? 'Post caption' : 'Bio'],
            ['Category', misinfo.primary_category?.replace(/_/g, ' ')],
            ['Confidence', `${Math.round(misinfo.confidence * 100)}%`],
            ['Risk score', `${misinfo.risk_score}/100`],
            ...misinfoSources
              .filter((s) => s.status === 'success' && s.misinformation_flag && s !== misinfo)
              .map((s) => [`Also flagged (${s.source})`, `"${s.text_preview}" — ${s.primary_category.replace(/_/g, ' ')}`]),
          ]}
        />
      ) : (
        <div className="breakdown-module breakdown-module-inactive">
          <div className="breakdown-module-top">
            <span className="breakdown-module-title">Misinformation Check (bio + captions)</span>
            <span className="breakdown-module-weight">0% this scan</span>
          </div>
          <p className="breakdown-note">
            This profile had no bio and no post captions to check — its weight was redistributed onto the checks that did run (see above) rather than guessing a score. (Whisper-transcribed reel speech is the one remaining source from the scope document, not yet wired in.)
          </p>
        </div>
      )}

      {credentialApplicable ? (
        <BreakdownModule
          title="Credential Extractor (bio)"
          score={cred.confidence_score}
          weight={WEIGHT_CREDENTIAL}
          badgeText={cred.confidence_score >= 70 ? 'Moderately Credible' : 'Low Confidence'}
          badgeColor={cred.confidence_score >= 70 ? 'green' : 'yellow'}
          explanation={`The bio claims: ${cred.claims_found.join(', ')}. ${cred.verdict}. This is a pattern-matching check on the bio text plus account verification status — it does not independently verify the claim against LinkedIn or a professional registry (that step was deliberately not built, see project notes).`}
          metrics={[
            ['Claims found', cred.claims_found.join(', ')],
            ['Confidence score', `${cred.confidence_score}/100`],
          ]}
        />
      ) : (
        <div className="breakdown-module breakdown-module-inactive">
          <div className="breakdown-module-top">
            <span className="breakdown-module-title">Credential Extractor (bio)</span>
            <span className="breakdown-module-weight">0% this scan</span>
          </div>
          <p className="breakdown-note">
            No professional credential claims (e.g. "Dr.", "CFA", "MBBS") were found in the bio text — its weight was redistributed onto the checks that did run (see above) rather than guessing a score.
          </p>
        </div>
      )}

      <p className="breakdown-footnote">
        Deepfake Scanner and Follower Spike Detection are in the original scope document's weight table but aren't built yet —
        they're not part of this calculation at all, not even at a placeholder value. The percentages above always sum to 100% of real, applicable signal.
      </p>
    </div>
  )
}

function Results() {
  const location = useLocation()
  const navigate = useNavigate()
  const result = location.state?.result
  const [revealed, setRevealed] = useState(0)
  const [showBreakdown, setShowBreakdown] = useState(false)

  if (!result) {
    return <Navigate to="/" replace />
  }

  const colorFromVerdict = (verdict) => {
    if (verdict === 'Trusted') return 'green'
    if (verdict === 'Moderate Risk') return 'yellow'
    return 'red'
  }

  const profile = {
    username: result.username,
    fullName: result.full_name,
    isVerified: result.is_verified,
    trustScore: result.trust_score.trust_score,
    verdict: result.trust_score.verdict,
    color: colorFromVerdict(result.trust_score.verdict),
  }

  const checks = [
    { label: 'Followers analyzed', value: result.raw_profile_data.followers.toLocaleString() },
    { label: 'Fake follower risk', value: `${result.fake_follower_analysis.bot_percentage}%` },
    { label: 'Engagement rate', value: `${result.engagement_analysis.engagement_rate}% — ${result.engagement_analysis.status}` },
    { label: 'Profile completeness', value: profile.isVerified ? 'Verified account' : 'Not verified' },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setRevealed((prev) => (prev < checks.length ? prev + 1 : prev))
    }, 350)
    return () => clearInterval(timer)
  }, [])

  const circumference = 2 * Math.PI * 90
  const targetOffset = circumference - (profile.trustScore / 100) * circumference
  const [ringOffset, setRingOffset] = useState(circumference)

  useEffect(() => {
    const timer = setTimeout(() => setRingOffset(targetOffset), 200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="results-page">
      <div className="glow-backdrop" />
      <Navbar />

      <div className="results-content">
        <div className="eyebrow-chip" style={{ marginBottom: 20 }}>
          <span className="eyebrow-dot" />
          SCAN COMPLETE
        </div>

        <div className="results-profile-strip">
          <div className="results-avatar">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="results-fullname">
              {profile.fullName}
              {profile.isVerified && <span className="verified-badge">✓ verified</span>}
            </div>
            <div className="results-username">@{profile.username}</div>
          </div>
        </div>

        <div className="results-main">
          <div className="score-panel">
            <svg className="score-ring" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" className="score-ring-bg" />
              <circle
                cx="100" cy="100" r="90"
                className={`score-ring-fill ring-${profile.color}`}
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: ringOffset,
                }}
              />
            </svg>
            <div className="score-ring-center">
              <span className="score-number"><CountUp value={profile.trustScore} decimals={1} duration={1200} /></span>
              <span className={`score-verdict verdict-text-${profile.color}`}>
                {profile.verdict}
              </span>
            </div>
          </div>

          <div className="checks-panel">
            <div className="checks-eyebrow">IN ONE LINE</div>
            <p className={`results-summary summary-${profile.color}`}>
              {buildSummary(result)}
            </p>

            <div className="checks-eyebrow checks-eyebrow-spaced">SCAN LOG</div>
            {checks.map((check, i) => (
              <div
                key={check.label}
                className={`check-row ${i < revealed ? 'check-visible' : ''}`}
              >
                <span className="check-mark">{i < revealed ? '✓' : ''}</span>
                <span className="check-label">{check.label}</span>
                <span className="check-value">{i < revealed ? check.value : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modules-grid">
          <div className="module-card stagger-item" style={{ animationDelay: '0ms' }}>
            <div className="module-eyebrow">FOLLOWER AUTHENTICITY</div>
            <div className="module-score score-green">{100 - result.fake_follower_analysis.bot_percentage}% Genuine</div>
            <div className="module-desc">{result.fake_follower_analysis.verdict}</div>
          </div>
          <div className="module-card stagger-item" style={{ animationDelay: '100ms' }}>
            <div className="module-eyebrow">ENGAGEMENT ANALYSIS</div>
            <div className="module-score score-green">{result.engagement_analysis.status}</div>
            <div className="module-desc">{result.engagement_analysis.engagement_rate}% engagement rate — {result.engagement_analysis.tier} tier</div>
          </div>
          <div className="stagger-item" style={{ animationDelay: '200ms' }}>
            <MisinfoCard misinfo={result.misinformation_analysis} sources={result.misinformation_sources} />
          </div>
        </div>

        <button
          className="results-breakdown-toggle"
          onClick={() => setShowBreakdown((v) => !v)}
        >
          {showBreakdown ? 'Hide' : 'Show'} how this score was calculated {showBreakdown ? '▲' : '▼'}
        </button>

        {showBreakdown && <ScoreBreakdown result={result} />}

        <div className="results-next-actions">
          <span className="results-next-label">WHAT NEXT?</span>
          <button className="results-action results-action-primary" onClick={() => navigate('/')}>
            Scan another profile
          </button>
          <button className="results-action" onClick={() => navigate('/comparison')}>
            Compare with another profile
          </button>
          <button className="results-action" onClick={() => navigate('/dashboard')}>
            View scan history
          </button>
        </div>
      </div>
    </div>
  )
}

export default Results