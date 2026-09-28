import Brand from './Brand'

// The gradient half of the Login / Sign up screens. When a scan is waiting,
// it leads with that, so it's obvious why the visitor landed here.
function AuthSide({ pending, mode }) {
  return (
    <aside className="au-side">
      <div className="au-side-blob au-side-blob-a" aria-hidden="true" />
      <div className="au-side-blob au-side-blob-b" aria-hidden="true" />

      <div className="au-side-top">
        <Brand />
      </div>

      <div className="au-side-body">
        {pending ? (
          <div className="au-waiting">
            <span className="au-waiting-label">Your scan is waiting</span>
            <div className="au-waiting-card">
              <span className="tl-avatar" aria-hidden="true">{pending.charAt(0).toUpperCase()}</span>
              <div>
                <strong>@{pending}</strong>
                <span>Starts automatically once you’re {mode === 'signup' ? 'signed up' : 'logged in'}</span>
              </div>
              <span className="au-waiting-pulse" aria-hidden="true" />
            </div>
          </div>
        ) : null}

        <h2 className="tl-display au-side-title">
          {mode === 'signup' ? <>Know who’s<br />real.</> : <>Welcome<br />back.</>}
        </h2>
        <p className="au-side-lede">
          {mode === 'signup'
            ? 'A free account keeps every scan on your own dashboard, so you can reopen a result later and dispute a score you think is wrong.'
            : 'Your scans, your disputes and their outcomes are all on your dashboard.'}
        </p>

        <ul className="au-side-points">
          <li><span aria-hidden="true">01</span>Fake-account model, 95.8% on a held-out test set</li>
          <li><span aria-hidden="true">02</span>Bio and captions read for scams, in English and Urdu</li>
          <li><span aria-hidden="true">03</span>Every number explained, and open to dispute</li>
        </ul>
      </div>

      <p className="au-side-foot">Free · Public Instagram accounts only · No Instagram login needed</p>
    </aside>
  )
}

export default AuthSide
