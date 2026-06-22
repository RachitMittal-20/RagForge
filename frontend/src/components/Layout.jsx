import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, FileText, BarChart3 } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/playground', label: 'Playground', icon: MessageSquare },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Layout() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-gray-950 flex flex-col border-r border-gray-800">
        <div className="px-6 py-5 border-b border-gray-800">
          <span className="text-xl font-bold text-emerald-400">🔥 RagForge</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-gray-900 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
