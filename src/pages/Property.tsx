import { useState } from 'react'
import { Link } from 'react-router-dom'

// Phase 2 placeholder: NRI property sale → repatriation.
// No property partner is named until an agreement is signed.
const FORMSPREE_ID = 'xjgpbqoy'

const C = { navy: '#0B1C2C', card: '#132233', gold: '#C9963A', goldLight: '#E8B86D', cream: '#FAF6F0', slate: '#8BA0B4', line: 'rgba(201,150,58,0.2)' }
const serif = "'Cormorant Garamond', Georgia, serif"

const steps = [
  { n: '01', title: 'Sell without a broker', text: 'Listing, buyer checks and paperwork coordinated online with a verified property partner, so you are not paying a broker or flying to India to meet buyers.' },
  { n: '02', title: 'Tax handled before the money moves', text: 'Our partner Chartered Accountant works out capital gains and TDS on the sale, and prepares Form 145 and Form 146 for the repatriation.' },
  { n: '03', title: 'Proceeds home to Canada', text: 'The sale proceeds move from your NRO account to your Canadian bank account through REPAIHUB, within the USD 1 million per financial year limit, split across years if needed.' },
]

export default function Property() {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [timing, setTiming] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, city, timing, source: 'property-phase2-interest', timestamp: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error(`Formspree responded ${res.status}`)
      setState('sent')
    } catch (err) {
      console.error('[Property] interest form failed:', err)
      setState('error')
    }
  }

  const input: React.CSSProperties = { width: '100%', background: '#1C3147', border: `1px solid ${C.line}`, color: '#FFFFFF', padding: '0.85rem 1rem', fontFamily: "'DM Sans'", fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ background: C.navy, color: C.cream, fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem clamp(1rem, 4vw, 3rem)', borderBottom: `1px solid ${C.line}` }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <img src="/logo.png" alt="REPAIHUB logo" style={{ width: 34, height: 34 }} />
          <span style={{ fontFamily: serif, fontSize: '1.4rem', fontWeight: 600, letterSpacing: '0.12em', color: C.goldLight }}>REPAIHUB</span>
        </Link>
        <Link to="/" style={{ color: C.slate, fontSize: '0.85rem', textDecoration: 'none' }}>← NRO transfers</Link>
      </nav>

      <section style={{ textAlign: 'center', padding: 'clamp(3rem, 8vw, 6rem) 1rem 3rem', maxWidth: 820, margin: '0 auto' }}>
        <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, border: `1px solid ${C.line}`, padding: '0.35rem 0.8rem', marginBottom: '1.5rem' }}>
          Coming in Phase 2
        </span>
        <h1 style={{ fontFamily: serif, fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', fontWeight: 600, lineHeight: 1.1, color: '#FFFFFF', margin: '0 0 1rem' }}>
          Selling a property in India?<br />
          <em style={{ fontStyle: 'normal', color: C.goldLight }}>Sale to Canadian account</em>, in one place.
        </h1>
        <p style={{ color: C.slate, fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 620, margin: '0 auto' }}>
          We are building a broker-free way for Indian-origin Canadians to sell a flat or house in India and bring the proceeds home legally, with the tax and paperwork handled.
        </p>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1rem 4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1px', background: C.line, border: `1px solid ${C.line}` }}>
          {steps.map(s => (
            <div key={s.n} style={{ background: C.card, padding: '2rem' }}>
              <div style={{ fontFamily: serif, fontSize: '3rem', fontWeight: 700, color: 'rgba(201,150,58,0.25)', lineHeight: 1 }}>{s.n}</div>
              <h2 style={{ fontFamily: serif, fontSize: '1.4rem', fontWeight: 600, color: '#FFFFFF', margin: '0.75rem 0' }}>{s.title}</h2>
              <p style={{ color: C.slate, fontSize: '0.92rem', lineHeight: 1.7, margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 520, margin: '0 auto', padding: '0 1rem 5rem' }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, padding: '2rem' }}>
          <h2 style={{ fontFamily: serif, fontSize: '1.7rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 0.5rem' }}>Register your interest</h2>
          <p style={{ color: C.slate, fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>Tell us roughly where and when. We will contact you when Phase 2 opens. No obligation.</p>
          {state === 'sent' ? (
            <div style={{ background: 'rgba(201,150,58,0.12)', border: `1px solid ${C.gold}`, padding: '1rem', color: C.goldLight, textAlign: 'center' }}>
              Thank you. You're on the Phase 2 list.
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'grid', gap: '0.9rem' }}>
              <input type="email" required placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={input} aria-label="Email" />
              <input type="text" placeholder="City of the property in India" value={city} onChange={e => setCity(e.target.value)} style={input} aria-label="City of the property" />
              <select value={timing} onChange={e => setTiming(e.target.value)} style={input} aria-label="When you plan to sell">
                <option value="">When are you planning to sell?</option>
                <option value="0-6 months">In the next 6 months</option>
                <option value="6-12 months">In 6–12 months</option>
                <option value="12+ months">More than a year from now</option>
                <option value="already sold">Already sold — need to repatriate</option>
              </select>
              <button type="submit" disabled={state === 'sending'} style={{ background: C.gold, color: C.navy, border: 'none', padding: '1rem', fontFamily: "'DM Sans'", fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {state === 'sending' ? 'Sending…' : 'Keep me informed'}
              </button>
              {state === 'error' && (
                <p role="alert" style={{ color: '#F2A7A7', fontSize: '0.85rem', margin: 0 }}>
                  That didn't go through. Please try again, or email founder@repaihub.com.
                </p>
              )}
              <p style={{ color: C.slate, fontSize: '0.75rem', lineHeight: 1.6, margin: 0 }}>
                Already sold and the money is in your NRO account? <Link to="/" style={{ color: C.goldLight }}>Join the REPAIHUB transfer waitlist.</Link>
              </p>
            </form>
          )}
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: '1.5rem 1rem', textAlign: 'center', color: C.slate, fontSize: '0.75rem', lineHeight: 1.7 }}>
        © 2026 REPAIHUB Remittance Inc. · FINTRAC MSB No. N300002485 · Ontario, Canada<br />
        Phase 2 service in development. Property partners will be named before launch. Not tax or legal advice.
      </footer>
    </div>
  )
}
