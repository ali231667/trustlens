import { useEffect, useRef, useState } from 'react'
import { formatNumber, parseUtc } from './adminFormat'

// Chart colours were chosen with the dataviz palette validator against this
// console's card surface, not by eye. Originally #101513; re-run against the
// plum surface (#2B1140) after the 2026-09-26 re-skin, and every check still
// passes (CVD separation 9.0, contrast >= 3:1):
//
//   NEUTRAL  #3987e5            a plain count. Deliberately NOT green, so a
//                               "scans per day" bar can never be read as a
//                               verdict of "good".
//   VERDICT  #20A27E / #BA8C30 / #C23B36
//                               Trusted / Moderate Risk / High Risk. Deeper
//                               steps of the app's own verdict hues: the
//                               brighter originals sit above the dark-mode
//                               lightness band. All checks pass — worst
//                               colour-blind separation 9.0 (target >= 8).
//
// Colour is never the only signal: every verdict bar also carries its name.
const NEUTRAL = '#3987e5'
const VERDICT_COLORS = {
  Trusted: '#20A27E',
  'Moderate Risk': '#BA8C30',
  'High Risk': '#C23B36',
}

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// A column with a 4px rounded data end and a square foot on the baseline.
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} ` +
         `L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
}

function niceMax(v) {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= v / 4) * pow
  return Math.ceil(v / step) * step
}

function shortDay(isoDate) {
  const d = parseUtc(`${isoDate}T00:00:00`)
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : isoDate
}

/**
 * Daily counts as columns. One series, so no legend box — the card title
 * says what is plotted. Each column is its own hover/focus target; the
 * "View as table" toggle makes every value reachable without hovering.
 */
export function DailyColumns({ data, unit = 'scans', ariaLabel }) {
  const [wrapRef, width] = useWidth()
  const [hover, setHover] = useState(null)
  const [asTable, setAsTable] = useState(false)

  const height = 180
  const pad = { top: 22, right: 8, bottom: 26, left: 30 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom

  const values = data.map((d) => d.count)
  const max = niceMax(Math.max(...values, 0))
  const total = values.reduce((a, b) => a + b, 0)
  const slot = data.length ? innerW / data.length : 0
  const barW = Math.min(24, Math.max(4, slot - 6))
  const y = (v) => pad.top + innerH - (v / max) * innerH

  const peakIdx = values.indexOf(Math.max(...values))
  const lastIdx = data.length - 1
  // Counts are whole numbers, so the gridlines are too.
  const ticks = [0, Math.round(max / 2), max]
  const xLabels = new Set([0, Math.floor(lastIdx / 2), lastIdx])

  return (
    <div className="adm-chart">
      <div ref={wrapRef} className="adm-chart-plot">
        {width > 0 && !asTable && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="adm-grid" />
                <text x={pad.left - 8} y={y(t)} className="adm-axis" textAnchor="end" dominantBaseline="middle">
                  {formatNumber(t)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const cx = pad.left + slot * i + slot / 2
              const h = (d.count / max) * innerH
              const showLabel = d.count > 0 && (i === peakIdx || i === lastIdx)
              return (
                <g
                  key={d.date}
                  tabIndex={0}
                  className="adm-bar-group"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${shortDay(d.date)}: ${d.count} ${unit}`}
                >
                  {/* Hit area: the full slot, not just the painted bar. */}
                  <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent" />
                  {h > 0 && (
                    <path
                      d={columnPath(cx - barW / 2, y(d.count), barW, h)}
                      fill={NEUTRAL}
                      className={hover === i ? 'adm-bar adm-bar-hover' : 'adm-bar'}
                    />
                  )}
                  {showLabel && (
                    <text x={cx} y={y(d.count) - 7} textAnchor="middle" className="adm-bar-label">
                      {d.count}
                    </text>
                  )}
                  {xLabels.has(i) && (
                    <text x={cx} y={height - 8} textAnchor="middle" className="adm-axis">
                      {shortDay(d.date)}
                    </text>
                  )}
                </g>
              )
            })}

            <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="adm-baseline" />
          </svg>
        )}

        {hover !== null && !asTable && data[hover] && (
          <div
            className="adm-tooltip"
            style={{ left: Math.min(Math.max(pad.left + slot * hover + slot / 2, 60), width - 60), top: 4 }}
          >
            <span className="adm-tooltip-value">{formatNumber(data[hover].count)}</span>
            <span className="adm-tooltip-label">{unit} · {shortDay(data[hover].date)}</span>
          </div>
        )}

        {asTable && (
          <table className="adm-table adm-table-compact">
            <thead><tr><th>Day</th><th className="adm-num">{unit}</th></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}><td>{shortDay(d.date)}</td><td className="adm-num">{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="adm-chart-foot">
        <span className="adm-muted">{formatNumber(total)} {unit} in the last {data.length} days</span>
        <button className="adm-link-btn" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>
    </div>
  )
}

/**
 * Verdict split as horizontal bars. These colours MEAN something (good /
 * caution / bad), which is the one case status colours are allowed for —
 * and each row still names its verdict in text next to its bar.
 */
export function VerdictBars({ verdicts }) {
  const order = ['Trusted', 'Moderate Risk', 'High Risk']
  const total = order.reduce((s, k) => s + (verdicts[k] || 0), 0)
  const max = Math.max(...order.map((k) => verdicts[k] || 0), 1)

  if (!total) {
    return <p className="adm-muted">No scans yet — this fills in as profiles are scanned.</p>
  }

  return (
    <ul className="adm-hbars" aria-label="Scans by verdict">
      {order.map((k) => {
        const n = verdicts[k] || 0
        const pct = Math.round((n / total) * 100)
        return (
          <li key={k} className="adm-hbar-row" title={`${k}: ${n} scans (${pct}%)`}>
            <span className="adm-hbar-name">
              <span className="adm-key" style={{ background: VERDICT_COLORS[k] }} aria-hidden="true" />
              {k}
            </span>
            <span className="adm-hbar-track">
              {n > 0 && (
                <span
                  className="adm-hbar-fill"
                  style={{ width: `${(n / max) * 100}%`, background: VERDICT_COLORS[k] }}
                />
              )}
            </span>
            <span className="adm-hbar-value">
              <strong>{formatNumber(n)}</strong> <span className="adm-muted">{pct}%</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
