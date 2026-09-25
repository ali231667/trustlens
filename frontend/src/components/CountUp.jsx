import { useEffect, useState } from 'react'

// Animates a number counting up from 0 to `value` when it first appears.
// Used anywhere a score/stat would otherwise just snap into place.
//
// WHY THERE IS NO "only animate once" REF GUARD HERE
// -------------------------------------------------
// There used to be one, and it silently broke every number on the site in
// development. React's StrictMode deliberately runs each effect twice — mount,
// cleanup, mount again — to surface exactly this kind of bug. The sequence was:
//
//   1. first run  : ref flips to true, animation timer scheduled
//   2. cleanup    : clearTimeout cancels that timer
//   3. second run : ref is already true, so it returns early and never
//                   reschedules anything
//
// The result: `display` stayed at its initial 0 forever, so the Trust Score
// rendered as "0.0" while the ring beside it drew the real score and the
// verdict said "Trusted". It was reported as a backend "zero trust score" bug
// and chased through the database and the scoring maths, which were both fine
// the whole time.
//
// Re-running the animation on a remount is harmless — it always lands on the
// same final value — so the guard bought nothing and cost a lot.
function CountUp({ value, duration = 1000, decimals = 0, delay = 0 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const target = Number(value)

    // A missing or malformed value must not render "NaN" at the user.
    if (!Number.isFinite(target)) {
      setDisplay(0)
      return
    }

    let frame = null
    let cancelled = false

    const startTimer = setTimeout(() => {
      const start = performance.now()
      function tick(now) {
        if (cancelled) return
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setDisplay(target * eased)
        if (progress < 1) frame = requestAnimationFrame(tick)
        else setDisplay(target)
      }
      frame = requestAnimationFrame(tick)
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [value, duration, delay])

  return <>{display.toFixed(decimals)}</>
}

export default CountUp
