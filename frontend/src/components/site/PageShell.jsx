import { useEffect } from 'react'
import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'

// Every public page: nav on top, footer at the bottom, the page in between.
// `title` sets the browser tab text so tabs are tellable apart.
function PageShell({ title, className = '', footer = true, children }) {
  useEffect(() => {
    document.title = title ? `${title} · TrustLens` : 'TrustLens'
  }, [title])

  return (
    <div className={`tl-page ${className}`}>
      <SiteNav />
      <main className="tl-main">{children}</main>
      {footer && <SiteFooter />}
    </div>
  )
}

export default PageShell
