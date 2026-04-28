import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { apiUpdatePassword } from '../../lib/api'
import { Eye, EyeOff, Check } from 'lucide-react'

export default function ResetPassword() {
  const nav = useNavigate()
  const [ready, setReady]     = useState(false)  // true once Supabase recovery session is active
  const [pw, setPw]           = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (pw !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await apiUpdatePassword(pw)
      setDone(true)
      setTimeout(() => nav('/login'), 3000)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to update password. Try again.')
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
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 1.5rem', background: 'rgba(39,174,96,0.12)', border: '2px solid rgba(39,174,96,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={24} color="#27AE60" />
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.75rem' }}>Password updated</h1>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '1.5rem' }}>Redirecting you to sign in…</p>
              <Link to="/login" style={{ display: 'block', background: '#C9963A', color: '#0B1C2C', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center' }}>
                Sign In Now
              </Link>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ width: 28, height: 28, border: '2px solid rgba(201,150,58,0.3)', borderTopColor: '#C9963A', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4' }}>Verifying reset link…</p>
              <p style={{ fontSize: '0.78rem', color: '#8BA0B4', marginTop: '1.5rem' }}>
                Link expired or already used?{' '}
                <Link to="/forgot-password" style={{ color: '#E8B86D', textDecoration: 'none' }}>Request a new one →</Link>
              </p>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>New password</h1>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>Choose a strong password for your account.</p>

              {error && (
                <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#E74C3C' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
                      placeholder="8+ characters" required className="input-field" style={{ display: 'block', paddingRight: '3rem' }} />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8BA0B4', cursor: 'pointer' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {pw.length >= 8 && <p style={{ fontSize: '0.75rem', color: '#27AE60', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Check size={12} /> Strong password</p>}
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" required className="input-field" style={{ display: 'block' }} />
                  {confirm.length > 0 && pw === confirm && (
                    <p style={{ fontSize: '0.75rem', color: '#27AE60', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Check size={12} /> Passwords match</p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '0.5rem' }}>
                  {loading ? 'Updating...' : 'Set New Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
