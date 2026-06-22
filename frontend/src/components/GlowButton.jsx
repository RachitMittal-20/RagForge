import { Loader2 } from 'lucide-react'

export default function GlowButton({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  size = 'md',
}) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2.5 text-sm'

  const base = [
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg',
    'transition-all duration-200 cursor-pointer select-none',
    'active:scale-[0.97]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    sizeClass,
    className,
  ].join(' ')

  if (variant === 'primary') {
    return (
      <button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={base}
        style={{
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          color: '#fff',
          border: '1px solid rgba(124,58,237,0.4)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.5), 0 0 48px rgba(124,58,237,0.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : children}
      </button>
    )
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={base}
      style={{
        background: 'transparent',
        color: '#94a3b8',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        e.currentTarget.style.color = '#f8fafc'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#94a3b8'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
      }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  )
}
