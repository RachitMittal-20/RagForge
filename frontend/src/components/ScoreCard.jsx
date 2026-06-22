import { TrendingUp, TrendingDown } from 'lucide-react'

const colorMap = {
  emerald: 'bg-emerald-500/20 text-emerald-400',
  blue: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
  orange: 'bg-orange-500/20 text-orange-400',
}

export default function ScoreCard({ title, value, subtitle, icon: Icon, trend, color = 'emerald' }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
        {trend != null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
        <div className="text-sm font-medium text-gray-300 mt-0.5">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      </div>
    </div>
  )
}
