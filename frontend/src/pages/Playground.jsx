import { useEffect, useRef, useState } from 'react'
import { ChevronDown, MessageSquare, Send, Trash2 } from 'lucide-react'
import GlowButton from '../components/GlowButton'
import { queryRAG } from '../services/api'

/* ── SVG ring score (unchanged from redesign) ────────────── */
const R = 36
const CIRC = 2 * Math.PI * R

function RingScore({ label, value, color }) {
  const [offset, setOffset] = useState(CIRC)
  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(value != null && value >= 0 ? CIRC * (1 - value) : CIRC)
    }, 150)
    return () => clearTimeout(t)
  }, [value])
  const display = value != null && value >= 0 ? value.toFixed(2) : '—'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 88, height: 88 }}>
        <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle cx="44" cy="44" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color }}>{display}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 72, lineHeight: 1.4 }}>{label}</span>
    </div>
  )
}

function HalluBar({ value }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(value != null ? Math.round(value * 100) : 0), 200)
    return () => clearTimeout(t)
  }, [value])
  const pct = value != null ? Math.round(value * 100) : null
  const color = value == null ? '#475569' : value < 0.4 ? '#10b981' : value < 0.7 ? '#f59e0b' : '#ef4444'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hallucination Risk</span>
        <span className="mono" style={{ fontSize: 12, color }}>{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: pct != null ? `${w}%` : '0%',
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          transition: 'width 0.7s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
    </div>
  )
}

function MetricCell({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{value}</div>
    </div>
  )
}

/* ── Inline score badges for chat messages ───────────────── */
function ScorePill({ label, value }) {
  if (value == null || value < 0) return null
  const color = value >= 0.7 ? '#10b981' : value >= 0.4 ? '#f59e0b' : '#ef4444'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: 6, padding: '1px 7px', fontSize: 11 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="mono" style={{ color, fontWeight: 600 }}>{value.toFixed(2)}</span>
    </span>
  )
}

/* ── Sources collapsible inside chat bubble ──────────────── */
function BubbleSources({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources?.length) return null
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        cursor: 'pointer', fontSize: 11, color: '#64748b', padding: 0,
      }}>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        Sources ({sources.length})
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sources.map((src, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span className="pill">{src.filename}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{src.score.toFixed(3)}</span>
              </div>
              <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {src.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Example chips ───────────────────────────────────────── */
const EXAMPLES = [
  'Summarize this document',
  'What are the key findings?',
  'Who are the authors?',
]

/* ── Main ────────────────────────────────────────────────── */
export default function Playground() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Latest assistant message for right-panel metrics
  const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const s = latestAssistant?.eval_scores
  const m = latestAssistant?.metrics

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text || loading) return

    // Build history from current messages (text only)
    const history = messages.map(msg => ({ role: msg.role, content: msg.content }))

    // Add user message immediately
    const userMsg = { role: 'user', content: text, id: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    // Auto-resize textarea back to default
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await queryRAG(text, 5, history)
      const d = res.data
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: d.answer,
        sources: d.sources,
        eval_scores: d.eval_scores,
        metrics: d.metrics,
        reformulated_query: d.reformulated_query,
        id: Date.now() + 1,
      }])
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Query failed. Is the backend running?')
      // Remove the optimistic user message on error
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTextareaChange = (e) => {
    setInput(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const clearConversation = () => {
    setMessages([])
    setError(null)
  }

  const turnCount = messages.filter(m => m.role === 'user').length
  const recentUserQueries = messages.filter(m => m.role === 'user').slice(-3)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── LEFT: Chat window ───────────────────────────────── */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        }}>
          <div>
            <h1 className="gradient-text-violet" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 2 }}>
              Query Playground
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conversational RAG with context memory</p>
          </div>
          {messages.length > 0 && (
            <GlowButton variant="ghost" size="sm" onClick={clearConversation}>
              <Trash2 size={13} />
              Clear
            </GlowButton>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, minHeight: 300 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 24px rgba(124,58,237,0.15)',
              }}>
                <MessageSquare size={26} style={{ color: '#a78bfa' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>Ask anything about your documents</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>RagForge remembers context across questions</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => setInput(ex)}
                    style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 20, padding: '7px 14px', fontSize: 12, color: '#94a3b8',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)'; e.currentTarget.style.color = '#a78bfa' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8' }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'fadeSlideIn 0.3s ease both',
              }}
            >
              {/* Reformulation pill — shown above assistant bubble when query was rewritten */}
              {msg.role === 'assistant' && msg.reformulated_query && msg.reformulated_query !== messages[messages.indexOf(msg) - 1]?.content && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, marginLeft: 4,
                  fontSize: 11, color: '#475569',
                }}>
                  <span>🔍</span>
                  <span style={{ fontStyle: 'italic' }}>Searched for: </span>
                  <span className="mono" style={{ color: '#64748b' }}>{msg.reformulated_query}</span>
                </div>
              )}

              {/* Bubble */}
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: 13,
                lineHeight: 1.7,
                ...(msg.role === 'user' ? {
                  background: 'rgba(124,58,237,0.18)',
                  border: '1px solid rgba(124,58,237,0.25)',
                  color: '#e2e8f0',
                } : {
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#cbd5e1',
                }),
              }}>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>

                {/* Sources + score pills for assistant messages */}
                {msg.role === 'assistant' && (
                  <>
                    <BubbleSources sources={msg.sources} />
                    {(msg.eval_scores?.faithfulness >= 0 || msg.eval_scores?.answer_relevancy >= 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        <ScorePill label="F" value={msg.eval_scores?.faithfulness} />
                        <ScorePill label="R" value={msg.eval_scores?.answer_relevancy} />
                        <ScorePill label="C" value={msg.eval_scores?.context_precision} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', animation: 'fadeSlideIn 0.2s ease both' }}>
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '18px 18px 18px 4px', padding: '14px 18px',
                display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#7c3aed',
                    animation: `ping 1.2s ease-in-out ${i * 0.2}s infinite`,
                    display: 'inline-block',
                  }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px', color: '#f87171', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '14px 28px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question…"
              rows={2}
              disabled={loading}
              style={{
                flex: 1, background: 'var(--bg-surface)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '11px 14px',
                color: '#f8fafc', fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                resize: 'none', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                minHeight: 46, maxHeight: 140,
                lineHeight: 1.5,
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(124,58,237,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
            />
            <GlowButton onClick={handleSubmit} loading={loading} disabled={!input.trim()} size="md" style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
              <Send size={14} />
            </GlowButton>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Enter to send · Shift+Enter for newline · RagForge remembers context across questions
          </p>
        </div>
      </div>

      {/* ── RIGHT: Live metrics panel ────────────────────────── */}
      <div style={{ flex: 2, padding: 28, display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>

        {/* Conversation stats */}
        <div className="glass-card" style={{ borderRadius: 16, padding: 18 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Conversation</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa', lineHeight: 1 }}>
              {turnCount}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {turnCount === 1 ? 'turn' : 'turns'} in session
            </span>
          </div>

          {recentUserQueries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="section-label" style={{ marginBottom: 4 }}>Context chain</div>
              {recentUserQueries.map((q, i) => (
                <div key={q.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '7px 10px',
                  border: i === recentUserQueries.length - 1 ? '1px solid rgba(124,58,237,0.2)' : '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span className="mono" style={{ fontSize: 10, color: '#475569', flexShrink: 0, marginTop: 1 }}>Q{turnCount - recentUserQueries.length + i + 1}</span>
                  <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {q.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="gradient-text" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>
            Evaluation Scores
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {latestAssistant ? 'Latest response' : 'Waiting for first response'}
          </p>
        </div>

        {/* Ring scores */}
        <div className="glass-card" style={{ borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <RingScore label="Faithfulness" value={s?.faithfulness} color="#7c3aed" />
            <RingScore label="Answer Relevancy" value={s?.answer_relevancy} color="#06b6d4" />
            <RingScore label="Context Precision" value={s?.context_precision} color="#10b981" />
          </div>
          {s?.error && (
            <div style={{ marginTop: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#fbbf24', textAlign: 'center' }}>
              {s.error}
            </div>
          )}
        </div>

        {/* Hallucination bar */}
        <div className="glass-card" style={{ borderRadius: 16, padding: 18 }}>
          <HalluBar value={s?.hallucination_risk} />
        </div>

        {/* Metrics grid */}
        <div className="glass-card" style={{ borderRadius: 16, padding: 18 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Metrics</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MetricCell label="Retrieval" value={m?.retrieval_latency_ms != null ? `${Math.round(m.retrieval_latency_ms)} ms` : '—'} />
            <MetricCell label="Generation" value={m?.generation_latency_ms != null ? `${Math.round(m.generation_latency_ms)} ms` : '—'} />
            <MetricCell label="Tokens in" value={m?.input_tokens ?? '—'} />
            <MetricCell label="Tokens out" value={m?.output_tokens ?? '—'} />
            <MetricCell label="Cost" value={s?.cost_estimate_usd != null ? `$${s.cost_estimate_usd.toFixed(5)}` : '—'} />
            <MetricCell label="Ctx use" value={s?.context_utilization != null ? s.context_utilization.toFixed(2) : '—'} />
          </div>
        </div>
      </div>
    </div>
  )
}
