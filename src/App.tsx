import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { getToken } from './lib/api'
import AppLayout from './components/layout/AppLayout'

// Public pages
import Landing    from './pages/Landing'
import Guide      from './pages/Guide'
import Privacy    from './pages/Privacy'
import Terms      from './pages/Terms'
import NotFound   from './pages/NotFound'
import Login          from './pages/auth/Login'
import Signup         from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword  from './pages/auth/ResetPassword'
import CaLogin       from './pages/ca/CaLogin'
import CaDashboard   from './pages/ca/CaDashboard'

// Onboarding
import ResidencySelect  from './pages/onboarding/ResidencySelect'
import CanadaBank       from './pages/onboarding/CanadaBank'
import IndiaNRO         from './pages/onboarding/IndiaNRO'
import KYCComplete      from './pages/onboarding/KYCComplete'

// App pages
import Dashboard      from './pages/app/Dashboard'
import Transfers      from './pages/app/Transfers'
import TransferDetail from './pages/app/TransferDetail'
import NewTransfer    from './pages/app/NewTransfer'
import Compliance     from './pages/app/Compliance'
import AppSettings    from './pages/app/AppSettings'
import Fees           from './pages/app/Fees'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AuthSync() {
  const { isAuthenticated, logout } = useStore()
  useEffect(() => {
    if (isAuthenticated && !getToken()) logout()
  }, [isAuthenticated])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthSync />
      <Routes>
        {/* Public */}
        <Route path="/"        element={<Landing />} />
        <Route path="/guide"   element={<Guide />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms"   element={<Terms />} />
        <Route path="/login"            element={<Login />} />
        <Route path="/signup"           element={<Signup />} />
        <Route path="/forgot-password"  element={<ForgotPassword />} />
        <Route path="/reset-password"   element={<ResetPassword />} />
        <Route path="/ca-login"         element={<CaLogin />} />
        <Route path="/ca-dashboard"     element={<CaDashboard />} />

        {/* Onboarding */}
        <Route path="/onboarding/residency"   element={<RequireAuth><ResidencySelect /></RequireAuth>} />
        <Route path="/onboarding/canada-bank" element={<RequireAuth><CanadaBank /></RequireAuth>} />
        <Route path="/onboarding/india-nro"   element={<RequireAuth><IndiaNRO /></RequireAuth>} />
        <Route path="/onboarding/complete"    element={<RequireAuth><KYCComplete /></RequireAuth>} />

        {/* App — auth only; residency/bank collected at first transfer (Remitly-style) */}
        <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="transfer"     element={<Transfers />} />
          <Route path="transfer/:id" element={<TransferDetail />} />
          <Route path="new-transfer" element={<NewTransfer />} />
          <Route path="compliance"   element={<Compliance />} />
          <Route path="settings"     element={<AppSettings />} />
          <Route path="fees"         element={<Fees />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
