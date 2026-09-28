import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Single-page apps don't reset scroll on navigation the way full page loads
// do, so without this you'd land halfway down a new page. Also makes links
// like "/#pricing" actually scroll to that section after navigating home.
function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      // Give the new page a frame to render before looking for the section.
      const id = decodeURIComponent(hash.slice(1))
      const t = setTimeout(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
      return () => clearTimeout(t)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

export default ScrollManager
