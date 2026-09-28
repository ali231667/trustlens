// One place that maps the backend's verdicts to the design's colour roles,
// so a verdict can never be green on one page and amber on another.
// Thresholds come from backend/trust_score.py's verdict_for().

export const VERDICT_TONE = {
  Trusted: 'ok',
  'Moderate Risk': 'warn',
  'High Risk': 'bad',
}

export function toneFor(verdict) {
  return VERDICT_TONE[verdict] || 'warn'
}

// The backend's per-module colour words, mapped to the same roles.
export function toneFromColor(color) {
  if (color === 'green') return 'ok'
  if (color === 'yellow') return 'warn'
  if (color === 'red') return 'bad'
  return 'neutral'
}

export const TONE_FILL = { ok: '#00D4AA', warn: '#F2B84D', bad: '#FF6B5B', neutral: '#B9A9C9' }

export function formatDate(iso) {
  if (!iso) return ''
  // The backend stores UTC without a zone suffix.
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
