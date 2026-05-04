import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useStore } from './store/useStore'
import { getToken } from './lib/api'
import AppLayout from './components/layout/AppLayout'

// Public pages — kept eager so the marketing landing renders without a flash.
import Landing    from './pages/Landing'
import Login      from './pages/auth/Login'
import Signup     from './pages/auth/Signup'
import NotFound   from './pages/NotFound'

// Everything else is code-split.  Pulls 600-800 KB out of the initial
// bundle so first paint on / and /login is much faster.
const Guide          = lazy(() => import('./pages/Guide'))
const Privacy        = lazy(() => import('./pages/Privacy'))
const Terms          = lazy(() => import('./pages/Terms'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword  = lazy(() => import('./pages/auth/ResetPassword'))
const CaLogin        = lazy(() => import('./pages/ca/CaLogin'))
const CaDashboard    = lazy(() => import('./pages/ca/CaDashboard'))

const ResidencySelect = lazy(() => import('./pages/onboarding/ResidencySelect'))
const CanadaBank      = lazy(() => import('./pages/onboarding/CanadaBank'))
const IndiaNRO        = lazy(() => import('./pages/onboarding/IndiaNRO'))
const KYCComplete     = lazy(() => import('./pages/onboarding/KYCComplete'))

const Dashboard      = lazy(() => import('./pages/app/Dashboard'))
const Transfers      = lazy(() => import('./pages/app/Transfers'))
const TransferDetail = lazy(() => import('./pages/app/TransferDetail'))
const NewTransfer    = lazy(() => import('./pages/app/NewTransfer'))
const Compliance     = lazy(() => import('./pages/app/Compliance'))
const AppSettings    = lazy(() => import('./pages/app/AppSettings'))
const Fees           = lazy(() => import('./pages/app/Fees'))

// Minimal lazy fallback — matches the app's dark theme so the route
// transition feels intentional, not a white flash.
function PageLoader() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#8BA0B4',
      fontSize: '0.85rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>
      <span>Loading…</span>
    </div>
  )
}

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
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </BrowserRouter>
  )
}
