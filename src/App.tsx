import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.tsx'
import Confirm from './pages/Confirm.tsx'
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

  // Signed out: the email link's confirm page is the only route besides sign-in.
  if (!user) {
    return window.location.pathname === '/auth/confirm' ? <Confirm /> : <Login />
  }

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
