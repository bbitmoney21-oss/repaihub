import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import type { ResidencyStatus } from '../../store/useStore'
import { apiUpdateProfile } from '../../lib/api'
import { Check } from 'lucide-react'

const OPTIONS: { id: ResidencyStatus; title: string; desc: string; note: string }[] = [
  { id: 'citizen',     title: 'Canadian Citizen',      desc: 'You hold a Canadian passport',             note: 'Standard annual limit applies. No restrictions on transfer frequency.' },
  { id: 'pr',          title: 'Permanent Resident',    desc: 'You hold a PR card',                       note: 'Standard annual limit applies. Same rights as citizens for NRO repatriation.' },
  { id: 'oci',         title: 'OCI Card Holder',       desc: 'Overseas Citizen of India card',           note: 'Full USD 1M annual limit. OCI status does not affect repatriation rights.' },
  { id: 'work_permit', title: 'Work Permit Holder',    desc: 'Currently on a Canadian work permit',      note: 'Eligible for NRO repatriation. Ensure NRO account reflects non-resident status.' },
]

export default function ResidencySelect() {
  const { setResidency } = useStore()
  const nav = useNavigate()
  const [selected, setSelected] = useState<ResidencyStatus>('')
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await apiUpdateProfile({ residency: selected })
    } catch { /* non-fatal: store locally regardless */ }
    setResidency(selected)
    nav('/onboarding/canada-bank')
  }

  return (
    <div style={{ background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem' }}>
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.06) 0%, transparent 70%)', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 540, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Repaihub</span>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {['Account', 'Residency', 'Canada KYC', 'India KYC'].map((step, i) => (
            <div key={step} style={{ flex: 1 }}>
              <div style={{ height: 3, background: i <= 1 ? '#C9963A' : 'rgba(201,150,58,0.2)', borderRadius: 2, marginBottom: '0.3rem' }} />
              <span style={{ fontSize: '0.6rem', color: i <= 1 ? '#C9963A' : '#8BA0B4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{step}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Your Residency Status</h1>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem', lineHeight: 1.6 }}>
            This determines your transfer limits and the compliance documents required. Select the option that best describes your current status in Canada.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {OPTIONS.map(opt => (
              <div key={opt.id}
                onClick={() => setSelected(opt.id)}
                style={{
                  border: `1px solid ${selected === opt.id ? '#C9963A' : 'rgba(201,150,58,0.2)'}`,
                  background: selected === opt.id ? 'rgba(201,150,58,0.08)' : '#0B1C2C',
                  padding: '1.25rem 1.5rem', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'flex-start', gap: '1rem',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  border: `1px solid ${selected === opt.id ? '#C9963A' : 'rgba(201,150,58,0.3)'}`,
                  background: selected === opt.id ? '#C9963A' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                }}>
                  {selected === opt.id && <Check size={11} color="#0B1C2C" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: selected === opt.id ? '#FAF6F0' : '#FAF6F0', marginBottom: '0.2rem' }}>{opt.title}</div>
                  <div style={{ fontSize: '0.82rem', color: '#8BA0B4', marginBottom: '0.5rem' }}>{opt.desc}</div>
                  {selected === opt.id && (
                    <div style={{ fontSize: '0.78rem', color: '#C9963A', background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.2)', padding: '0.5rem 0.75rem', borderRadius: 2, marginTop: '0.5rem' }}>
                      ℹ️ {opt.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleContinue} disabled={!selected || loading}
            style={{ width: '100%', background: selected ? '#C9963A' : 'rgba(201,150,58,0.3)', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: selected && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {loading ? 'Saving...' : 'Continue to Bank Verification →'}
          </button>
        </div>
      </div>
    </div>
  )
}
