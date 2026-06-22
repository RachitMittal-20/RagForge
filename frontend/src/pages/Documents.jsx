import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import GlowButton from '../components/GlowButton'
import Toast, { useToast } from '../components/Toast'
import { getDocuments, uploadDocument } from '../services/api'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Skeleton({ h = 10, radius = 8 }) {
  return <div className="shimmer" style={{ height: h, borderRadius: radius }} />
}

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef(null)
  const { toasts, toast, dismiss } = useToast()

  const fetchDocs = () => {
    setLoadingDocs(true)
    setFetchError(null)
    getDocuments()
      .then((res) => setDocs(res.data))
      .catch(() => setFetchError('Failed to load documents. Is the backend running?'))
      .finally(() => setLoadingDocs(false))
  }

  useEffect(() => { fetchDocs() }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || uploading) return
    setUploading(true)
    try {
      const res = await uploadDocument(selectedFile)
      toast(`"${res.data.filename}" ingested — ${res.data.total_chunks} chunks`, 'success')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchDocs()
    } catch (err) {
      toast(err.response?.data?.detail ?? 'Upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div>
        <h1 className="gradient-text" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>
          Documents
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage your document corpus</p>
      </div>

      {/* Upload zone */}
      <div className="glass-card" style={{ borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="section-bar">
          <span className="section-label">Upload Document</span>
        </div>

        {/* Drop zone — gradient border via layered pseudo-element trick using outline */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          style={{
            position: 'relative',
            borderRadius: 14,
            padding: '36px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            background: dragOver ? 'rgba(124,58,237,0.06)' : selectedFile ? 'rgba(16,185,129,0.04)' : 'transparent',
            border: `2px dashed ${dragOver ? 'rgba(124,58,237,0.6)' : selectedFile ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: dragOver ? '0 0 24px rgba(124,58,237,0.15), inset 0 0 24px rgba(124,58,237,0.05)' : 'none',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: selectedFile ? 'rgba(16,185,129,0.12)' : 'rgba(124,58,237,0.1)',
            boxShadow: selectedFile ? '0 0 16px rgba(16,185,129,0.3)' : '0 0 16px rgba(124,58,237,0.2)',
            animation: dragOver ? 'bounceSub 0.6s ease' : 'none',
            transition: 'all 0.25s ease',
          }}>
            {selectedFile
              ? <CheckCircle2 size={22} style={{ color: '#10b981' }} />
              : <Upload size={22} style={{ color: '#a78bfa' }} />
            }
          </div>

          {selectedFile ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 13, fontWeight: 500, justifyContent: 'center' }}>
                <FileText size={14} />
                <span className="mono">{selectedFile.name}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Click to change file</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                {dragOver ? 'Drop to upload' : 'Click to select or drag & drop'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>PDF · DOCX · TXT supported</p>
            </>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f) }} />
        </div>

        <GlowButton
          onClick={handleUpload}
          loading={uploading}
          disabled={!selectedFile}
          size="md"
        >
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload Document'}
        </GlowButton>
      </div>

      {/* Documents table */}
      <div className="glass-card" style={{ borderRadius: 16, padding: 24 }}>
        <div className="section-bar" style={{ marginBottom: 16 }}>
          <span className="section-label">Corpus ({loadingDocs ? '…' : docs.length})</span>
        </div>

        {fetchError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} />
            {fetchError}
          </div>
        )}

        {loadingDocs ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={36} />)}
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(71,85,105,0.15)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <FileText size={20} style={{ color: '#475569' }} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No documents uploaded yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th className="section-label" style={{ textAlign: 'left', padding: '0 0 10px' }}>Filename</th>
                <th className="section-label" style={{ textAlign: 'right', padding: '0 0 10px' }}>Chunks</th>
                <th className="section-label" style={{ textAlign: 'right', padding: '0 0 10px' }}>Ingested At</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 0', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <FileText size={13} style={{ color: '#a78bfa' }} />
                    </span>
                    <span className="mono" style={{ fontSize: 12 }}>{doc.filename}</span>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    <span style={{
                      background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                      color: '#06b6d4', fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
                    }}>
                      {doc.total_chunks}
                    </span>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                    {formatDate(doc.ingested_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
