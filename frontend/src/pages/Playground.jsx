import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Loader2, Send } from 'lucide-react'
import { queryRAG } from '../services/api'

function scoreColor(score) {
  if (score == null || score < 0) return { ring: 'border-gray-600', text: 'text-gray-500' }
  if (score >= 0.7) return { ring: 'border-emerald-500', text: 'text-emerald-400' }
  if (score >= 0.4) return { ring: 'border-yellow-500', text: 'text-yellow-400' }
  return { ring: 'border-red-500', text: 'text-red-400' }
}

function CircleScore({ label, value }) {
  const { ring, text } = scoreColor(value)
  const display = value != null && value >= 0 ? value.toFixed(2) : '—'
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-16 h-16 rounded-full border-4 ${ring} flex items-center justify-center`}>
        <span className={`text-base font-bold ${text}`}>{display}</span>
      </div>
      <span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
    </div>
  )
}

function HallucinationBar({ value }) {
  const pct = value != null ? Math.round(value * 100) : null
  const color = value == null ? 'bg-gray-600' : value < 0.4 ? 'bg-emerald-500' : value < 0.7 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
        <span>Hallucination Risk</span>
        <span>{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: pct != null ? `${pct}%` : '0%' }} />
      </div>
    </div>
  )
}

export default function Playground() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSourcesOpen(false)
    try {
      const res = await queryRAG(query.trim())
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Query failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const scores = result?.eval_scores
  const metrics = result?.metrics

  return (
    <div className="h-full flex">
      {/* Left panel */}
      <div className="flex-3 p-8 flex flex-col gap-6 border-r border-gray-800 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Playground</h1>
          <p className="text-gray-400 text-sm mt-1">Ask questions against your document corpus</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
            placeholder="Ask a question about your documents…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-emerald-500 transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
            }}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Thinking…' : 'Ask RagForge'}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
        )}

        {result && (
          <>
            {/* Answer */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Answer</div>
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
            </div>

            {/* Sources */}
            {result.sources?.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <button
                  onClick={() => setSourcesOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
                >
                  <span>Sources ({result.sources.length})</span>
                  {sourcesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {sourcesOpen && (
                  <div className="divide-y divide-gray-700 border-t border-gray-700">
                    {result.sources.map((src, i) => (
                      <div key={i} className="px-5 py-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded font-medium">
                            {src.filename}
                          </span>
                          <span className="text-xs text-gray-500">score: {src.score.toFixed(3)}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{src.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-2 p-8 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold text-white">Evaluation Scores</h2>
          <p className="text-gray-500 text-xs mt-1">Powered by RAGAs</p>
        </div>

        {/* Circular scores */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex justify-around">
            <CircleScore label="Faithfulness" value={scores?.faithfulness} />
            <CircleScore label="Answer Relevancy" value={scores?.answer_relevancy} />
            <CircleScore label="Context Precision" value={scores?.context_precision} />
          </div>
          {scores?.error && (
            <p className="text-xs text-yellow-500/80 text-center mt-4 bg-yellow-500/10 rounded-lg px-3 py-2">
              {scores.error}
            </p>
          )}
        </div>

        {/* Hallucination risk */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <HallucinationBar value={scores?.hallucination_risk} />
        </div>

        {/* Metrics grid */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-3">
          <div className="text-xs font-semibold uppercase text-gray-400">Metrics</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Retrieval', value: metrics?.retrieval_latency_ms != null ? `${Math.round(metrics.retrieval_latency_ms)} ms` : '—' },
              { label: 'Generation', value: metrics?.generation_latency_ms != null ? `${Math.round(metrics.generation_latency_ms)} ms` : '—' },
              { label: 'Tokens in', value: metrics?.input_tokens ?? '—' },
              { label: 'Tokens out', value: metrics?.output_tokens ?? '—' },
              { label: 'Cost', value: scores?.cost_estimate_usd != null ? `$${scores.cost_estimate_usd.toFixed(5)}` : '—' },
              { label: 'Context use', value: scores?.context_utilization != null ? scores.context_utilization.toFixed(2) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 rounded-lg px-3 py-2.5">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {!result && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 text-sm text-center">Ask a question to see<br />evaluation results here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
