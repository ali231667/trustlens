function AuthPanel() {
  return (
    <div className="auth-panel">
      <div className="eyebrow-chip">
        <span className="eyebrow-dot" />
        Free Trust Verification
      </div>

      <h2 className="auth-panel-title">
        See who's really<br />behind the <span>profile.</span>
      </h2>

      <p className="auth-panel-subtitle">
        An account keeps every scan you run saved to your own history —
        so you can track influencers over time and compare accounts later,
        instead of losing the result the moment you close the tab.
      </p>

      <div className="auth-panel-features">
        <div className="auth-panel-feature">
          <span className="auth-panel-feature-mark">→</span>
          <div className="auth-panel-feature-text">
            <strong>Fake follower detection</strong>
            <span>A trained Random Forest model, not guesswork — 95.8% accuracy on a held-out test set.</span>
          </div>
        </div>
        <div className="auth-panel-feature">
          <span className="auth-panel-feature-mark">→</span>
          <div className="auth-panel-feature-text">
            <strong>Misinformation check</strong>
            <span>A fine-tuned language model reads the bio for scam language and false claims.</span>
          </div>
        </div>
        <div className="auth-panel-feature">
          <span className="auth-panel-feature-mark">→</span>
          <div className="auth-panel-feature-text">
            <strong>Credential Extractor</strong>
            <span>Flags claimed professional credentials (e.g. "Dr.", "CFA") in the bio and scores how confidently they hold up.</span>
          </div>
        </div>
      </div>

      <div className="auth-panel-stats">
        <div>
          <span className="auth-panel-stat-value">95.8%</span>
          <span className="auth-panel-stat-label">Fake follower accuracy</span>
        </div>
        <div>
          <span className="auth-panel-stat-value">77%</span>
          <span className="auth-panel-stat-label">Misinfo classifier accuracy</span>
        </div>
        <div>
          <span className="auth-panel-stat-value">Free</span>
          <span className="auth-panel-stat-label">No subscription</span>
        </div>
      </div>
    </div>
  )
}

export default AuthPanel
