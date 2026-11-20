import { outwardFee } from '../lib/outwardPricing'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'

const FORMSPREE_ID = 'xjgpbqoy'

// Track viewport width so the top nav can collapse on real mobile.
// F12 emulation matches device-width but real mobile fonts/DPR sometimes
// render differently; explicit responsive sizing keeps the nav clean
// at both 320 and 1440 widths.
function useIsMobile(threshold = 640) {
  const [v, setV] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < threshold
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setV(window.innerWidth < threshold)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [threshold])
  return v
}

export default function Landing() {
  const { isAuthenticated } = useStore()
  const isMobile = useIsMobile()
  const [heroEmail, setHeroEmail]   = useState('')
  const [ctaEmail, setCtaEmail]     = useState('')
  const [heroSent, setHeroSent]     = useState(false)
  const [ctaSent, setCtaSent]       = useState(false)
  const [loading, setLoading]       = useState<'hero'|'cta'|null>(null)
  const [formError, setFormError]   = useState<'hero'|'cta'|null>(null)
  const revealRefs = useRef<(HTMLElement | null)[]>([])

  // FX Calculator state
  const LIVE_RATE = 63.42 // INR per CAD — indicative reference rate, not live
  const [calcINR, setCalcINR] = useState('500000')
  const calcAmt = parseFloat(calcINR.replace(/,/g,'')) || 0
  const grossCAD = calcAmt / LIVE_RATE
  // Standard pricing (src/lib/outwardPricing.ts): base fee + marginal markup
  const feeCAD = outwardFee(calcAmt, LIVE_RATE, 'standard').totalCAD
  const youGetCAD = Math.max(0, grossCAD - feeCAD)
  const formatINRCalc = (v: string) => { const n = v.replace(/\D/g,''); return n ? parseInt(n).toLocaleString('en-IN') : '' }
  const handleCalcInput = useCallback((v: string) => setCalcINR(v.replace(/,/g,'')), [])

  useEffect(() => {
    const revealVisible = () => {
      revealRefs.current.forEach((el, i) => {
        if (!el || el.classList.contains('visible')) return
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight - 60) {
          setTimeout(() => el.classList.add('visible'), i * 60)
        }
      })
    }
    // Run immediately (catches elements already in viewport on load)
    setTimeout(revealVisible, 80)
    window.addEventListener('scroll', revealVisible, { passive: true })
    return () => window.removeEventListener('scroll', revealVisible)
  }, [])

  const addReveal = (el: HTMLElement | null, idx: number) => {
    revealRefs.current[idx] = el
  }

  const submit = async (email: string, which: 'hero' | 'cta') => {
    if (!email) return
    setLoading(which)
    setFormError(null)
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source: 'repaihub-waitlist', timestamp: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error(`Formspree responded ${res.status}`)
      if (which === 'hero') setHeroSent(true)
      else setCtaSent(true)
    } catch (err) {
      console.error('[Landing] waitlist submit failed:', err)
      setFormError(which)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ background: '#0B1C2C', color: '#FAF6F0', fontFamily: "'DM Sans', system-ui, sans-serif" }} className="noise-bg">

      {/* NAV — responsive: tightens at <640px to fit on real mobile */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: isMobile ? '0.75rem 1rem' : '1.25rem 3rem',
        background: 'rgba(11,28,44,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(201,150,58,0.2)',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.6rem', minWidth: 0 }}>
          <img src="/logo.png" alt="REPAIHUB logo"
            width={isMobile ? 28 : 36} height={isMobile ? 28 : 36}
            style={{
              width: isMobile ? 28 : 36, height: isMobile ? 28 : 36,
              borderRadius: '50%', flexShrink: 0,
            }} />
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: isMobile ? '1.05rem' : '1.6rem',
            fontWeight: 700, color: '#E8B86D',
            letterSpacing: isMobile ? '0.08em' : '0.12em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            Repaihub
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.6rem' : '1.5rem', flexShrink: 0 }}>
          {/* NRI Guide hidden on mobile — still in footer.  Reduces nav width
              by ~80px so the wordmark + CTA both fit at 320-430px viewports. */}
          {!isMobile && (
            <Link to="/guide" style={{ color: '#8BA0B4', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FAF6F0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8BA0B4')}>
              NRI Guide
            </Link>
          )}
          {isAuthenticated
            ? <Link to="/app/dashboard" style={{
                background: '#C9963A', color: '#0B1C2C',
                padding: isMobile ? '0.45rem 0.75rem' : '0.5rem 1.25rem',
                fontSize: isMobile ? '0.7rem' : '0.78rem',
                fontWeight: 700, letterSpacing: isMobile ? '0.05em' : '0.1em',
                textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s',
                whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E8B86D')}
                onMouseLeave={e => (e.currentTarget.style.background = '#C9963A')}>
                Dashboard
              </Link>
            : <>
                <Link to="/login" style={{
                  color: '#8BA0B4',
                  fontSize: isMobile ? '0.78rem' : '0.85rem',
                  fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s',
                  whiteSpace: 'nowrap',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FAF6F0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#8BA0B4')}>
                  Sign In
                </Link>
                <Link to="/signup" style={{
                  background: '#C9963A', color: '#0B1C2C',
                  padding: isMobile ? '0.45rem 0.75rem' : '0.5rem 1.25rem',
                  fontSize: isMobile ? '0.7rem' : '0.78rem',
                  fontWeight: 700, letterSpacing: isMobile ? '0.05em' : '0.1em',
                  textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s',
                  whiteSpace: 'nowrap',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#E8B86D')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#C9963A')}>
                  {isMobile ? 'Sign Up' : 'Create Account'}
                </Link>
              </>
          }
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8rem 2rem 5rem', overflow: 'hidden' }}>
        {/* Glow */}
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.12) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'fadeUp 0.8s ease both 0.2s' }}>
            <span style={{ width: 40, height: 1, background: '#C9963A', opacity: 0.5 }} />
            NRO Outward Remittance — Canada
            <span style={{ width: 40, height: 1, background: '#C9963A', opacity: 0.5 }} />
          </span>

          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(3rem, 8vw, 6.5rem)', fontWeight: 600, lineHeight: 1.05, color: '#FFFFFF', marginBottom: '0.5rem', animation: 'fadeUp 0.8s ease both 0.4s' }}>
            Your <em style={{ fontStyle: 'normal', color: '#E8B86D' }}>Indian</em> savings.<br/>
            Your <em style={{ fontStyle: 'normal', color: '#E8B86D' }}>Canadian</em> account.
          </h1>

          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', fontWeight: 400, color: 'rgba(250,246,240,0.6)', marginBottom: '1rem', animation: 'fadeUp 0.8s ease both 0.55s' }}>
            Legal. Simple. Fast.
          </p>

          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.1rem, 2.5vw, 1.7rem)', fontWeight: 500, letterSpacing: '0.08em', color: '#C9963A', marginBottom: '3rem', animation: 'fadeUp 0.8s ease both 0.7s' }}>
            Paperwork Handled <span style={{ margin: '0 0.6rem', opacity: 0.5, fontWeight: 300 }}>·</span>
            No Branch Visit
          </p>

          {/* Waitlist form */}
          <div style={{ width: '100%', maxWidth: 480, animation: 'fadeUp 0.8s ease both 0.9s' }}>
            {!heroSent ? (
              <>
                <form onSubmit={e => { e.preventDefault(); submit(heroEmail, 'hero') }}
                  style={{ display: 'flex', border: '1px solid rgba(201,150,58,0.2)', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)', transition: 'border-color 0.3s' }}
                  onFocus={e => ((e.currentTarget as HTMLFormElement).style.borderColor = '#C9963A')}
                  onBlur={e => ((e.currentTarget as HTMLFormElement).style.borderColor = 'rgba(201,150,58,0.2)')}
                >
                  <input type="email" value={heroEmail} onChange={e => setHeroEmail(e.target.value)} placeholder="your@email.com" required
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '1rem 1.25rem', fontFamily: "'DM Sans'", fontSize: '0.95rem', color: '#FFFFFF' }} />
                  <button type="submit" disabled={loading === 'hero'}
                    style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem 1.5rem', fontFamily: "'DM Sans'", fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s', whiteSpace: 'nowrap' }}>
                    {loading === 'hero' ? 'Joining...' : 'Join Waitlist'}
                  </button>
                </form>
                <p style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: '#8BA0B4', textAlign: 'center' }}>No spam. Ever. Unsubscribe anytime.</p>
                {formError === 'hero' && <p role="alert" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#F2A7A7', textAlign: 'center' }}>That didn't go through. Please try again, or email founder@repaihub.com.</p>}
              </>
            ) : (
              <div style={{ background: 'rgba(201,150,58,0.12)', border: '1px solid #C9963A', padding: '1rem 1.5rem', color: '#E8B86D', textAlign: 'center', lineHeight: 1.5 }}>
                🎉 You're on the list. We'll reach out before anyone else.<br/>
                <span style={{ opacity: 0.7, fontSize: '0.85em' }}>Tell a friend who needs this too.</span>
              </div>
            )}
          </div>

          {/* Try it now button */}
          <div style={{ marginTop: '1.5rem', animation: 'fadeUp 0.8s ease both 1.0s' }}>
            <Link to={isAuthenticated ? '/app/dashboard' : '/signup'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#E8B86D', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', borderBottom: '1px solid rgba(232,184,109,0.4)', paddingBottom: '2px', transition: 'all 0.2s' }}>
              {isAuthenticated ? 'Go to Dashboard →' : 'Try the demo app (no real money) →'}
            </Link>
          </div>

          {/* Trust bar */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '3.5rem', animation: 'fadeUp 0.8s ease both 1.1s', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Beta Preview', 'FINTRAC-Registered MSB', 'Partner CA Certifies Form 146', 'Bank-Verified Identity'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8BA0B4' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9963A', opacity: 0.7 }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(201,150,58,0.2), transparent)' }} />

      {/* THE PROBLEM */}
      <section style={{ padding: '7rem 2rem', textAlign: 'center', position: 'relative' }}>
        <span ref={el => addReveal(el, 0)} className="reveal" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1.5rem', display: 'block' }}>The Problem We're Solving</span>
        <p ref={el => addReveal(el, 1)} className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.6rem, 4vw, 2.8rem)', fontWeight: 500, color: '#FAF6F0', maxWidth: 720, margin: '0 auto 1.5rem', lineHeight: 1.3 }}>
          You became Canadian. Your savings stayed Indian.<br/>
          Your bank says <strong style={{ color: '#E8B86D' }}>"visit a branch in India."</strong><br/>
          So you ask a friend. Everyone does.
        </p>
        <p ref={el => addReveal(el, 2)} className="reveal" style={{ fontSize: '1rem', color: '#8BA0B4', maxWidth: 560, margin: '0 auto', lineHeight: 1.75 }}>
          Many people wait for their next trip to India, or ask a relative to sort it out — not because they want to break rules, but because there has been no simple, legal, online option. We are building one.
        </p>
      </section>

      <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(201,150,58,0.2), transparent)' }} />

      {/* HOW IT WORKS */}
      <section style={{ padding: '6rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div ref={el => addReveal(el, 3)} className="reveal" style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9963A', display: 'block', marginBottom: '1rem' }}>How It Works</span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 600, color: '#FFFFFF' }}>Three steps. One time setup.</h2>
        </div>
        <div ref={el => addReveal(el, 4)} className="reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5px', background: 'rgba(201,150,58,0.2)', border: '1px solid rgba(201,150,58,0.2)' }}>
          {[
            { n: '01', title: 'Set Up Once', tag: 'One Time Only', text: 'Connect your Canadian bank account and Indian NRO account. Verify your identity online through your bank and DigiLocker. One-time setup.' },
            { n: '02', title: 'Transfer in 90 Seconds', tag: 'Every Transfer', text: 'Enter the amount, see the live INR to CAD rate, confirm with Face ID. We handle Form 145, Form 146, and all compliance automatically. You just tap.' },
            { n: '03', title: 'CAD in Your Account', tag: '3–5 Business Days', text: 'Track your transfer at every step. Standard arrives within 5 business days and Express within 3, after your documents are accepted. Rate locked at confirmation.' },
          ].map(c => (
            <div key={c.n} style={{ background: '#132233', padding: '2.5rem 2rem', transition: 'background 0.3s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = '#1C3147')}
              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = '#132233')}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4rem', fontWeight: 700, color: 'rgba(201,150,58,0.12)', lineHeight: 1, display: 'block', marginBottom: '1rem' }}>{c.n}</span>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.75rem' }}>{c.title}</h3>
              <p style={{ fontSize: '0.9rem', color: '#8BA0B4', lineHeight: 1.7 }}>{c.text}</p>
              <span style={{ display: 'inline-block', marginTop: '1.25rem', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9963A', border: '1px solid rgba(201,150,58,0.2)', padding: '0.3rem 0.7rem' }}>{c.tag}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(201,150,58,0.2), transparent)' }} />

      {/* WHY REPAIHUB */}
      <section style={{ padding: '6rem 2rem', background: '#132233', borderTop: '1px solid rgba(201,150,58,0.2)', borderBottom: '1px solid rgba(201,150,58,0.2)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '4rem', alignItems: 'center' }}>
          <div ref={el => addReveal(el, 5)} className="reveal">
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.15, marginBottom: '1.5rem' }}>
              Built by an <em style={{ fontStyle: 'normal', color: '#E8B86D' }}>NRI.</em><br/>For NRIs.
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#8BA0B4', lineHeight: 1.8, marginBottom: '1rem' }}>
              I became a Canadian citizen. I still had savings in my NRO account. My bank told me to visit a branch in India. So I built REPAIHUB.
            </p>
            <p style={{ fontSize: '0.95rem', color: '#8BA0B4', lineHeight: 1.8 }}>
              We understand every form, every rule, and every frustration — because we lived it.
            </p>
          </div>
          <ul ref={el => addReveal(el, 6)} className="reveal" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem', padding: 0, margin: 0 }}>
            {[
              'No branch visit. No physical forms. No fax.',
              'Form 145 filed automatically on your behalf (IT Act 2025).',
              'CA partner certifies Form 146 — we handle it.',
              'We explain TDS, FEMA, and FINTRAC rules in plain English.',
              'We collect only what Indian and Canadian rules require, and encrypt it.',
              'Annual tax summary report for your ITR filing.',
              'Push notification at every single step.',
              'Canadian customer support that understands NRO rules.',
            ].map((item, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', fontSize: '0.9rem', color: '#FAF6F0', lineHeight: 1.6 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(201,150,58,0.15)', border: '1px solid #C9963A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, color: '#C9963A', fontSize: '0.6rem', fontWeight: 700 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* COMPLIANCE */}
      <section style={{ padding: '5rem 2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <span ref={el => addReveal(el, 7)} className="reveal" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9963A', display: 'block', marginBottom: '1.5rem' }}>Regulation & Compliance</span>
          <h2 ref={el => addReveal(el, 8)} className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '1rem' }}>
            We celebrate compliance.<br/>We don't hide it.
          </h2>
          <p ref={el => addReveal(el, 9)} className="reveal" style={{ fontSize: '0.95rem', color: '#8BA0B4', marginBottom: '2.5rem', lineHeight: 1.75 }}>
            Every transfer is fully legal, reported, and protected. You get a complete audit trail.
          </p>
          <div ref={el => addReveal(el, 10)} className="reveal" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['🍁 FINTRAC-Registered MSB · No. N300002485','🇮🇳 Transfers via a Regulated Indian Partner Bank','🔒 PIPEDA Privacy Obligations','📋 Form 145 / 146 Handled (IT Act 2025)','🏦 Bank-Verified Identity'].map(b => (
              <span key={b} className="badge">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '3rem 2rem', borderTop: '1px solid rgba(201,150,58,0.2)', borderBottom: '1px solid rgba(201,150,58,0.2)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '2rem', textAlign: 'center' }}>
          {[
            { n: '2.6M', label: 'South Asian Canadians', sub: 'Statistics Canada, 2021 Census' },
            { n: 'USD 1M', label: 'Yearly NRO repatriation limit', sub: 'Per person, per financial year' },
            { n: '3–5 days', label: 'Express or Standard delivery', sub: 'Business days, after documents are accepted' },
            { n: '145 / 146', label: 'Forms handled for you', sub: 'With a partner CA' },
          ].map((s, si) => (
            <div key={s.n} ref={el => addReveal(el, 11 + si)} className="reveal">
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 700, color: '#E8B86D', lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: '0.85rem', color: '#FAF6F0', fontWeight: 500, marginTop: '0.5rem' }}>{s.label}</div>
              <div style={{ fontSize: '0.75rem', color: '#8BA0B4', marginTop: '0.25rem' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(201,150,58,0.2), transparent)' }} />

      {/* FX RATE CALCULATOR */}
      <section style={{ padding: '6rem 2rem', background: '#071420' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9963A', display: 'block', marginBottom: '0.75rem' }}>Fee Estimator</span>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>See exactly what you'll receive</h2>
            <p style={{ color: '#8BA0B4', fontSize: '0.9rem' }}>Indicative rate (not live): 1 CAD = ₹{LIVE_RATE.toFixed(2)} &nbsp;·&nbsp; Proposed beta pricing, subject to change.</p>
          </div>

          {/* Calculator card */}
          <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.25)', padding: '2rem' }}>
            {/* Input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.6rem' }}>
                Amount in your NRO account (₹)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#1C3147', border: '1px solid rgba(201,150,58,0.2)', transition: 'border-color 0.2s' }}>
                <span style={{ padding: '0 1rem', color: '#C9963A', fontSize: '1.2rem', fontWeight: 600, fontFamily: "'Cormorant Garamond', serif" }}>₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatINRCalc(calcINR)}
                  onChange={e => handleCalcInput(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '1rem 0', fontSize: '1.25rem', fontWeight: 600, color: '#FAF6F0', fontFamily: "'DM Sans'" }}
                />
              </div>
              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                {[100000, 300000, 500000, 1000000].map(amt => (
                  <button key={amt} onClick={() => setCalcINR(String(amt))}
                    style={{ background: calcAmt === amt ? 'rgba(201,150,58,0.15)' : 'transparent', border: `1px solid ${calcAmt === amt ? '#C9963A' : 'rgba(201,150,58,0.2)'}`, color: calcAmt === amt ? '#E8B86D' : '#8BA0B4', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                    ₹{(amt/100000).toFixed(amt < 100000 ? 1 : 0)}{amt >= 100000 ? 'L' : 'K'}
                  </button>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: 'center', color: '#C9963A', fontSize: '1.5rem', margin: '0.5rem 0', opacity: 0.5 }}>↓</div>

            {/* Breakdown */}
            <div style={{ background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.15)', padding: '1.25rem', marginBottom: '1rem' }}>
              {[
                { label: 'Transfer amount', value: `₹${calcAmt.toLocaleString('en-IN')}`, dim: false },
                { label: `FX conversion at ₹${LIVE_RATE} (indicative)`, value: `CAD $${grossCAD.toFixed(2)}`, dim: false },
                { label: 'REPAIHUB fee, standard (proposed)', value: `−CAD $${feeCAD.toFixed(2)}`, dim: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(201,150,58,0.08)', fontSize: '0.88rem' }}>
                  <span style={{ color: row.dim ? '#8BA0B4' : '#FAF6F0' }}>{row.label}</span>
                  <span style={{ color: row.dim ? '#8BA0B4' : '#FAF6F0', fontFamily: "'DM Sans'", fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 0 0', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FAF6F0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>You Receive</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#E8B86D', fontFamily: "'Cormorant Garamond', serif" }}>
                  CAD ${youGetCAD.toFixed(2)}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#8BA0B4', marginBottom: '1rem', lineHeight: 1.6 }}>
              ℹ️ Estimate only. The final rate is the partner bank's rate, shown before you confirm. Indian tax (TDS) on your NRO income is settled before repatriation; our partner CA confirms your position.
            </p>

            <Link to="/signup" style={{ display: 'block', textAlign: 'center', background: '#C9963A', color: '#0B1C2C', padding: '1rem', fontFamily: "'DM Sans'", fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E8B86D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C9963A')}>
              Start Your Transfer →
            </Link>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#8BA0B4', marginTop: '0.75rem' }}>Base fee + a percentage applied band by band, like tax brackets · Standard up to 5 business days</p>
          </div>
        </div>
      </section>

      <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(201,150,58,0.2), transparent)' }} />

      {/* FINAL CTA */}
      <section style={{ padding: '7rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.08) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.75rem' }}>Be first.<br/>The waitlist is open.</h2>
          <p style={{ fontSize: '1rem', color: '#8BA0B4', marginBottom: '2.5rem' }}>
            We are onboarding our first 500 users personally.<br/>
            Join now and get early access before public launch.
          </p>
          <div style={{ maxWidth: 440, margin: '0 auto' }}>
            {!ctaSent ? (
              <form onSubmit={e => { e.preventDefault(); submit(ctaEmail, 'cta') }}
                style={{ display: 'flex', border: '1px solid rgba(201,150,58,0.2)', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                <input type="email" value={ctaEmail} onChange={e => setCtaEmail(e.target.value)} placeholder="your@email.com" required
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '1rem 1.25rem', fontFamily: "'DM Sans'", fontSize: '0.95rem', color: '#FFFFFF' }} />
                <button type="submit" disabled={loading === 'cta'}
                  style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem 1.5rem', fontFamily: "'DM Sans'", fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {loading === 'cta' ? 'Joining...' : 'Reserve My Spot'}
                </button>
              </form>
            ) : (
              <div style={{ background: 'rgba(201,150,58,0.12)', border: '1px solid #C9963A', padding: '1rem 1.5rem', color: '#E8B86D', textAlign: 'center' }}>
                🎉 You're on the list. We'll reach out before anyone else.
              </div>
            )}
            <p style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: '#8BA0B4', textAlign: 'center' }}>Free to join. No commitment. No spam.</p>
                {formError === 'cta' && <p role="alert" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#F2A7A7', textAlign: 'center' }}>That didn't go through. Please try again, or email founder@repaihub.com.</p>}
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{ background: 'transparent', border: '1px solid rgba(201,150,58,0.4)', color: '#C9963A', padding: '0.75rem 2rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.2s' }}>
              Try Demo App →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem 3rem', background: '#071420' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <img src="/logo.png" alt="REPAIHUB logo" width={32} height={32} style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 700, color: '#C9963A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Repaihub</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#8BA0B4', maxWidth: 260, lineHeight: 1.7 }}>Digital NRO repatriation for Indian-origin Canadians. Beta preview.</p>
            </div>
            <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1rem' }}>Product</div>
                {[
                  { to: '/guide', label: 'NRI Guide' },
                  { to: '/login', label: 'Sign In' },
                  { to: '/signup', label: 'Get Started' },
                  { to: '/property', label: 'Selling Property? (Phase 2)' },
                ].map(l => (
                  <div key={l.to} style={{ marginBottom: '0.6rem' }}>
                    <Link to={l.to} style={{ fontSize: '0.82rem', color: '#8BA0B4', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#FAF6F0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#8BA0B4')}>
                      {l.label}
                    </Link>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1rem' }}>Legal</div>
                {[
                  { to: '/privacy', label: 'Privacy Policy' },
                  { to: '/terms', label: 'Terms of Service' },
                ].map(l => (
                  <div key={l.to} style={{ marginBottom: '0.6rem' }}>
                    <Link to={l.to} style={{ fontSize: '0.82rem', color: '#8BA0B4', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#FAF6F0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#8BA0B4')}>
                      {l.label}
                    </Link>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1rem' }}>Contact</div>
                <a href="mailto:founder@repaihub.com" style={{ fontSize: '0.82rem', color: '#8BA0B4', textDecoration: 'none', display: 'block', marginBottom: '0.6rem' }}>founder@repaihub.com</a>
                <span style={{ fontSize: '0.82rem', color: '#8BA0B4', display: 'block' }}>+1 647 876 6285</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(201,150,58,0.15)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#8BA0B4', lineHeight: 1.6 }}>
              © 2026 REPAIHUB Remittance Inc. &nbsp;·&nbsp; FINTRAC MSB No. N300002485 &nbsp;·&nbsp; Ontario, Canada
            </p>
            <p style={{ fontSize: '0.72rem', color: '#8BA0B4', lineHeight: 1.6 }}>
              Transfers will be executed by a regulated Indian partner bank under FEMA rules.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
