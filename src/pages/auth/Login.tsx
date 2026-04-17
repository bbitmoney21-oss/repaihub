import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useStore()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw]       = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    if (email && pw.length >= 6) {
      login(email, email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      nav('/app/dashboard')
    } else {
      setError('Invalid email or password. Try any email + 6+ character password.')
    }
    setLoading(false)
  }

  const demoLogin = () => {
    login('raj@example.com', 'Raj Sharma')
    nav('/app/dashboard')
  }

  const S = { page: { background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '2rem' } }

  return (
    <div style={S.page}>
      {/* Glow */}
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.08) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Repaihub
          </Link>
          <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.5rem', letterSpacing: '0.1em' }}>NRO Outward Remittance — Canada</p>
        </div>

        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Welcome back</h1>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>Sign in to your REPAIHUB account</p>

          {error && (
            <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#E74C3C' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
                className="input-field" style={{ display: 'block' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" required
                  className="input-field" style={{ display: 'block', paddingRight: '3rem' }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8BA0B4', cursor: 'pointer' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontFamily: "'DM Sans'", fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '0.5rem', transition: 'background 0.2s' }}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(201,150,58,0.2)' }} />
            <span style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(201,150,58,0.2)' }} />
          </div>

          <button onClick={demoLogin}
            style={{ width: '100%', background: 'transparent', border: '1px solid rgba(201,150,58,0.3)', color: '#C9963A', padding: '0.85rem', fontFamily: "'DM Sans'", fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,150,58,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            🎭 Try Demo Account
          </button>

          <p style={{ fontSize: '0.82rem', color: '#8BA0B4', textAlign: 'center', marginTop: '1.5rem' }}>
            No account?{' '}
            <Link to="/signup" style={{ color: '#E8B86D', textDecoration: 'none', fontWeight: 500 }}>Create one →</Link>
          </p>
        </div>

        <p style={{ fontSize: '0.7rem', color: '#8BA0B4', textAlign: 'center', marginTop: '1.5rem', lineHeight: 1.6 }}>
          REPAIHUB is a FINTRAC registered MSB. Your data is protected under PIPEDA.
        </p>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link to="/" style={{ fontSize: '0.75rem', color: '#8BA0B4', textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
