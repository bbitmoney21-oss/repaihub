import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Shield, Check, Loader } from 'lucide-react'

const BANKS = ['HDFC Bank', 'ICICI Bank', 'SBI — State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Yes Bank', 'IDFC FIRST Bank', 'Punjab National Bank', 'Bank of Baroda', 'Other']
const BRANCHES = ['Mumbai — Bandra West', 'Mumbai — Andheri', 'Delhi — Connaught Place', 'Bengaluru — Indiranagar', 'Chennai — Anna Nagar', 'Hyderabad — Banjara Hills', 'Pune — Koregaon Park', 'Other']

type Step = 'intro' | 'form' | 'digilocker' | 'verifying' | 'done'

export default function IndiaNRO() {
  const { completeIndiaKYC } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('intro')
  const [bank, setBank] = useState('')
  const [branch, setBranch] = useState('')
  const [pan, setPan] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')

  const startDigiLocker = async () => {
    if (!bank || !branch) return
    setStep('digilocker')
    await new Promise(r => setTimeout(r, 1500))
    setStep('verifying')
    const steps = [
      [15, 'Connecting to DigiLocker API…'],
      [30, 'Requesting user consent…'],
      [50, 'Retrieving PAN holder name…'],
      [65, 'Cross-checking with NRO bank records…'],
      [80, 'Generating verification token…'],
      [92, 'Discarding personal data…'],
      [100, 'KYC complete'],
    ]
    for (const [pct, label] of steps) {
      await new Promise(r => setTimeout(r, 600))
      setProgress(pct as number)
      setProgressLabel(label as string)
    }
    await new Promise(r => setTimeout(r, 400))
    completeIndiaKYC({ bankName: bank, branch })
    setStep('done')
  }

  return (
    <div style={{ background: '#0B1C2C', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem' }}>
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.06) 0%, transparent 70%)', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 540, position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Repaihub</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {['Account', 'Residency', 'Canada KYC', 'India KYC'].map((s) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 3, background: '#C9963A', borderRadius: 2, marginBottom: '0.3rem' }} />
              <span style={{ fontSize: '0.6rem', color: '#C9963A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem' }}>

          {step === 'intro' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ width: 48, height: 48, background: 'rgba(201,150,58,0.1)', border: '1px solid rgba(201,150,58,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield color="#C9963A" size={22} />
                </div>
                <div>
                  <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.1 }}>Indian NRO Account</h1>
                  <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.25rem' }}>Step 4 of 4 — DigiLocker + PAN Verification</p>
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '2rem' }}>
                We verify your Indian NRO account ownership through DigiLocker. Your PAN is cross-checked against your bank records. <strong style={{ color: '#FAF6F0' }}>No Aadhaar. No PAN number stored — ever.</strong>
              </p>

              <div style={{ background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.15)', padding: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.75rem' }}>Zero Storage KYC Flow</div>
                {[
                  ['You grant DigiLocker consent', 'One-time, in-app'],
                  ['We retrieve PAN holder name + DOB', 'Read-only'],
                  ['We cross-check against your NRO bank', 'Instant match'],
                  ['We generate a verification token', 'Stored securely'],
                  ['We immediately discard DigiLocker data', 'Never stored'],
                ].map(([step, note]) => (
                  <div key={step} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#FAF6F0' }}>
                      <Check size={13} color="#27AE60" /> {step}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#8BA0B4' }}>{note}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setStep('form')}
                style={{ width: '100%', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Continue to NRO Details →
              </button>
            </>
          )}

          {step === 'form' && (
            <>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>NRO Account Details</h1>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>Enter your Indian NRO bank details</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>Indian Bank Name</label>
                  <select value={bank} onChange={e => setBank(e.target.value)} className="input-field" style={{ display: 'block' }}>
                    <option value="">Select your Indian bank…</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>Branch (City)</label>
                  <select value={branch} onChange={e => setBranch(e.target.value)} className="input-field" style={{ display: 'block' }}>
                    <option value="">Select branch…</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' }}>PAN Card Number <span style={{ color: '#8BA0B4', fontWeight: 400 }}>(for DigiLocker consent)</span></label>
                  <input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10}
                    className="input-field" style={{ display: 'block', letterSpacing: '0.15em', fontFamily: 'monospace' }} />
                  <p style={{ fontSize: '0.75rem', color: '#8BA0B4', marginTop: '0.4rem' }}>Used only for DigiLocker identity grant. Never stored on our servers.</p>
                </div>
              </div>

              <button onClick={startDigiLocker} disabled={!bank || !branch}
                style={{ width: '100%', background: bank && branch ? '#C9963A' : 'rgba(201,150,58,0.3)', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: bank && branch ? 'pointer' : 'not-allowed' }}>
                Grant DigiLocker Consent →
              </button>
            </>
          )}

          {step === 'digilocker' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.3)', padding: '2rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🇮🇳</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>DigiLocker — Connecting</div>
                <p style={{ fontSize: '0.82rem', color: '#8BA0B4' }}>Simulating DigiLocker API OAuth consent flow…</p>
                <div style={{ margin: '1.5rem 0 1rem', height: 4, background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #C9963A, #E8B86D)', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>This is a demo simulation — in production, DigiLocker's secure OAuth window would open here.</p>
              </div>
            </div>
          )}

          {step === 'verifying' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ width: 64, height: 64, margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '50%', animation: 'spin 2s linear infinite' }}>
                <Loader size={28} color="#C9963A" />
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Verifying NRO Account</h2>
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
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>NRO Account Verified</h2>
              <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>Your DigiLocker data has been discarded. Only a verification token was stored.</p>
              <div style={{ background: '#0B1C2C', border: '1px solid rgba(39,174,96,0.3)', padding: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
                {[
                  ['Indian Bank', bank],
                  ['Branch', branch],
                  ['PAN Verification', '✓ Matched (discarded)'],
                  ['KYC Status', '✓ Fully Verified'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#8BA0B4' }}>{k}</span>
                    <span style={{ color: k === 'KYC Status' || k === 'PAN Verification' ? '#27AE60' : '#FAF6F0', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => nav('/onboarding/complete')}
                style={{ width: '100%', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Complete Setup →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
