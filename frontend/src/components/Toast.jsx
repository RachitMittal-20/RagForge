import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return { toasts, toast: addToast, dismiss }
}

export default function Toast({ toasts, dismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(({ id, message, type }) => (
        <div
          key={id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in slide-in-from-bottom-4 duration-200 max-w-sm ${
            type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/15 border-red-500/40 text-red-300'
          }`}
        >
          {type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
          <span className="flex-1">{message}</span>
          <button onClick={() => dismiss(id)} className="text-current opacity-60 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
