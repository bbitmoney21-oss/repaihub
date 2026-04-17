import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(6rem, 20vw, 12rem)', fontWeight: 700, color: 'rgba(201,150,58,0.15)', lineHeight: 1, marginBottom: '0.5rem' }}>404</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '1rem' }}>
          Page Not Found
        </h1>
        <p style={{ color: '#8BA0B4', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.7, maxWidth: 400 }}>
          This page doesn't exist. But your Indian savings still do — and we can help you move them legally to Canada.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ background: '#C9963A', color: '#0B1C2C', padding: '0.85rem 2rem', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s' }}>
            Back to Home
          </Link>
          <Link to="/app/dashboard" style={{ background: 'transparent', border: '1px solid rgba(201,150,58,0.3)', color: '#C9963A', padding: '0.85rem 2rem', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
