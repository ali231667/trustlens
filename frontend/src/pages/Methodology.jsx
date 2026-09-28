import { Link } from 'react-router-dom'
import PageShell from '../components/site/PageShell'
import Reveal from '../components/site/Reveal'
import CountUp from '../components/CountUp'
import networkImage from '../assets/follower_network.png'
import './Methodology.css'

// This page demonstrates the graph-theory + Manhattan-distance clustering
// method our scope document specifies for Fake Follower Detection. It is
// deliberately NOT the Results page: it runs on a fixed, labelled research
// dataset (1,890 real Instagram accounts), not on whatever profile you just
// searched. Live per-scan fake-account scoring still comes entirely from
// the separate Random Forest model — see the honesty note below.

const IDEAS = [
  {
    n: '01', swatch: 'md-sw-blue', title: 'Real people scatter',
    body: 'Genuine accounts are all different: different post counts, follower ratios, bios. Measured against each other, they spread out.',
    art: 'scatter',
  },
  {
    n: '02', swatch: 'md-sw-pink', title: 'Bot farms clump',
    body: 'Accounts made in batches by the same script share a fingerprint: no photo, empty bio, almost no posts. Measured the same way, they pile up.',
    art: 'clump',
  },
  {
    n: '03', swatch: 'md-sw-purple', title: 'The graph shows it',
    body: 'Link every pair of accounts that are unusually close in Manhattan distance, then Louvain community detection finds the dense knots by itself.',
    art: 'graph',
  },
]

function IdeaArt({ kind }) {
  if (kind === 'scatter') {
    const dots = [[18, 22], [70, 14], [44, 48], [86, 60], [22, 74], [60, 82], [34, 30], [78, 36], [12, 50], [52, 64]]
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#FFFFFF" />)}
      </svg>
    )
  }
  if (kind === 'clump') {
    const dots = [[44, 44], [52, 40], [48, 52], [56, 50], [40, 52], [50, 46], [46, 58], [58, 44], [42, 38], [54, 56]]
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="49" cy="48" r="22" fill="rgba(255,255,255,0.18)" />
        {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill="#FFFFFF" />)}
        <circle cx="16" cy="80" r="4.5" fill="#FFFFFF" opacity="0.6" />
        <circle cx="84" cy="18" r="4.5" fill="#FFFFFF" opacity="0.6" />
      </svg>
    )
  }
  const nodes = [[30, 30], [42, 24], [38, 40], [26, 44], [70, 62], [80, 70], [66, 76], [76, 54], [52, 50]]
  const edges = [[0, 1], [0, 2], [1, 2], [2, 3], [0, 3], [4, 5], [5, 6], [4, 6], [4, 7], [5, 7], [2, 8], [8, 4]]
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" />
      ))}
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill={i >= 4 && i <= 7 ? '#FF6B5B' : '#FFFFFF'} />)}
    </svg>
  )
}

function Methodology() {
  return (
    <PageShell title="Methodology" className="md-page">
      <section className="tl-pagehead">
        <div className="tl-pagehead-blob" aria-hidden="true" />
        <div className="tl-wrap">
          <span className="tl-eyebrow">Graph theory in action</span>
          <h1 className="tl-display tl-pagehead-title">Finding bot farms<br /><span className="tl-grad-text">by how they cluster.</span></h1>
          <p className="tl-lede tl-pagehead-lede">
            One question the Trust Score can’t answer on its own: is a group of accounts a coordinated bot farm, not just a few
            individually fake ones? This is the technique that answers it, Manhattan distance and graph clustering, run on
            real labelled data.
          </p>
        </div>
      </section>

      <section className="tl-band tl-band-tint">
        <div className="tl-wrap">
          <div className="md-ideas">
            {IDEAS.map((it, i) => (
              <Reveal key={it.n} delay={i * 100} className="md-idea tl-card tl-card-hover">
                <span className={`md-idea-art ${it.swatch}`}><IdeaArt kind={it.art} /></span>
                <span className="md-idea-n tl-mono">{it.n}</span>
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="tl-band tl-band-plum md-figure">
        <div className="tl-wrap md-figure-grid">
          <div className="md-figure-copy">
            <span className="tl-eyebrow">The result</span>
            <h2 className="tl-display md-sec-title">1,890 accounts.<br /><span className="tl-grad-text">One picture.</span></h2>
            <p className="tl-lede">
              Every dot is a real, labelled Instagram account. Every line means two accounts behave almost identically.
              The dense red knots are bot clusters the algorithm found on its own. It was never told which accounts were fake.
            </p>
          </div>
          <Reveal className="md-figure-img">
            <img src={networkImage} alt="Follower similarity network: bot clusters in red, genuine communities in green" />
          </Reveal>
        </div>
        <div className="tl-wrap">
          <div className="md-stats">
            <div>
              <span className="md-stat-value"><CountUp value={94.7} decimals={1} duration={1200} />%</span>
              <span className="md-stat-label">Precision. When it flags a cluster, it’s really fake this often.</span>
            </div>
            <div>
              <span className="md-stat-value"><CountUp value={38.9} decimals={1} duration={1200} />%</span>
              <span className="md-stat-label">Recall. It catches coordinated farms, not lone fakes, by design.</span>
            </div>
            <div>
              <span className="md-stat-value"><CountUp value={81.6} decimals={1} duration={1200} />%</span>
              <span className="md-stat-label">Overall accuracy on the labelled dataset.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="tl-band">
        <div className="tl-wrap-narrow">
          <Reveal className="md-honest tl-card tl-card-pad">
            <span className="tl-eyebrow">Being straight about it</span>
            <h2 className="md-honest-title">Why isn’t this on the Results page?</h2>
            <p>
              Because honestly, it can’t be. This method needs a list of an account’s real followers to cluster, and Instagram
              restricts fetching follower lists far more heavily than profile or post data. We tested it directly and
              confirmed the follower-list endpoint isn’t usable live.
            </p>
            <p>
              So this page proves the technique works on real, labelled data instead of pretending it runs for whichever
              profile you search. The Results page’s account authenticity score comes from a separate trained model, a Random
              Forest at 95.8% accuracy, that <em>does</em> run live on every scan. Both are genuine. They answer different
              questions, and we’d rather tell you the difference than blur it.
            </p>
            <div className="md-honest-actions">
              <Link to="/about" className="tl-btn tl-btn-outline">How a scan works</Link>
              <Link to="/scan" className="tl-btn tl-btn-grad">Scan a profile</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  )
}

export default Methodology
