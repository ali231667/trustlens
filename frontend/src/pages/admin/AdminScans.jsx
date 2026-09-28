import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi } from '../../api/trustlens'
import { PageHeader, Card, VerdictPill, ScoreCell, ErrorBanner, EmptyState, Pagination } from './AdminUi'
import { useAdminResource } from './useAdminResource'
import { timeAgo, formatDateTime, compactNumber, formatNumber } from './adminFormat'

const VERDICTS = ['all', 'Trusted', 'Moderate Risk', 'High Risk']
const OWNERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'logged_in', label: 'Signed-in users' },
  { key: 'anonymous', label: 'Anonymous' },
  { key: 'corrected', label: 'Score corrected' },
]

function AdminScans() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const verdict = params.get('verdict') || 'all'
  const owner = params.get('owner') || 'all'
  const page = Number(params.get('page') || 1)
  const [draft, setDraft] = useState(search)
  const [draftFor, setDraftFor] = useState(search)

  // Follow the URL when it changes from outside the box (back button, or a
  // link like "Accounts people check most" on the overview).
  if (draftFor !== search) {
    setDraftFor(search)
    setDraft(search)
  }

  useEffect(() => {
    if (draft === search) return
    const t = setTimeout(() => update({ search: draft, page: 1 }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  function update(next) {
    const m = { search, verdict, owner, page, ...next }
    const clean = {}
    if (m.search) clean.search = m.search
    if (m.verdict !== 'all') clean.verdict = m.verdict
    if (m.owner !== 'all') clean.owner = m.owner
    if (m.page > 1) clean.page = m.page
    setParams(clean)
  }

  const { data, error, loading, reload } = useAdminResource(
    () => adminApi.scans({ search, verdict, owner, page, page_size: 25 }),
    [search, verdict, owner, page],
  )

  return (
    <div className={loading && data ? 'adm-refreshing' : ''}>
      <PageHeader
        eyebrow="SCORE HISTORY"
        title="Scans"
        subtitle={data ? `${formatNumber(data.total)} ${data.total === 1 ? 'scan' : 'scans'} across the whole platform` : undefined}
      />

      <div className="adm-filterbar">
        <input
          className="adm-input adm-search"
          type="search"
          placeholder="Search @username"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Search scanned accounts"
        />
        <select className="adm-input adm-select" value={verdict} onChange={(e) => update({ verdict: e.target.value, page: 1 })} aria-label="Verdict">
          {VERDICTS.map((v) => <option key={v} value={v}>{v === 'all' ? 'Any verdict' : v}</option>)}
        </select>
        <select className="adm-input adm-select" value={owner} onChange={(e) => update({ owner: e.target.value, page: 1 })} aria-label="Who ran it">
          {OWNERS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <ErrorBanner message={error} onRetry={reload} />

      <Card>
        {!data && loading && <p className="adm-muted">Loading…</p>}
        {data && data.items.length === 0 && <EmptyState title="No scans match">Try a different search or filter.</EmptyState>}
        {data && data.items.length > 0 && (
          <>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Account scanned</th>
                  <th className="adm-num">Followers</th>
                  <th className="adm-num">Bot %</th>
                  <th className="adm-num">Trust score</th>
                  <th>Verdict</th>
                  <th>Run by</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="adm-row-link">
                    <td>
                      <Link to={`/admin/scans/${s.id}`} className="adm-row-anchor">
                        <span className="adm-cell-strong">@{s.username}</span>
                        {s.full_name && <span className="adm-cell-sub">{s.full_name}</span>}
                      </Link>
                    </td>
                    <td className="adm-num">{compactNumber(s.followers)}</td>
                    <td className="adm-num">{s.bot_percentage ?? '—'}</td>
                    <td className="adm-num"><ScoreCell score={s.trust_score} corrected={s.corrected_trust_score} /></td>
                    <td><VerdictPill verdict={s.corrected_verdict || s.verdict} /></td>
                    <td>{s.owner_email ? <Link to={`/admin/users/${s.user_id}`} className="adm-link">{s.owner_email}</Link> : <span className="adm-muted">Anonymous</span>}</td>
                    <td title={formatDateTime(s.scanned_at)}>{timeAgo(s.scanned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => update({ page: p })} />
          </>
        )}
      </Card>
    </div>
  )
}

export default AdminScans
