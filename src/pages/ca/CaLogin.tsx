import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'

const CA_TOKEN_KEY = 'ca_token'

export function getCaToken() { return localStorage.getItem(CA_TOKEN_KEY) }
export function setCaToken(t: string) { localStorage.setItem(CA_TOKEN_KEY, t) }
export function clearCaToken() { localStorage.removeItem(CA_TOKEN_KEY) }

export default function CaLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/ca/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setCaToken(data.token)
      nav('/ca-dashboard')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Repaihub
          </Link>
          <p style={{ fontSize: '0.78rem', color: '#8BA0B4', marginTop: '0.4rem', letterSpacing: '0.1em' }}>CA COMPLIANCE PORTAL</p>
        </div>

        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>CA Sign In</h1>
          <p style={{ fontSize: '0.82rem', color: '#8BA0B4', marginBottom: '2rem' }}>Access the compliance dashboard.</p>

          {error && (
            <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#E74C3C' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.4rem' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="input-field" style={{ display: 'block' }} placeholder="ca@example.com" />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.4rem' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="input-field" style={{ display: 'block' }} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '0.5rem' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
