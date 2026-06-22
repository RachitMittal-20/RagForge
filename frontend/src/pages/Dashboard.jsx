import { useCallback, useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Activity, Zap, Clock, DollarSign, RefreshCw } from 'lucide-react'
import ScoreCard from '../components/ScoreCard'
import AnimatedBadge from '../components/AnimatedBadge'
import GlowButton from '../components/GlowButton'
import { getMetricsSummary, getQueryHistory } from '../services/api'

const TOOLTIP_STYLE = {
  contentStyle: { background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f8fafc', fontSize: 12 },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
  itemStyle: { color: '#cbd5e1' },
}

function latencyColor(ms) {
  if (ms == null) return '#475569'
  if (ms < 500) return '#10b981'
  if (ms < 1500) return '#f59e0b'
  return '#ef4444'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Skeleton({ h = 10, w = '100%', radius = 8 }) {
  return (
    <div className="shimmer" style={{ height: h, width: w, borderRadius: radius }} />
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
      <div style={{ marginBottom: 16 }}><Skeleton h={40} w={40} radius={10} /></div>
      <Skeleton h={28} w={80} radius={6} />
      <div style={{ marginTop: 8 }}><Skeleton h={14} w={120} radius={4} /></div>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    Promise.all([getMetricsSummary(), getQueryHistory(10)])
      .then(([s, h]) => { setSummary(s.data); setHistory(h.data) })
      .catch(() => setError('Failed to load dashboard data. Is the backend running?'))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const trendData = summary?.score_trend?.map((d) => ({
    date: d.date.slice(5),
    Faithfulness: d.avg_faithfulness,
    Relevancy: d.avg_answer_relevancy,
  })) ?? []

  const hasTrend = trendData.some((d) => d.Faithfulness != null || d.Relevancy != null)

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>RAG pipeline performance at a glance</p>
        </div>
        <GlowButton variant="ghost" size="sm" loading={refreshing} onClick={() => fetchData(true)}>
          <RefreshCw size={13} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </GlowButton>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) : (
          <>
            <ScoreCard title="Total Queries" value={summary?.total_queries ?? 0} subtitle={`${summary?.queries_today ?? 0} today`} icon={Activity} color="violet" delay={0} />
            <ScoreCard title="Avg Faithfulness" value={summary?.avg_faithfulness != null ? summary.avg_faithfulness.toFixed(3) : '—'} subtitle="RAGAs score" icon={Zap} color="cyan" delay={80} />
            <ScoreCard title="Avg Latency" value={summary?.avg_total_latency_ms != null ? `${Math.round(summary.avg_total_latency_ms)} ms` : '—'} subtitle="End-to-end" icon={Clock} color="emerald" delay={160} />
            <ScoreCard title="Total Cost" value={summary?.total_cost_usd != null ? `$${summary.total_cost_usd.toFixed(4)}` : '—'} subtitle="Groq API estimated" icon={DollarSign} color="orange" delay={240} />
          </>
        )}
      </div>

      {/* Score trend chart */}
      <div className="glass-card" style={{ borderRadius: 16, padding: 24 }}>
        <div className="section-bar" style={{ marginBottom: 20 }}>
          <h2 className="section-label">Score Trend — Last 7 Days</h2>
        </div>

        {loading ? (
          <div className="shimmer" style={{ height: 220, borderRadius: 10 }} />
        ) : !hasTrend ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              No score data yet.{' '}
              <span style={{ color: '#a78bfa' }}>Run some queries in the Playground</span>{' '}
              to see trends.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gFaith" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 12 }} />
              <Area type="monotone" dataKey="Faithfulness" stroke="#7c3aed" strokeWidth={2} fill="url(#gFaith)" dot={false} connectNulls />
              <Area type="monotone" dataKey="Relevancy" stroke="#06b6d4" strokeWidth={2} fill="url(#gRel)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent queries table */}
      <div className="glass-card" style={{ borderRadius: 16, padding: 24 }}>
        <div className="section-bar" style={{ marginBottom: 16 }}>
          <h2 className="section-label">Recent Queries</h2>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={36} radius={8} />)}
          </div>
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            No queries yet.{' '}
            <span style={{ color: '#a78bfa' }}>Go to Playground to get started.</span>
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Query', 'Faithfulness', 'Latency', 'Time'].map((h, i) => (
                  <th key={h} className="section-label" style={{ padding: '0 0 10px', textAlign: i > 1 ? 'right' : 'left', paddingRight: i === 0 ? 16 : 0 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px 12px 0', color: '#e2e8f0', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.query.length > 65 ? row.query.slice(0, 65) + '…' : row.query}
                  </td>
                  <td style={{ padding: '12px 0' }}>
                    <AnimatedBadge score={row.faithfulness} />
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    <span className="mono" style={{ fontSize: 12, color: latencyColor(row.total_latency_ms) }}>
                      {row.total_latency_ms != null ? `${Math.round(row.total_latency_ms)} ms` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                    {formatDate(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
