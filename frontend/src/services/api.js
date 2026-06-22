import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

export const uploadDocument = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/api/ingest', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const queryRAG = (query, topK = 5, conversationHistory = []) =>
  api.post('/api/query', {
    query,
    top_k: topK,
    conversation_history: conversationHistory,
  })

export const getMetricsSummary = () => api.get('/api/metrics/summary')

export const getQueryHistory = (limit = 50) =>
  api.get('/api/metrics/history', { params: { limit } })

export const getDocuments = () => api.get('/api/documents')
