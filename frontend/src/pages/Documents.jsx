import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { getDocuments, uploadDocument } from '../services/api'
import Toast, { useToast } from '../components/Toast'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)

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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
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
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your document corpus</p>
      </div>

      {/* Upload zone */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Upload Document</h2>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-600 hover:border-emerald-500/60 rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group"
        >
          <Upload size={28} className="text-gray-500 group-hover:text-emerald-400 transition-colors" />
          {selectedFile ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <FileText size={16} />
              {selectedFile.name}
            </div>
          ) : (
            <>
              <p className="text-gray-400 text-sm">Click to select or drag &amp; drop</p>
              <p className="text-gray-600 text-xs">PDF, DOCX, TXT supported</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </div>

      {/* Documents table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Corpus ({loadingDocs ? '…' : docs.length})</h2>

        {fetchError && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">{fetchError}</div>
        )}

        {loadingDocs ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-700/40 rounded animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                  <th className="text-left pb-3 font-medium">Filename</th>
                  <th className="text-right pb-3 font-medium">Chunks</th>
                  <th className="text-right pb-3 font-medium">Ingested At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {docs.map((doc, i) => (
                  <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 flex items-center gap-2 text-gray-200">
                      <FileText size={14} className="text-gray-500 shrink-0" />
                      {doc.filename}
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                        {doc.total_chunks}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-500">{formatDate(doc.ingested_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
