import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

const CFG = {
  violet:  { iconBg: 'rgba(124,58,237,0.15)',  iconColor: '#a78bfa', glow: 'rgba(124,58,237,0.5)',  line: 'linear-gradient(90deg,#7c3aed,#8b5cf6)', hover: 'rgba(124,58,237,0.15)' },
  cyan:    { iconBg: 'rgba(6,182,212,0.15)',   iconColor: '#06b6d4', glow: 'rgba(6,182,212,0.5)',   line: 'linear-gradient(90deg,#0891b2,#06b6d4)', hover: 'rgba(6,182,212,0.15)' },
  emerald: { iconBg: 'rgba(16,185,129,0.15)',  iconColor: '#10b981', glow: 'rgba(16,185,129,0.5)',  line: 'linear-gradient(90deg,#059669,#10b981)', hover: 'rgba(16,185,129,0.15)' },
  orange:  { iconBg: 'rgba(245,158,11,0.15)',  iconColor: '#f59e0b', glow: 'rgba(245,158,11,0.5)',  line: 'linear-gradient(90deg,#d97706,#f59e0b)', hover: 'rgba(245,158,11,0.15)' },
  // legacy aliases kept for callers that still pass these
  blue:    { iconBg: 'rgba(6,182,212,0.15)',   iconColor: '#06b6d4', glow: 'rgba(6,182,212,0.5)',   line: 'linear-gradient(90deg,#0891b2,#06b6d4)', hover: 'rgba(6,182,212,0.15)' },
  purple:  { iconBg: 'rgba(124,58,237,0.15)',  iconColor: '#a78bfa', glow: 'rgba(124,58,237,0.5)',  line: 'linear-gradient(90deg,#7c3aed,#8b5cf6)', hover: 'rgba(124,58,237,0.15)' },
}

function parseValue(val) {
  if (val == null || val === '—') return null
  const s = String(val)
  const m = s.match(/(-?[\d.]+)/)
  if (!m) return null
  return {
    number: parseFloat(m[1]),
    prefix: s.slice(0, m.index),
    suffix: s.slice(m.index + m[1].length),
    decimals: (m[1].split('.')[1] || '').length,
  }
}

export default function ScoreCard({ title, value, subtitle, icon: Icon, trend, color = 'violet', delay = 0 }) {
  const cfg = CFG[color] || CFG.violet
  const [display, setDisplay] = useState('0')
  const [mounted, setMounted] = useState(false)
  const [hovered, setHovered] = useState(false)
  const rafRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  useEffect(() => {
    if (!mounted) return
    const parsed = parseValue(value)
    if (!parsed) { setDisplay(String(value ?? '—')); return }

    let startTime = null
    const animate = (ts) => {
      if (!startTime) startTime = ts
      const t = Math.min((ts - startTime) / 800, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(parsed.prefix + (eased * parsed.number).toFixed(parsed.decimals) + parsed.suffix)
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, mounted])

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: 24,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
        backdropFilter: 'blur(12px)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0) scale(1)' : 'translateY(12px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease, border-color 0.2s ease, box-shadow 0.3s ease',
        boxShadow: hovered ? `0 8px 32px rgba(0,0,0,0.3), inset 0 0 0 1px ${cfg.hover}` : '0 4px 16px rgba(0,0,0,0.2)',
      }}
    >
      {/* Colored top line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: cfg.line }} />

      {/* Subtle hover glow overlay */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
        background: hovered ? `radial-gradient(circle at 50% 0%, ${cfg.hover} 0%, transparent 70%)` : 'none',
        transition: 'background 0.3s ease',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, position: 'relative' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cfg.iconBg,
          boxShadow: `0 0 16px ${cfg.glow}`,
        }}>
          <Icon size={18} style={{ color: cfg.iconColor }} />
        </div>
        {trend != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, color: '#f8fafc', lineHeight: 1, marginBottom: 6 }}>
        {display}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{subtitle}</div>}
    </div>
  )
}
