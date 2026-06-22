import { useEffect, useState } from 'react'

function resolveStyle(score) {
  if (score == null || score < 0) return {
    bg: 'rgba(71,85,105,0.15)', color: '#64748b',
    border: 'rgba(71,85,105,0.25)', glow: 'none',
  }
  if (score >= 0.7) return {
    bg: 'rgba(16,185,129,0.12)', color: '#10b981',
    border: 'rgba(16,185,129,0.3)', glow: '0 0 10px rgba(16,185,129,0.25)',
  }
  if (score >= 0.4) return {
    bg: 'rgba(245,158,11,0.12)', color: '#f59e0b',
    border: 'rgba(245,158,11,0.3)', glow: '0 0 10px rgba(245,158,11,0.25)',
  }
  return {
    bg: 'rgba(239,68,68,0.12)', color: '#ef4444',
    border: 'rgba(239,68,68,0.3)', glow: '0 0 10px rgba(239,68,68,0.25)',
  }
}

export default function AnimatedBadge({ score, delay = 0 }) {
  const [popped, setPopped] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setPopped(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const s = resolveStyle(score)
  const label = score == null || score < 0 ? 'N/A' : score.toFixed(2)

  return (
    <span
      style={{
        display: 'inline-block',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        boxShadow: popped ? s.glow : 'none',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: '6px',
        animation: popped ? 'scalePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
      }}
    >
      {label}
    </span>
  )
}
