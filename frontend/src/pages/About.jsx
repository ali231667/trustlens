import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import CountUp from '../components/CountUp'
import './About.css'

function About() {
  const steps = [
    { tag: 'INGEST', color: 'green', title: 'Real profile data', desc: 'We pull live followers, posts, bio, and engagement directly from Instagram — no manual entry, nothing typed in by hand.' },
    { tag: 'ANALYZE', color: 'amber', title: 'Two real trained AI models', desc: 'A Random Forest model (95.8% accuracy on a held-out test set) scores follower authenticity, and a fine-tuned language model reads the bio and post captions for misinformation. Engagement Analysis and Credential Extraction are original rule-based logic, not AI — matching what our scope document actually calls for in those two modules.' },
    { tag: 'EXPLAIN', color: 'green', title: 'Every number, explained', desc: 'Not just a score — a plain-English breakdown of exactly what each check found, with the raw data available if you want to dig deeper.' },
    { tag: 'SCORE', color: 'red', title: 'One weighted trust score', desc: 'Every signal is weighted per our published formula and combined into a single 0–100 score with a clear verdict, plus a kill-switch that caps the score if a severe bot cluster is confirmed.' },
  ]

  return (
    <div className="about-page">
      <div className="glow-backdrop" />
      <Navbar />

      <div className="about-hero">
        <div className="eyebrow-chip">
          <span className="eyebrow-dot" />
          HOW IT WORKS
        </div>
        <h1 className="about-title">
          Not a black box.<br /><span className="about-title-accent">An audit trail.</span>
        </h1>
        <p className="about-subtitle">
          TrustLens doesn't guess — every score is backed by real data and models
          you can inspect, not a hidden formula. Here's exactly what happens
          when you scan a profile.
        </p>
      </div>

      <div className="about-steps">
        {steps.map((step, i) => (
          <div
            className={`about-step step-${step.color} stagger-item`}
            style={{ animationDelay: `${i * 100}ms` }}
            key={step.tag}
          >
            <div className="about-step-number">{`0${i + 1}`}</div>
            <div>
              <span className={`about-step-tag tag-${step.color}`}>{step.tag}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="about-stat-banner">
        <div className="about-stat">
          <span className="about-stat-value"><CountUp value={95.8} decimals={1} duration={1200} />%</span>
          <span className="about-stat-label">Fake follower model accuracy</span>
        </div>
        <div className="about-stat">
          <span className="about-stat-value"><CountUp value={77} duration={1200} />%</span>
          <span className="about-stat-label">Misinformation classifier accuracy</span>
        </div>
        <div className="about-stat">
          <span className="about-stat-value">&lt;60s</span>
          <span className="about-stat-label">Typical scan time</span>
        </div>
      </div>
    </div>
  )
}

export default About
