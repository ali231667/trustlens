import { Link } from 'react-router-dom'
import PageShell from '../components/site/PageShell'
import './NotFound.css'

function NotFound() {
  return (
    <PageShell title="Page not found" className="nf-page">
      <section className="nf">
        <div className="tl-pagehead-blob" aria-hidden="true" />
        <div className="tl-wrap nf-inner">
          <span className="tl-eyebrow">Error 404</span>
          <h1 className="tl-display nf-title">Real<br /><span className="tl-grad-text">or 404?</span></h1>
          <p className="tl-lede">This one’s not real. The page you were after doesn’t exist, or it moved.</p>
          <div className="nf-actions">
            <Link to="/" className="tl-btn tl-btn-grad tl-btn-lg">Go home</Link>
            <Link to="/scan" className="tl-btn tl-btn-outline tl-btn-lg">Scan a profile</Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}

export default NotFound
