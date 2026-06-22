import { useEffect, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Activity, Zap, Clock, DollarSign, RefreshCw } from 'lucide-react'
import ScoreCard from '../components/ScoreCard'
import { getMetricsSummary, getQueryHistory } from '../services/api'

function scoreBadge(score) {
  if (score == null || score < 0) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-400">N/A</span>
  if (score >= 0.7) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">{score.toFixed(2)}</span>
  if (score >= 0.4) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">{score.toFixed(2)}</span>
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">{score.toFixed(2)}</span>
}

function SkeletonCard() {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-gray-700 mb-4" />
      <div className="h-7 w-24 bg-gray-700 rounded mb-2" />
      <div className="h-4 w-32 bg-gray-700 rounded" />
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const CHART_TOOLTIP = {
  contentStyle: { background: '#1f2937', border: '1px solid #374151', borderRadius: 8 },
  labelStyle: { color: '#f9fafb' },
  itemStyle: { color: '#d1d5db' },
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
      .then(([sumRes, histRes]) => {
        setSummary(sumRes.data)
        setHistory(histRes.data)
      })
      .catch(() => setError('Failed to load dashboard data. Is the backend running?'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const trendData = summary?.score_trend?.map((d) => ({
    date: d.date.slice(5),
    Faithfulness: d.avg_faithfulness,
    'Answer Relevancy': d.avg_answer_relevancy,
  })) ?? []

  const hasTrendData = trendData.some((d) => d.Faithfulness != null || d['Answer Relevancy'] != null)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">RAG pipeline performance overview</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {/* Score Cards */}
      <div className="grid grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <ScoreCard
              title="Total Queries"
              value={summary?.total_queries ?? 0}
              subtitle={`${summary?.queries_today ?? 0} today`}
              icon={Activity}
              color="emerald"
            />
            <ScoreCard
              title="Avg Faithfulness"
              value={summary?.avg_faithfulness != null ? summary.avg_faithfulness.toFixed(3) : '—'}
              subtitle="RAGAs score"
              icon={Zap}
              color="blue"
            />
            <ScoreCard
              title="Avg Latency"
              value={summary?.avg_total_latency_ms != null ? `${Math.round(summary.avg_total_latency_ms)} ms` : '—'}
              subtitle="End-to-end"
              icon={Clock}
              color="purple"
            />
            <ScoreCard
              title="Total Cost"
              value={summary?.total_cost_usd != null ? `$${summary.total_cost_usd.toFixed(4)}` : '—'}
              subtitle="Groq API estimated"
              icon={DollarSign}
              color="orange"
            />
          </>
        )}
      </div>

      {/* Score Trend Chart */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-base font-semibold text-white mb-6">Score Trend (Last 7 Days)</h2>
        {loading ? (
          <div className="h-56 bg-gray-700/40 rounded-lg animate-pulse" />
        ) : !hasTrendData ? (
          <div className="h-56 flex items-center justify-center">
            <p className="text-gray-500 text-sm">No score data yet. Run some queries in the Playground to see trends.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="Faithfulness" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="Answer Relevancy" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent Queries */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-base font-semibold text-white mb-4">Recent Queries</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-700/40 rounded animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-sm py-6 text-center">
            No queries yet. Go to <span className="text-emerald-400">Playground</span> to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                  <th className="text-left pb-3 font-medium">Query</th>
                  <th className="text-left pb-3 font-medium">Faithfulness</th>
                  <th className="text-right pb-3 font-medium">Latency</th>
                  <th className="text-right pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 text-gray-300 max-w-xs">
                      {row.query.length > 60 ? row.query.slice(0, 60) + '…' : row.query}
                    </td>
                    <td className="py-3">{scoreBadge(row.faithfulness)}</td>
                    <td className="py-3 text-right text-gray-400">{row.total_latency_ms != null ? `${Math.round(row.total_latency_ms)} ms` : '—'}</td>
                    <td className="py-3 text-right text-gray-500">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
