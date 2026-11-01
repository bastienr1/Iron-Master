import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell.tsx'
import Login from './pages/Login.tsx'
import Confirm from './pages/Confirm.tsx'
import Today from './pages/Today.tsx'
import Log from './pages/Log.tsx'
import Train from './pages/Train.tsx'
import Progress from './pages/Progress.tsx'
import Meals from './pages/Meals.tsx'
import Recap from './pages/Recap.tsx'
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
      <AppShell>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/log" element={<Log />} />
          <Route path="/train" element={<Train />} />
          <Route path="/train/progress" element={<Progress />} />
          <Route path="/progress" element={<Navigate to="/train/progress" replace />} />
          <Route path="/meals" element={<Meals />} />
          <Route path="/recap" element={<Recap />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
