import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { apiRegister } from '../../lib/api'
import { Eye, EyeOff, Check } from 'lucide-react'

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem',
}

export default function Signup() {
  const { setAuth } = useStore()
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', pw: '', agree: false })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.includes('@')) e.email = 'Valid email required'
    if (form.pw.length < 8) e.pw = 'Password must be 8+ characters'
    if (!form.agree) e.agree = 'You must agree to proceed'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const user = await apiRegister(form.email, form.pw, form.name, form.phone)
      setAuth({ id: user.id, email: user.email, name: user.name, phone: user.phone ?? form.phone })
      nav('/app/dashboard')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? ''
      const lower = msg.toLowerCase()
      let displayMsg: string
      let errorField: 'email' | 'pw' | 'general' = 'email'

      if (lower.includes('already registered') || lower.includes('already exists')) {
        displayMsg = 'An account with this email already exists. Please sign in instead.'
      } else if (lower.includes('password')) {
        // Password policy / weakness errors should surface on the password field
        displayMsg = msg
        errorField = 'pw'
      } else if (lower.includes('rate') || lower.includes('too many')) {
        displayMsg = msg
        errorField = 'general'
      } else if (
        msg === 'Failed to fetch' ||
        lower.includes('networkerror') ||
        lower.includes('not configured') ||
        lower.includes('failed to fetch') ||
        lower.includes('unavailable')
      ) {
        displayMsg = 'Cannot connect to server. Please check your connection and try again.'
        errorField = 'general'
      } else {
        // Surface the actual server-provided reason — no more generic "exists" lie
        displayMsg = msg || 'Registration failed. Please try again.'
        errorField = 'general'
      }

      setErrors(ex => ({ ...ex, [errorField]: displayMsg }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.08) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none' }}>Repaihub</Link>
          <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.5rem' }}>Create your account — takes 60 seconds</p>
        </div>

        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Create Account</h1>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>Name, email and password — that's it. Bank details added when you send your first transfer.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Full Name */}
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Raj Sharma"
                className="input-field"
                style={{ display: 'block' }}
              />
              {errors.name && <p style={{ fontSize: '0.75rem', color: '#E74C3C', marginTop: '0.35rem' }}>{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="raj@example.com"
                className="input-field"
                style={{ display: 'block' }}
              />
              {errors.email && <p style={{ fontSize: '0.75rem', color: '#E74C3C', marginTop: '0.35rem' }}>{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Canadian Phone (Optional)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1-647-555-0100"
                className="input-field"
                style={{ display: 'block' }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.pw}
                  onChange={e => setForm(f => ({ ...f, pw: e.target.value }))}
                  placeholder="8+ characters"
                  required
                  className="input-field"
                  style={{ display: 'block', paddingRight: '3rem' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8BA0B4', cursor: 'pointer' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.pw && <p style={{ fontSize: '0.75rem', color: '#E74C3C', marginTop: '0.35rem' }}>{errors.pw}</p>}
              {form.pw.length >= 8 && <p style={{ fontSize: '0.75rem', color: '#27AE60', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Check size={12} /> Strong password</p>}
            </div>

            {/* Agree */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
              <div onClick={() => setForm(f => ({ ...f, agree: !f.agree }))}
                style={{ width: 18, height: 18, border: `1px solid ${form.agree ? '#C9963A' : 'rgba(201,150,58,0.3)'}`, background: form.agree ? 'rgba(201,150,58,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, cursor: 'pointer', transition: 'all 0.2s' }}>
                {form.agree && <Check size={11} color="#C9963A" />}
              </div>
              <span style={{ fontSize: '0.82rem', color: '#8BA0B4', lineHeight: 1.5 }}>
                I agree to the <a href="#" style={{ color: '#E8B86D' }}>Terms of Service</a> and <a href="#" style={{ color: '#E8B86D' }}>Privacy Policy</a>. I understand REPAIHUB is a FINTRAC registered MSB.
              </span>
            </label>
            {errors.agree && <p style={{ fontSize: '0.75rem', color: '#E74C3C', marginTop: '-0.75rem' }}>{errors.agree}</p>}

            {errors.general && (
              <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#E74C3C', lineHeight: 1.5 }}>
                {errors.general}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '0.5rem', transition: 'background 0.2s' }}>
              {loading ? 'Creating Account...' : 'Create Account & Start Sending →'}
            </button>
          </form>

          <p style={{ fontSize: '0.82rem', color: '#8BA0B4', textAlign: 'center', marginTop: '1.5rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#E8B86D', textDecoration: 'none', fontWeight: 500 }}>Sign in →</Link>
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {['FINTRAC MSB', 'Zero Doc Storage', 'PIPEDA Protected'].map(b => (
            <span key={b} style={{ fontSize: '0.65rem', color: '#8BA0B4', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#C9963A' }} /> {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
