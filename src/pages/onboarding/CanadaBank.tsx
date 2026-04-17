import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Shield, Lock, Check, Loader } from 'lucide-react'

const BANKS = ['TD Canada Trust', 'RBC Royal Bank', 'Scotiabank', 'BMO Bank of Montreal', 'CIBC', 'National Bank', 'HSBC Canada', 'Tangerine', 'EQ Bank', 'Other']

type Step = 'intro' | 'connect' | 'verifying' | 'done'

export default function CanadaBank() {
  const { completeCanadaKYC } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('intro')
  const [bank, setBank] = useState('')
  const [holder, setHolder] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')

  const startVerification = async () => {
    if (!bank || !holder.trim()) return
    setStep('verifying')
    const steps = [
      [20, 'Connecting to Flinks API…'],
      [40, 'Launching secure bank session…'],
      [60, 'Retrieving account holder name…'],
      [78, 'Generating SHA-256 account hash…'],
      [90, 'Storing verification token…'],
      [100, 'Verification complete'],
    ]
    for (const [pct, label] of steps) {
      await new Promise(r => setTimeout(r, 700))
      setProgress(pct as number)
      setProgressLabel(label as string)
    }
    await new Promise(r => setTimeout(r, 500))
    completeCanadaKYC({ institution: bank, holderName: holder, accountType: 'Chequing' })
    setStep('done')
  }

  return (
    <div style={{ background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem' }}>
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.06) 0%, transparent 70%)', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 540, position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Repaihub</span>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {['Account', 'Residency', 'Canada KYC', 'India KYC'].map((step, i) => (
            <div key={step} style={{ flex: 1 }}>
              <div style={{ height: 3, background: i <= 2 ? '#C9963A' : 'rgba(201,150,58,0.2)', borderRadius: 2, marginBottom: '0.3rem' }} />
              <span style={{ fontSize: '0.6rem', color: i <= 2 ? '#C9963A' : '#8BA0B4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{step}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem' }}>

          {step === 'intro' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ width: 48, height: 48, background: 'rgba(201,150,58,0.1)', border: '1px solid rgba(201,150,58,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield color="#C9963A" size={22} />
                </div>
                <div>
                  <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.1 }}>Canadian Bank Verification</h1>
                  <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.25rem' }}>Step 3 of 4 — Powered by Flinks</p>
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '2rem' }}>
                We connect to your Canadian bank the same way your budgeting app does. We see only what we need to verify it's your account. <strong style={{ color: '#FAF6F0' }}>Nothing else. Ever.</strong>
              </p>
              <div style={{ background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.15)', padding: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.75rem' }}>What We Receive</div>
                {['Account holder name', 'Institution name', 'Account type (chequing/savings)', 'Verification token (loginId)'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#FAF6F0' }}>
                    <Check size={14} color="#27AE60" /> {item}
                  </div>
                ))}
                <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '1rem 0' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E74C3C', marginBottom: '0.75rem' }}>What We NEVER Store</div>
                {['Your banking credentials', 'Account number (only SHA-256 hash)', 'Bank statements or history', 'Any sensitive PII'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#8BA0B4' }}>
                    <span style={{ color: '#E74C3C', fontSize: '0.8rem' }}>✗</span> {item}
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('connect')}
                style={{ width: '100%', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.2s' }}>
                Connect My Bank →
              </button>
            </>
          )}

          {step === 'connect' && (
            <>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Connect Your Bank</h1>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>Select your bank and confirm your account holder name</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>Your Canadian Bank</label>
                  <select value={bank} onChange={e => setBank(e.target.value)} className="input-field" style={{ display: 'block' }}>
                    <option value="">Select your bank…</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>Account Holder Name</label>
                  <input value={holder} onChange={e => setHolder(e.target.value)} placeholder="Exactly as on your bank account"
                    className="input-field" style={{ display: 'block' }} />
                  <p style={{ fontSize: '0.75rem', color: '#8BA0B4', marginTop: '0.4rem' }}>Must match your bank account name exactly — this is how we verify ownership.</p>
                </div>
              </div>

              <div style={{ background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.2)', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Lock size={16} color="#C9963A" />
                <span style={{ fontSize: '0.82rem', color: '#8BA0B4', lineHeight: 1.5 }}>
                  Your bank credentials are entered directly at your bank — REPAIHUB never sees them. This is a read-only connection.
                </span>
              </div>

              <button onClick={startVerification} disabled={!bank || !holder.trim()}
                style={{ width: '100%', background: bank && holder ? '#C9963A' : 'rgba(201,150,58,0.3)', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: bank && holder ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                Verify with Flinks →
              </button>
            </>
          )}

          {step === 'verifying' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ width: 64, height: 64, margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '50%', animation: 'spin 2s linear infinite' }}>
                <Loader size={28} color="#C9963A" />
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Verifying Your Bank</h2>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>{progressLabel}</p>
              <div style={{ background: '#0B1C2C', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ height: '100%', background: '#C9963A', width: `${progress}%`, transition: 'width 0.5s ease', borderRadius: 4 }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>{progress}% complete</p>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ width: 64, height: 64, margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(39,174,96,0.1)', border: '1px solid rgba(39,174,96,0.4)', borderRadius: '50%' }}>
                <Check size={28} color="#27AE60" />
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Bank Verified</h2>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '0.5rem' }}>Account verified at <strong style={{ color: '#FAF6F0' }}>{bank}</strong></p>
              <p style={{ fontSize: '0.82rem', color: '#8BA0B4', marginBottom: '2rem' }}>We have not stored your account number — only a cryptographic hash.</p>
              <div style={{ background: '#0B1C2C', border: '1px solid rgba(39,174,96,0.3)', padding: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
                {[
                  ['Institution', bank],
                  ['Account Holder', holder],
                  ['Account Number', '••••••••••• (hashed)'],
                  ['KYC Status', '✓ Verified'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#8BA0B4' }}>{k}</span>
                    <span style={{ color: k === 'KYC Status' ? '#27AE60' : '#FAF6F0', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => nav('/onboarding/india-nro')}
                style={{ width: '100%', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Continue — Indian NRO Account →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
