import { useEffect, useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getQueryHistory, getMetricsSummary } from '../services/api'

const CHART_TOOLTIP = {
  contentStyle: { background: '#1f2937', border: '1px solid #374151', borderRadius: 8 },
  labelStyle: { color: '#f9fafb' },
  itemStyle: { color: '#d1d5db' },
}
const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }
const GRID_STROKE = '#374151'

const PAGE_SIZE = 10

function scoreBadge(score) {
  if (score == null || score < 0)
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-400">N/A</span>
  if (score >= 0.7)
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">{score.toFixed(2)}</span>
  if (score >= 0.4)
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">{score.toFixed(2)}</span>
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">{score.toFixed(2)}</span>
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function trunc(str, n) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

function ChartCard({ title, children, height = 220 }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h2 className="text-base font-semibold text-white mb-6">{title}</h2>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function EmptyChart({ message = 'No data yet.' }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  )
}

function buildDistribution(history) {
  const buckets = [
    { range: '0.0–0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2–0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4–0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6–0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8–1.0', min: 0.8, max: 1.01, count: 0 },
  ]
  for (const row of history) {
    if (row.faithfulness == null || row.faithfulness < 0) continue
    const bucket = buckets.find((b) => row.faithfulness >= b.min && row.faithfulness < b.max)
    if (bucket) bucket.count++
  }
  return buckets
}

function buildCumCost(history) {
  let running = 0
  return [...history].reverse().map((row, i) => {
    running += row.cost_estimate_usd ?? 0
    return { index: i + 1, cost: parseFloat(running.toFixed(6)) }
  })
}

export default function Analytics() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    Promise.all([getQueryHistory(100), getMetricsSummary()])
      .then(([histRes]) => setHistory(histRes.data))
      .catch(() => setError('Failed to load analytics. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  const distData = buildDistribution(history)

  const latencyData = [...history].reverse().map((row, i) => ({
    index: i + 1,
    Retrieval: row.retrieval_latency_ms != null ? Math.round(row.retrieval_latency_ms) : null,
    Generation: row.generation_latency_ms != null ? Math.round(row.generation_latency_ms) : null,
  }))

  const tokenData = [...history].reverse().map((row, i) => ({
    index: i + 1,
    'Input tokens': row.input_tokens ?? 0,
    'Output tokens': row.output_tokens ?? 0,
  }))

  const costData = buildCumCost(history)

  const totalPages = Math.ceil(history.length / PAGE_SIZE)
  const pageRows = history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="h-5 w-40 bg-gray-700 rounded mb-6 animate-pulse" />
            <div className="h-52 bg-gray-700/40 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Deep-dive into pipeline performance</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {/* Score Distribution */}
      <ChartCard title="Score Distribution — Faithfulness">
        {history.length === 0 ? (
          <EmptyChart message="No queries yet to build a distribution." />
        ) : (
          <BarChart data={distData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="range" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip {...CHART_TOOLTIP} />
            <Bar dataKey="count" name="Queries" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ChartCard>

      {/* Latency Analysis */}
      <ChartCard title="Latency Analysis (ms per Query)">
        {latencyData.length === 0 ? (
          <EmptyChart />
        ) : (
          <AreaChart data={latencyData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gRetrieval" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gGeneration" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="index" tick={AXIS_TICK} axisLine={false} tickLine={false} label={{ value: 'Query #', position: 'insideBottomRight', fill: '#6b7280', fontSize: 11, dy: 10 }} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip {...CHART_TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Area type="monotone" dataKey="Retrieval" stroke="#10b981" strokeWidth={2} fill="url(#gRetrieval)" connectNulls />
            <Area type="monotone" dataKey="Generation" stroke="#3b82f6" strokeWidth={2} fill="url(#gGeneration)" connectNulls />
          </AreaChart>
        )}
      </ChartCard>

      {/* Token Usage */}
      <ChartCard title="Token Usage per Query">
        {tokenData.length === 0 ? (
          <EmptyChart />
        ) : (
          <BarChart data={tokenData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="index" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip {...CHART_TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Bar dataKey="Input tokens" stackId="tokens" fill="#10b981" />
            <Bar dataKey="Output tokens" stackId="tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ChartCard>

      {/* Cumulative Cost */}
      <ChartCard title="Cumulative Cost (USD)">
        {costData.length === 0 ? (
          <EmptyChart />
        ) : (
          <LineChart data={costData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="index" tick={AXIS_TICK} axisLine={false} tickLine={false} label={{ value: 'Query #', position: 'insideBottomRight', fill: '#6b7280', fontSize: 11, dy: 10 }} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(4)}`} width={72} />
            <Tooltip {...CHART_TOOLTIP} formatter={(v) => [`$${v.toFixed(6)}`, 'Cumulative cost']} />
            <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ChartCard>

      {/* Full Query History Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Full Query History</h2>
          <span className="text-xs text-gray-500">{history.length} total</span>
        </div>

        {history.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No queries yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                    <th className="text-left pb-3 font-medium pr-4">Query</th>
                    <th className="text-left pb-3 font-medium pr-4">Answer</th>
                    <th className="text-left pb-3 font-medium">Faith.</th>
                    <th className="text-left pb-3 font-medium">Relevancy</th>
                    <th className="text-right pb-3 font-medium">Latency</th>
                    <th className="text-right pb-3 font-medium">Cost</th>
                    <th className="text-right pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {pageRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="py-3 pr-4 text-gray-300 max-w-45">{trunc(row.query, 50)}</td>
                      <td className="py-3 pr-4 text-gray-400 max-w-50">{trunc(row.answer, 80)}</td>
                      <td className="py-3">{scoreBadge(row.faithfulness)}</td>
                      <td className="py-3">{scoreBadge(row.answer_relevancy)}</td>
                      <td className="py-3 text-right text-gray-400 whitespace-nowrap">
                        {row.total_latency_ms != null ? `${Math.round(row.total_latency_ms)} ms` : '—'}
                      </td>
                      <td className="py-3 text-right text-gray-500 whitespace-nowrap">
                        {row.cost_estimate_usd != null ? `$${row.cost_estimate_usd.toFixed(5)}` : '—'}
                      </td>
                      <td className="py-3 text-right text-gray-500 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                <span className="text-xs text-gray-500">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
