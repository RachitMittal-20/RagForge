import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Playground from './pages/Playground'
import Documents from './pages/Documents'
import Analytics from './pages/Analytics'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="playground" element={<Playground />} />
        <Route path="documents" element={<Documents />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  )
}
