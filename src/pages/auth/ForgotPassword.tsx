import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiResetPassword } from '../../lib/api'

export default function ForgotPassword() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiResetPassword(email)
      setSent(true)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Could not send reset email. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const S = {
    page: { background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '2rem' },
  }

  return (
    <div style={S.page}>
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.08) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Repaihub
          </Link>
          <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.5rem', letterSpacing: '0.1em' }}>NRO Outward Remittance — Canada</p>
        </div>

        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 1.5rem', background: 'rgba(39,174,96,0.12)', border: '2px solid rgba(39,174,96,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                ✉
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.75rem' }}>Check your inbox</h1>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '2rem' }}>
                We sent a password reset link to <strong style={{ color: '#FAF6F0' }}>{email}</strong>.
                Check your spam folder if it doesn't arrive within a minute.
              </p>
              <Link to="/login" style={{ display: 'block', background: '#C9963A', color: '#0B1C2C', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center' }}>
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Reset password</h1>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>Enter your email and we'll send you a reset link.</p>

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

                <button type="submit" disabled={loading}
                  style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '0.5rem' }}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p style={{ fontSize: '0.82rem', color: '#8BA0B4', textAlign: 'center', marginTop: '1.5rem' }}>
                Remember it?{' '}
                <Link to="/login" style={{ color: '#E8B86D', textDecoration: 'none', fontWeight: 500 }}>Sign in →</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
