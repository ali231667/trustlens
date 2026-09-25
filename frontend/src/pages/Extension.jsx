import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import '../components/Navbar.css'
import { getExtensionStatus } from '../api/trustlens'
import './Extension.css'

// The in-app home for Module 11.
//
// WHY INSTAGRAM OPENS IN A NEW TAB RATHER THAN INSIDE THIS PAGE
// ------------------------------------------------------------
// Instagram sends X-Frame-Options / frame-ancestors headers that forbid any
// other site from loading it in an iframe. That is their security control
// against clickjacking, and it is enforced by the browser — there is no
// front-end trick that defeats it, and anything that appeared to would be a
// fake screenshot rather than the live site.
//
// So the button opens Instagram in a new tab and leaves TrustLens open in
// this one. The user tests the extension there and clicks back here when
// done, which is the same "never lose the platform" outcome the supervisor
// asked for, achieved the way the web actually permits.

const SERVICE_LABELS = {
  classifier: 'Misinformation model',
  account_model: 'Fake-account model',
  transcriber: 'Speech transcriber',
}

function ServiceRow({ name, up, optional }) {
  const state = up ? 'up' : optional ? 'optional' : 'down'
  const text = up ? 'running' : optional ? 'not running (optional)' : 'not running'
  return (
    <div className="ext-service">
      <span className={`ext-dot ext-dot-${state}`} />
      <span className="ext-service-name">{name}</span>
      <span className={`ext-service-state ext-state-${state}`}>{text}</span>
    </div>
  )
}

function Extension() {
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(true)

  const check = useCallback(async () => {
    setChecking(true)
    setStatus(await getExtensionStatus())
    setChecking(false)
  }, [])

  useEffect(() => { check() }, [check])

  const modules = status?.modules || {}
  const gatewayUp = Boolean(status?.running)

  return (
    <div className="ext-page">
      <div className="glow-backdrop" />
      <Navbar />

      <div className="ext-hero">
        <div className="eyebrow-chip">
          <span className="eyebrow-dot" />
          BROWSER EXTENSION
        </div>
        <h1 className="ext-title">
          Check posts <span className="ext-title-accent">without leaving Instagram.</span>
        </h1>
        <p className="ext-subtitle">
          The TrustLens extension reads the post you are already looking at and
          puts a verdict badge on screen as you scroll — no copying links, no
          switching tabs to run a scan.
        </p>
      </div>

      <div className="ext-grid">
        {/* ---------------- live status ---------------- */}
        <section className="ext-card">
          <div className="ext-card-eyebrow">LIVE STATUS</div>
          <h2 className="ext-card-title">
            {checking ? 'Checking…' : gatewayUp ? 'Extension services are running' : 'Extension services are not running'}
          </h2>

          <div className="ext-services">
            <ServiceRow name="Gateway" up={gatewayUp} />
            {['classifier', 'account_model', 'transcriber'].map((key) => (
              <ServiceRow
                key={key}
                name={SERVICE_LABELS[key]}
                up={Boolean(modules[key]?.up)}
                optional={key === 'transcriber'}
              />
            ))}
          </div>

          <p className="ext-note">
            {gatewayUp
              ? 'The speech transcriber is optional. Without it a reel’s spoken audio is reported as "not checked" rather than assumed safe.'
              : 'Start them with start_all.ps1 in backend/browser_extension, then press Re-check.'}
          </p>

          <button className="ext-btn ext-btn-ghost" onClick={check} disabled={checking}>
            {checking ? 'Checking…' : 'Re-check services'}
          </button>
        </section>

        {/* ---------------- go test it ---------------- */}
        <section className="ext-card ext-card-action">
          <div className="ext-card-eyebrow">TRY IT</div>
          <h2 className="ext-card-title">Open Instagram and scroll</h2>
          <p className="ext-card-body">
            Instagram opens in a new tab, so this page stays exactly where it
            is. Scroll your feed or a reel, and a badge appears top-right.
            Click the badge to expand the full breakdown. When you are done,
            switch back to this tab.
          </p>

          <a
            className="ext-btn ext-btn-primary"
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Instagram in a new tab
          </a>

          <p className="ext-note ext-note-quiet">
            Instagram blocks other sites from embedding it in a frame, so it
            cannot be shown inside this page. A new tab keeps TrustLens open
            behind it.
          </p>
        </section>

        {/* ---------------- install ---------------- */}
        <section className="ext-card ext-card-wide">
          <div className="ext-card-eyebrow">FIRST TIME SETUP</div>
          <h2 className="ext-card-title">Load the extension into Chrome</h2>
          <ol className="ext-steps">
            <li>
              <span className="ext-step-n">1</span>
              <span>Open <code>chrome://extensions</code> in a new tab.</span>
            </li>
            <li>
              <span className="ext-step-n">2</span>
              <span>Turn on <strong>Developer mode</strong> (top-right toggle).</span>
            </li>
            <li>
              <span className="ext-step-n">3</span>
              <span>Click <strong>Load unpacked</strong>.</span>
            </li>
            <li>
              <span className="ext-step-n">4</span>
              <span>
                Select the folder{' '}
                <code>backend/browser_extension/extension</code>.
              </span>
            </li>
            <li>
              <span className="ext-step-n">5</span>
              <span>
                Reload any Instagram tab that was already open — extensions
                only load into tabs opened after installing.
              </span>
            </li>
          </ol>
        </section>

        {/* ---------------- what it checks ---------------- */}
        <section className="ext-card ext-card-wide">
          <div className="ext-card-eyebrow">WHAT THE BADGE CHECKS</div>
          <div className="ext-checks">
            <div className="ext-check">
              <h3>Caption and on-screen text</h3>
              <p>
                Read by the same misinformation model this website uses, plus a
                rule-based scan for scam patterns — guaranteed-return promises,
                disguised links, urgency, off-platform contact.
              </p>
            </div>
            <div className="ext-check">
              <h3>The account itself</h3>
              <p>
                On a profile page, the same trained fake-account model this
                website uses scores the profile. Same model, so the extension
                and the site can never disagree about an account.
              </p>
            </div>
            <div className="ext-check">
              <h3>What it could not check</h3>
              <p>
                Always stated outright. A reel whose audio was never
                transcribed is reported as not checked, never as safe — a scam
                spoken out loud is invisible to a caption-only read.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Extension
