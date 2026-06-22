import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, FileText, BarChart3, Sparkles } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/playground', label: 'Playground', icon: MessageSquare },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

const TITLES = {
  '/': 'Dashboard',
  '/playground': 'Query Playground',
  '/documents': 'Documents',
  '/analytics': 'Analytics',
}

export default function Layout() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'RagForge'

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#0a0a0f',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              🔥 RagForge
            </span>
            {/* Pulsing violet dot */}
            <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%', background: '#7c3aed', opacity: 0.75,
                animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
              }} />
              <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', display: 'inline-flex' }} />
            </span>
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>v1.0.0</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  color: isActive ? '#a78bfa' : '#64748b',
                  background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent',
                }}>
                  <Icon size={15} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <Sparkles size={11} style={{ color: '#7c3aed' }} />
            <span>Built with RAGAs</span>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', height: 52, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#10b981' }}>
            <span style={{ position: 'relative', display: 'flex', width: 7, height: 7 }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%', background: '#34d399', opacity: 0.7,
                animation: 'ping 2s ease-in-out infinite',
              }} />
              <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-flex' }} />
            </span>
            System Online
          </div>
        </header>

        {/* Content with dot grid + page transition */}
        <main className="dot-grid" style={{ flex: 1, overflowY: 'auto' }}>
          <div key={pathname} style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
