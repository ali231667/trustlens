import { Link } from 'react-router-dom'

export function BrandMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="14" cy="14" r="10.5" fill="none" stroke="#00D4AA" strokeWidth="5" />
      <circle cx="14" cy="14" r="3.2" fill="#00D4AA" />
      <rect x="21.5" y="19" width="6" height="14" rx="3" fill="#00D4AA" transform="rotate(-45 24.5 26)" />
    </svg>
  )
}

function Brand({ to = '/' }) {
  return (
    <Link to={to} className="tl-brand" aria-label="TrustLens home">
      <BrandMark />
      TrustLens
    </Link>
  )
}

export default Brand
