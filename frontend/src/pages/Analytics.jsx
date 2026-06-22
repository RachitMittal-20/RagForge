import { useEffect, useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import AnimatedBadge from '../components/AnimatedBadge'
import GlowButton from '../components/GlowButton'
import { getQueryHistory, getMetricsSummary } from '../services/api'

const PAGE_SIZE = 10

const TT = {
  contentStyle: { background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#f8fafc' },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
  itemStyle: { color: '#cbd5e1' },
}
const AX = { fill: '#475569', fontSize: 11 }
const GRID = 'rgba(255,255,255,0.04)'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function trunc(str, n) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

function buildDist(history) {
  const buckets = [
    { range: '0.0–0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2–0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4–0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6–0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8–1.0', min: 0.8, max: 1.01, count: 0 },
  ]
  for (const r of history) {
    if (r.faithfulness == null || r.faithfulness < 0) continue
    const b = buckets.find((b) => r.faithfulness >= b.min && r.faithfulness < b.max)
    if (b) b.count++
  }
  return buckets
}

function buildCumCost(history) {
  let acc = 0
  return [...history].reverse().map((r, i) => {
    acc += r.cost_estimate_usd ?? 0
    return { index: i + 1, cost: parseFloat(acc.toFixed(6)) }
  })
}

/* Chart card with gradient left border */
function ChartCard({ title, height = 220, children, empty }) {
  return (
    <div className="glass-card" style={{ borderRadius: 16, padding: 24 }}>
      <div className="section-bar" style={{ marginBottom: 20 }}>
        <h2 className="section-label">{title}</h2>
      </div>
      {empty ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No data yet.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="glass-card shimmer" style={{ borderRadius: 16, height: 300 }} />
  )
}

function latencyColor(ms) {
  if (ms == null) return '#475569'
  if (ms < 500) return '#10b981'
  if (ms < 1500) return '#f59e0b'
  return '#ef4444'
}

export default function Analytics() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    Promise.all([getQueryHistory(100), getMetricsSummary()])
      .then(([h]) => setHistory(h.data))
      .catch(() => setError('Failed to load analytics. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  const distData = buildDist(history)

  const latData = [...history].reverse().map((r, i) => ({
    index: i + 1,
    Retrieval: r.retrieval_latency_ms != null ? Math.round(r.retrieval_latency_ms) : null,
    Generation: r.generation_latency_ms != null ? Math.round(r.generation_latency_ms) : null,
  }))

  const tokenData = [...history].reverse().map((r, i) => ({
    index: i + 1,
    'Input': r.input_tokens ?? 0,
    'Output': r.output_tokens ?? 0,
  }))

  const costData = buildCumCost(history)

  const totalPages = Math.ceil(history.length / PAGE_SIZE)
  const pageRows = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 className="gradient-text" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>
          Analytics
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Deep-dive into pipeline performance</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          {/* Score Distribution */}
          <ChartCard title="Score Distribution — Faithfulness" empty={history.length === 0}>
            <BarChart data={distData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="range" tick={AX} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AX} axisLine={false} tickLine={false} />
              <Tooltip {...TT} />
              <Bar dataKey="count" name="Queries" fill="url(#gBar)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ChartCard>

          {/* Latency */}
          <ChartCard title="Latency Analysis (ms per Query)" empty={latData.length === 0}>
            <AreaChart data={latData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gLat1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLat2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="index" tick={AX} axisLine={false} tickLine={false} />
              <YAxis tick={AX} axisLine={false} tickLine={false} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 10 }} />
              <Area type="monotone" dataKey="Retrieval" stroke="#7c3aed" strokeWidth={2} fill="url(#gLat1)" dot={false} connectNulls />
              <Area type="monotone" dataKey="Generation" stroke="#06b6d4" strokeWidth={2} fill="url(#gLat2)" dot={false} connectNulls />
            </AreaChart>
          </ChartCard>

          {/* Token Usage */}
          <ChartCard title="Token Usage per Query" empty={tokenData.length === 0}>
            <BarChart data={tokenData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="index" tick={AX} axisLine={false} tickLine={false} />
              <YAxis tick={AX} axisLine={false} tickLine={false} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 10 }} />
              <Bar dataKey="Input" stackId="t" fill="rgba(124,58,237,0.7)" />
              <Bar dataKey="Output" stackId="t" fill="rgba(6,182,212,0.7)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          {/* Cumulative Cost */}
          <ChartCard title="Cumulative Cost (USD)" empty={costData.length === 0}>
            <LineChart data={costData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="index" tick={AX} axisLine={false} tickLine={false} />
              <YAxis tick={AX} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(4)}`} width={68} />
              <Tooltip {...TT} formatter={(v) => [`$${v.toFixed(6)}`, 'Cumulative']} />
              <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={false}
                style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.5))' }} />
            </LineChart>
          </ChartCard>

          {/* Full History Table */}
          <div className="glass-card" style={{ borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="section-bar">
                <span className="section-label">Full Query History</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{history.length} total</span>
            </div>

            {history.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No queries yet.</p>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['Query', 'Answer', 'Faith.', 'Relev.', 'Latency', 'Cost', 'Time'].map((h, i) => (
                        <th key={h} className="section-label" style={{
                          padding: '0 0 10px',
                          textAlign: i >= 4 ? 'right' : 'left',
                          paddingRight: i < 2 ? 12 : 0,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr
                        key={row.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px 10px 0', color: '#e2e8f0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {trunc(row.query, 50)}
                        </td>
                        <td style={{ padding: '10px 12px 10px 0', color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {trunc(row.answer, 70)}
                        </td>
                        <td style={{ padding: '10px 8px 10px 0' }}><AnimatedBadge score={row.faithfulness} /></td>
                        <td style={{ padding: '10px 0' }}><AnimatedBadge score={row.answer_relevancy} /></td>
                        <td style={{ padding: '10px 0', textAlign: 'right' }}>
                          <span className="mono" style={{ color: latencyColor(row.total_latency_ms) }}>
                            {row.total_latency_ms != null ? `${Math.round(row.total_latency_ms)} ms` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right' }}>
                          <span className="mono" style={{ color: '#475569' }}>
                            {row.cost_estimate_usd != null ? `$${row.cost_estimate_usd.toFixed(5)}` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(row.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Page {page + 1} of {totalPages}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <GlowButton variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</GlowButton>
                      <GlowButton variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</GlowButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
