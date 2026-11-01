import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.tsx'
import Progress from './pages/Progress.tsx'
import { useSession } from './lib/auth.ts'

export default function App() {
  const { user, loading } = useSession()

  if (loading) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-plate-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Every route requires a session: signed out, everything is the sign-in page.
  if (!user) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Progress />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="*" element={<Navigate to="/progress" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
