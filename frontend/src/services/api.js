import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

export const uploadDocument = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const queryRAG = (query, topK = 5) =>
  api.post('/query', { query, top_k: topK })

export const getMetricsSummary = () => api.get('/metrics/summary')

export const getQueryHistory = (limit = 50) =>
  api.get('/metrics/history', { params: { limit } })

export const getDocuments = () => api.get('/documents')
