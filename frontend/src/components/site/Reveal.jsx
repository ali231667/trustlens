import { useEffect, useRef, useState } from 'react'

// Fades its content up the first time it scrolls into view. Once shown it
// stays shown (no flicker when scrolling back). If IntersectionObserver
// isn't available, or the user prefers reduced motion (handled in CSS),
// content is simply visible.
function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (shown || !ref.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [shown])

  return (
    <Tag
      ref={ref}
      className={`tl-reveal ${shown ? 'is-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export default Reveal
