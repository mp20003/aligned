import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router'
import { AppProvider, useApp } from './context/AppContext'
import Onboarding from './routes/Onboarding'
import Today from './routes/Today'
import Score from './routes/Score'
import History from './routes/History'
import Settings from './routes/Settings'
import Login from './routes/Login'
import NavBar from './components/NavBar'

function AnimatedRoutes({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.remove('page-enter')
    void el.offsetWidth
    el.classList.add('page-enter')
  }, [location.pathname])

  return <div ref={ref} className="page-enter">{children}</div>
}

function AppRoutes() {
  const { data, session, authLoading } = useApp()
  const onboarded = data.onboarding.completed

  if (authLoading) {
    return <div className="min-h-screen" style={{ background: '#0f0f1a' }} />
  }

  if (!session) {
    return <Login />
  }

  return (
    <>
      <AnimatedRoutes>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={onboarded ? '/today' : '/onboarding'} replace />}
          />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/today" element={onboarded ? <Today /> : <Navigate to="/onboarding" replace />} />
          <Route path="/score" element={onboarded ? <Score /> : <Navigate to="/onboarding" replace />} />
          <Route path="/history" element={onboarded ? <History /> : <Navigate to="/onboarding" replace />} />
          <Route path="/settings" element={onboarded ? <Settings /> : <Navigate to="/onboarding" replace />} />
        </Routes>
      </AnimatedRoutes>
      <NavBar />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
