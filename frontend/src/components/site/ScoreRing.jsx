import { useEffect, useState } from 'react'
import CountUp from '../CountUp'
import { TONE_FILL } from '../../lib/verdict'

// A real Trust Score, drawn the same way as the landing page's sticker: the
// verdict colour on a dark plum disc, where it has proper contrast. The arc
// sweeps from 0 to the score on mount (the offset is set after a short delay
// so the CSS transition has something to animate from).
function ScoreRing({ score, tone = 'warn', size = 220, label = 'TRUST SCORE', decimals = 1 }) {
  const radius = 78
  const circumference = 2 * Math.PI * radius
  const safe = Math.max(0, Math.min(100, Number(score) || 0))
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    const t = setTimeout(() => setOffset(circumference - (safe / 100) * circumference), 180)
    return () => clearTimeout(t)
  }, [safe, circumference])

  return (
    <div className="tl-ring" style={{ width: size, '--ring-font': `${Math.round(size * 0.22)}px` }}>
      <svg viewBox="0 0 200 200" role="img" aria-label={`Trust Score ${safe} out of 100`}>
        <circle cx="100" cy="100" r="98" fill="#2B1140" />
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="14" />
        <circle
          className="tl-ring-arc"
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={TONE_FILL[tone] || TONE_FILL.warn}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="tl-ring-center">
        <span className="tl-ring-value"><CountUp value={safe} decimals={decimals} duration={1200} /></span>
        <span className="tl-ring-label">{label}</span>
      </div>
    </div>
  )
}

export default ScoreRing
