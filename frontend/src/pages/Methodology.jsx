import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import CountUp from '../components/CountUp'
import networkImage from '../assets/follower_network.png'
import './Methodology.css'

// This page demonstrates the graph-theory + Manhattan-distance clustering
// method our scope document specifies for Fake Follower Detection. It is
// deliberately NOT the Results page: it runs on a fixed, labelled research
// dataset (1,890 real Instagram accounts), not on whatever profile you just
// searched. Live per-scan fake-follower scoring still comes entirely from
// the separate Random Forest model — see the honesty note below.
function Methodology() {
  return (
    <div className="methodology-page">
      <div className="glow-backdrop" />
      <Navbar />

      <div className="methodology-hero">
        <div className="eyebrow-chip">
          <span className="eyebrow-dot" />
          GRAPH THEORY IN ACTION
        </div>
        <h1 className="methodology-title">
          Finding bot farms<br /><span className="methodology-title-accent">by how they cluster.</span>
        </h1>
        <p className="methodology-subtitle">
          One question the Trust Score can't answer alone: is a group of
          followers a coordinated bot farm, not just individually fake
          accounts? This page shows the real technique that answers it —
          Manhattan distance and graph clustering, run on real labelled data.
        </p>
      </div>

      <div className="methodology-explain">
        <div className="methodology-explain-card stagger-item" style={{ animationDelay: '0ms' }}>
          <span className="methodology-step-tag">01</span>
          <h3>Real people scatter</h3>
          <p>
            Genuine accounts are all different — different post counts,
            different follower ratios, different bios. Measured against each
            other, they spread out.
          </p>
        </div>
        <div className="methodology-explain-card stagger-item" style={{ animationDelay: '100ms' }}>
          <span className="methodology-step-tag">02</span>
          <h3>Bot farms clump</h3>
          <p>
            Accounts built in batches by the same script share a fingerprint
            — no profile picture, empty bio, near-zero posts. Measured the
            same way, they pile on top of each other.
          </p>
        </div>
        <div className="methodology-explain-card stagger-item" style={{ animationDelay: '200ms' }}>
          <span className="methodology-step-tag">03</span>
          <h3>The graph reveals it</h3>
          <p>
            We connect every pair of accounts that are unusually close in
            Manhattan distance, then run Louvain community detection to find
            the dense knots — the bot clusters — automatically.
          </p>
        </div>
      </div>

      <div className="methodology-figure">
        <img src={networkImage} alt="Follower similarity network graph — bot clusters shown in red, genuine communities in green" />
        <p className="methodology-figure-caption">
          Every dot is one of 1,890 real, labelled Instagram accounts. Every line means two
          accounts behave almost identically. The dense red knots are bot clusters the
          algorithm found on its own — it was never told which accounts were fake.
        </p>
      </div>

      <div className="methodology-stat-banner">
        <div className="methodology-stat">
          <span className="methodology-stat-value"><CountUp value={94.7} decimals={1} duration={1200} />%</span>
          <span className="methodology-stat-label">Precision — when it flags a cluster, this often it's really fake</span>
        </div>
        <div className="methodology-stat">
          <span className="methodology-stat-value"><CountUp value={38.9} decimals={1} duration={1200} />%</span>
          <span className="methodology-stat-label">Recall — catches coordinated farms, not lone fakes (by design)</span>
        </div>
        <div className="methodology-stat">
          <span className="methodology-stat-value"><CountUp value={81.6} decimals={1} duration={1200} />%</span>
          <span className="methodology-stat-label">Overall accuracy on the labelled dataset</span>
        </div>
      </div>

      <div className="methodology-honesty">
        <h3>Why isn't this on the Results page?</h3>
        <p>
          Because it genuinely can't be, honestly. This method needs a list of an
          account's real followers to cluster — and Instagram restricts fetching
          follower lists far more heavily than profile or post data. We tested this
          directly and confirmed the follower-list endpoint isn't usable live.
        </p>
        <p>
          So this page proves the technique works on real, labelled data instead
          of pretending it runs on-demand for whichever profile you search. The
          Results page's Follower Authenticity score comes from a separate, real
          trained model — a Random Forest, 95.8% accuracy — that <em>does</em> run
          live on every scan. Both are genuine; they answer different questions,
          and we'd rather tell you the difference than blur it.
        </p>
      </div>
    </div>
  )
}

export default Methodology
