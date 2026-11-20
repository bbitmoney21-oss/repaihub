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
          You're all set,<br/><em style={{ fontStyle: 'normal', color: '#E8B86D' }}>{user?.name?.split(' ')[0] || 'there'}</em>.
        </h1>

        <p style={{ fontSize: '1rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '3rem', animation: 'fadeUp 0.6s ease forwards 0.35s', opacity: 0 }}>
          Your account is set up. In this beta preview no real identity or bank check runs yet — verification through DigiLocker, IDfy, Persona and bank verification switches on at launch. REPAIHUB never stores your documents.
        </p>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2.5rem', animation: 'fadeUp 0.6s ease forwards 0.45s', opacity: 0 }}>
          {[
            { icon: '🏦', title: 'Canada', value: user?.canadaBank?.institution || 'Not connected yet', note: user?.canadaBank ? 'Connected (beta preview)' : 'Connect at launch' },
            { icon: '🇮🇳', title: 'India', value: user?.indiaBank?.bankName || 'Not connected yet', note: user?.indiaBank ? 'Connected (beta preview)' : 'Connect at launch' },
            { icon: '📊', title: 'Annual Limit', value: 'USD 1 million', note: 'Per financial year (FEMA)' },
            { icon: '⚡', title: 'Express', value: 'Up to 3 business days', note: 'At launch' },
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
            { icon: '2', text: 'We show you the exchange rate and every fee before you confirm' },
            { icon: '3', text: 'Confirm — Form 145 is filed automatically (IT Act 2025)' },
            { icon: '4', text: 'Our partner CA certifies Form 146' },
            { icon: '5', text: 'CAD arrives in your account within 5 business days (3 with Express)' },
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
