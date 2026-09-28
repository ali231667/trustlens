import { useCallback, useEffect, useState } from 'react'
import PageShell from '../components/site/PageShell'
import Reveal from '../components/site/Reveal'
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
  instagram_data: 'Instagram data (RapidAPI)',
  transcriber: 'Speech transcriber (Whisper)',
}

function ServiceRow({ name, up, optional }) {
  const state = up ? 'up' : optional ? 'optional' : 'down'
  const text = up ? 'Running' : optional ? 'Off (optional)' : 'Not running'
  return (
    <li className={`ex-service ex-${state}`}>
      <span className="ex-service-dot" aria-hidden="true" />
      <span className="ex-service-name">{name}</span>
      <span className="ex-service-state tl-mono">{text}</span>
    </li>
  )
}

// Example states of the on-Instagram badge. These mirror what the real
// extension shows (collapsed pill by default; danger and warning open by
// themselves so a real warning is never hidden behind a click), but they
// are illustrations, not results — the page says so.
const EXAMPLES = {
  clean: {
    tab: 'Ordinary post',
    caption: 'New video out now. Link in bio.',
    handle: '@lahore.eats',
    level: 'ok',
    pill: 'Looks OK',
    lines: [['Caption', 'Nothing concerning'], ['Account', 'Looks genuine']],
    autoOpen: false,
  },
  danger: {
    tab: 'Scam post',
    caption: 'GUARANTEED 300% returns in 7 days. DM now, only 5 spots left!',
    handle: '@quick.profits.pk',
    level: 'bad',
    pill: 'Likely scam',
    lines: [['Red flags', 'Guaranteed returns · Urgency · Off-platform contact'], ['Account', 'Looks fake']],
    autoOpen: true,
  },
  reel: {
    tab: 'Reel, audio not heard',
    caption: 'Watch till the end. The secret is in the last 10 seconds.',
    handle: '@daily.reels',
    level: 'warn',
    pill: 'Not fully checked',
    lines: [['Caption', 'Read, nothing concerning'], ['Spoken audio', 'Not heard, so not called safe']],
    autoOpen: false,
  },
}

function BadgePreview() {
  const [which, setWhich] = useState('danger')
  const ex = EXAMPLES[which]
  const [open, setOpen] = useState(ex.autoOpen)

  function pick(key) {
    setWhich(key)
    setOpen(EXAMPLES[key].autoOpen)
  }

  return (
    <div className="ex-preview">
      <div className="ex-tabs" role="tablist" aria-label="Example posts">
        {Object.entries(EXAMPLES).map(([key, e]) => (
          <button
            key={key}
            role="tab"
            aria-selected={which === key}
            className={`ex-tab ${which === key ? 'is-on' : ''}`}
            onClick={() => pick(key)}
          >
            {e.tab}
          </button>
        ))}
      </div>

      <div className={`ex-phone ex-phone-${which}`}>
        <div className="ex-phone-top">
          <span className="ex-phone-handle">{ex.handle}</span>
          <div className={`ex-badge ex-badge-${ex.level} ${open ? 'is-open' : ''}`}>
            <button type="button" className="ex-badge-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <span className="ex-badge-dot" aria-hidden="true" />
              TrustLens · {ex.pill}
              <span className="ex-badge-chev" aria-hidden="true" />
            </button>
            {open && (
              <dl className="ex-badge-body">
                {ex.lines.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            )}
          </div>
        </div>
        <div className="ex-phone-media" aria-hidden="true" />
        <p className="ex-phone-caption"><strong>{ex.handle}</strong> {ex.caption}</p>
      </div>
      <p className="ex-preview-note">Example badges to show how it behaves. Click the badge to open or close it.</p>
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

  // First check on arrival. State is only set once the answer comes back.
  useEffect(() => {
    let cancelled = false
    getExtensionStatus().then((s) => {
      if (!cancelled) {
        setStatus(s)
        setChecking(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const modules = status?.modules || {}
  const gatewayUp = Boolean(status?.running)

  return (
    <PageShell title="Extension" className="ex-page">
      <section className="tl-pagehead ex-head">
        <div className="tl-pagehead-blob" aria-hidden="true" />
        <div className="tl-wrap ex-head-grid">
          <div>
            <span className="tl-eyebrow">Chrome extension</span>
            <h1 className="tl-display tl-pagehead-title ex-title">Check posts<br /><span className="tl-grad-text">while you scroll.</span></h1>
            <p className="tl-lede tl-pagehead-lede">
              The TrustLens extension reads the post you’re already looking at and puts a verdict badge on it. No copying links,
              no switching tabs. It uses the same models as this website, so the two can never disagree about an account.
            </p>
            <div className="ex-head-actions">
              <a className="tl-btn tl-btn-grad tl-btn-lg" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">
                Open Instagram in a new tab
              </a>
              <a className="tl-btn tl-btn-outline tl-btn-lg" href="#install">How to install</a>
            </div>
          </div>
          <BadgePreview />
        </div>
      </section>

      <section className="tl-band tl-band-tint">
        <div className="tl-wrap ex-status-grid">
          <Reveal className={`ex-status tl-card tl-card-pad ${gatewayUp ? 'is-up' : 'is-down'}`}>
            <span className="tl-eyebrow">Live status</span>
            <h2 className="ex-status-title">
              {checking ? 'Checking…' : gatewayUp ? 'Services are running.' : 'Services aren’t running.'}
            </h2>
            <ul className="ex-services">
              <ServiceRow name="Gateway" up={gatewayUp} />
              {['classifier', 'account_model', 'instagram_data', 'transcriber'].map((key) => (
                <ServiceRow key={key} name={SERVICE_LABELS[key]} up={Boolean(modules[key]?.up)} />
              ))}
            </ul>
            <p className="ex-note">
              {gatewayUp
                ? 'Everything the badge needs is running. A reel is only called safe once its audio has been listened to.'
                : <>Start them with <code>start_all.ps1</code> in <code>backend/browser_extension</code>, then check again.</>}
            </p>
            <button className="tl-btn tl-btn-ink" onClick={check} disabled={checking}>
              {checking ? 'Checking…' : 'Check again'}
            </button>
          </Reveal>

          <Reveal delay={100} className="ex-why tl-card-plum tl-card-pad">
            <span className="tl-eyebrow">Why a new tab?</span>
            <h2 className="ex-status-title">Instagram can’t be embedded.</h2>
            <p>
              Instagram tells browsers not to show it inside other websites, as protection against clickjacking. The browser
              enforces that, so no site can get around it honestly. Opening a new tab keeps TrustLens right here behind it.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="tl-band" id="install">
        <div className="tl-wrap ex-install">
          <div>
            <span className="tl-eyebrow">First-time setup</span>
            <h2 className="tl-display ex-sec-title">Five steps<br />in Chrome.</h2>
          </div>
          <ol className="ex-steps">
            {[
              <>Open <code>chrome://extensions</code> in a new tab.</>,
              <>Turn on <strong>Developer mode</strong> with the switch at the top right.</>,
              <>Click <strong>Load unpacked</strong>.</>,
              <>Choose the folder <code>backend/browser_extension/extension</code>.</>,
              <>Reload any Instagram tab that was already open. Extensions only load into tabs opened after installing.</>,
            ].map((text, i) => (
              <Reveal as="li" key={i} delay={i * 70} className="ex-step">
                <span className="ex-step-n">{i + 1}</span>
                <span>{text}</span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="tl-band tl-band-lav">
        <div className="tl-wrap">
          <span className="tl-eyebrow">What the badge checks</span>
          <div className="ex-checks">
            {[
              ['Caption and on-screen text', 'Read by the same misinformation model this website uses, plus rule-based checks for scam patterns: guaranteed returns, disguised links, urgency, off-platform contact.'],
              ['The account itself', 'On a profile page, the same fake-account model this website uses scores the profile. Same model, so the extension and the site can’t disagree.'],
              ['What it couldn’t check', 'Always said out loud. A reel whose audio wasn’t transcribed is reported as not checked, never as safe, because a scam spoken aloud is invisible to a caption-only read.'],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 90} className="ex-check tl-card tl-card-pad tl-card-hover">
                <h3>{title}</h3>
                <p>{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  )
}

export default Extension
