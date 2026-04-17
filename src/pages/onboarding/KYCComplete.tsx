import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Check, ArrowRight } from 'lucide-react'

export default function KYCComplete() {
  const { user } = useStore()
  const nav = useNavigate()

  return (
    <div style={{ background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center' }}>
      <div style={{ position: 'fixed', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(39,174,96,0.08) 0%, rgba(201,150,58,0.06) 50%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
        {/* Checkmark */}
        <div style={{ width: 80, height: 80, margin: '0 auto 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(39,174,96,0.12)', border: '2px solid rgba(39,174,96,0.4)', borderRadius: '50%', animation: 'fadeUp 0.5s ease forwards' }}>
          <Check size={36} color="#27AE60" />
        </div>

        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#27AE60', marginBottom: '1rem', animation: 'fadeUp 0.5s ease forwards 0.1s', opacity: 0 }}>
          KYC Complete
        </div>

        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.5rem, 6vw, 3.5rem)', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.1, marginBottom: '1rem', animation: 'fadeUp 0.6s ease forwards 0.2s', opacity: 0 }}>
          You're all set,<br/><em style={{ fontStyle: 'normal', color: '#E8B86D' }}>{user?.name?.split(' ')[0] || 'Raj'}</em>.
        </h1>

        <p style={{ fontSize: '1rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '3rem', animation: 'fadeUp 0.6s ease forwards 0.35s', opacity: 0 }}>
          Your identity has been verified. Your NRO and Canadian accounts are connected. You can now send money legally in as little as 90 seconds per transfer.
        </p>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2.5rem', animation: 'fadeUp 0.6s ease forwards 0.45s', opacity: 0 }}>
          {[
            { icon: '🏦', title: 'Canada', value: user?.canadaBank?.institution || 'TD Canada Trust', note: 'Verified ✓' },
            { icon: '🇮🇳', title: 'India', value: user?.indiaBank?.bankName || 'HDFC Bank', note: 'Verified ✓' },
            { icon: '📊', title: 'Annual Limit', value: 'CAD $83,000', note: 'Available' },
            { icon: '⚡', title: 'Express', value: '8–12 Hours', note: 'Available' },
          ].map(card => (
            <div key={card.title} style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.25rem', textAlign: 'left' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{card.icon}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4', marginBottom: '0.25rem' }}>{card.title}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FAF6F0', marginBottom: '0.2rem' }}>{card.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#27AE60' }}>{card.note}</div>
            </div>
          ))}
        </div>

        {/* What's next */}
        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left', animation: 'fadeUp 0.6s ease forwards 0.55s', opacity: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1rem' }}>Your First Transfer</div>
          {[
            { icon: '1', text: 'Enter the amount in INR you want to send' },
            { icon: '2', text: 'We show you the live FX rate and all fees upfront' },
            { icon: '3', text: 'Confirm — Form 15CA is filed automatically' },
            { icon: '4', text: 'Our CA certifies Form 15CB (2–4 hours)' },
            { icon: '5', text: 'CAD arrives in your account within 24–48 hours' },
          ].map(item => (
            <div key={item.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(201,150,58,0.15)', border: '1px solid rgba(201,150,58,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#C9963A', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: '0.85rem', color: '#FAF6F0', lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>

        <button onClick={() => nav('/app/dashboard')}
          style={{ width: '100%', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1.1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'background 0.2s', animation: 'fadeUp 0.6s ease forwards 0.65s', opacity: 0 }}>
          Go to Dashboard <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
