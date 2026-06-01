import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppProvider, useApp } from './context/AppContext'
import Onboarding from './routes/Onboarding'
import Today from './routes/Today'
import Score from './routes/Score'
import History from './routes/History'

function AppRoutes() {
  const { data } = useApp()
  const onboarded = data.onboarding.completed

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={onboarded ? '/today' : '/onboarding'} replace />}
      />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/today" element={onboarded ? <Today /> : <Navigate to="/onboarding" replace />} />
      <Route path="/score" element={onboarded ? <Score /> : <Navigate to="/onboarding" replace />} />
      <Route path="/history" element={onboarded ? <History /> : <Navigate to="/onboarding" replace />} />
    </Routes>
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
