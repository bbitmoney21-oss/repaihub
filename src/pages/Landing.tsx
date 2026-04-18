import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'

const FORMSPREE_ID = 'xjgpbqoy'

export default function Landing() {
  const { isAuthenticated } = useStore()
  const [heroEmail, setHeroEmail]   = useState('')
  const [ctaEmail, setCtaEmail]     = useState('')
  const [heroSent, setHeroSent]     = useState(false)
  const [ctaSent, setCtaSent]       = useState(false)
  const [loading, setLoading]       = useState<'hero'|'cta'|null>(null)
  const revealRefs = useRef<(HTMLElement | null)[]>([])

  // FX Calculator state
  const LIVE_RATE = 63.42 // INR per CAD
  const [calcINR, setCalcINR] = useState('500000')
  const calcAmt = parseFloat(calcINR.replace(/,/g,'')) || 0
  const tcsApplies = calcAmt > 700000
  const tcsAmt = tcsApplies ? calcAmt * 0.05 : 0
  const netINR = calcAmt - tcsAmt
  const grossCAD = netINR / LIVE_RATE
  const feeCAD = calcAmt <= 200000 ? 8 : calcAmt <= 500000 ? 12 : 15
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
    try {
      await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source: 'repaihub-waitlist', timestamp: new Date().toISOString() }),
      })
    } catch { /* graceful */ }
    which === 'hero' ? setHeroSent(true) : setCtaSent(true)
    setLoading(null)
  }

  return (
    <div style={{ background: '#0B1C2C', color: '#FAF6F0', fontFamily: "'DM Sans', system-ui, sans-serif" }} className="noise-bg">

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.25rem 3rem',
        background: 'rgba(11,28,44,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(201,150,58,0.2)',
      }}>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.6rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Repaihub
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/guide" style={{ color: '#8BA0B4', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FAF6F0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8BA0B4')}>
            NRI Guide
          </Link>
          {isAuthenticated
            ? <Link to="/app/dashboard" style={{ background: '#C9963A', color: '#0B1C2C', padding: '0.5rem 1.25rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E8B86D')}
                onMouseLeave={e => (e.currentTarget.style.background = '#C9963A')}>
                Dashboard
              </Link>
            : <>
                <Link to="/login" style={{ color: '#8BA0B4', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FAF6F0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#8BA0B4')}>
                  Sign In
                </Link>
                <Link to="/signup" style={{ background: '#C9963A', color: '#0B1C2C', padding: '0.5rem 1.25rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#E8B86D')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#C9963A')}>
                  Create Account
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
            Hours <span style={{ margin: '0 0.6rem', opacity: 0.5, fontWeight: 300 }}>·</span>
            Not Days <span style={{ margin: '0 0.6rem', opacity: 0.5, fontWeight: 300 }}>·</span>
            No Branch Visit. Ever.
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
              {isAuthenticated ? 'Go to Dashboard →' : 'Try the demo app →'}
            </Link>
          </div>

          {/* Trust bar */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '3.5rem', animation: 'fadeUp 0.8s ease both 1.1s', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['FINTRAC Registered MSB', 'RBI Compliant', 'Zero Document Storage', 'Bank-Grade Security'].map(t => (
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
          Over $9 billion CAD moves informally between India and Canada every year — not because people want to break rules, but because no simple legal option existed. Until now.
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
            { n: '01', title: 'Set Up Once', tag: 'One Time Only', text: 'Connect your Canadian bank account and Indian NRO account. Verify through your bank — we never store documents. Takes 20 minutes. Never again after this.' },
            { n: '02', title: 'Transfer in 90 Seconds', tag: 'Every Transfer', text: 'Enter the amount, see the live INR to CAD rate, confirm with Face ID. We handle Form 15CA, Form 15CB, and all compliance automatically. You just tap.' },
            { n: '03', title: 'CAD in Your Account', tag: '24–48 Hours', text: 'Track your transfer live. Push notification at every step. Standard transfers arrive within 48 hours. Express within 8–12 hours. Rate locked at confirmation.' },
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
              'Form 15CA filed automatically on your behalf.',
              'CA partner certifies Form 15CB — we handle it.',
              'We explain TCS, FEMA, and FINTRAC in plain English.',
              'Your documents are never stored on our servers — ever.',
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
            {['🍁 FINTRAC Registered MSB','🇮🇳 RBI — FEMA Compliant','🔒 PIPEDA Protected','📋 Form 15CA / 15CB Automated','🛡 Zero Document Storage','🏦 Bank-Verified Identity'].map(b => (
              <span key={b} className="badge">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '3rem 2rem', borderTop: '1px solid rgba(201,150,58,0.2)', borderBottom: '1px solid rgba(201,150,58,0.2)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '2rem', textAlign: 'center' }}>
          {[
            { n: '$9B', label: 'CAD moves informally/year', sub: 'Canada ↔ India' },
            { n: '1.8M', label: 'Indians in Canada', sub: 'Potential users' },
            { n: '24h', label: 'Standard transfer', sub: 'vs. days at a branch' },
            { n: '0', label: 'Documents stored', sub: 'Zero. Ever.' },
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
            <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9963A', display: 'block', marginBottom: '0.75rem' }}>Live Rate Calculator</span>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>See exactly what you'll receive</h2>
            <p style={{ color: '#8BA0B4', fontSize: '0.9rem' }}>Live rate: 1 CAD = ₹{LIVE_RATE.toFixed(2)} &nbsp;·&nbsp; No hidden fees. No surprises.</p>
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
                ...(tcsApplies ? [{ label: 'TCS deducted (5%) — Indian govt', value: `−₹${tcsAmt.toLocaleString('en-IN')}`, dim: true }] : []),
                { label: `FX conversion at ₹${LIVE_RATE}`, value: `CAD $${grossCAD.toFixed(2)}`, dim: false },
                { label: 'REPAIHUB flat fee', value: `−CAD $${feeCAD}`, dim: true },
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

            {tcsApplies && (
              <p style={{ fontSize: '0.75rem', color: '#8BA0B4', marginBottom: '1rem', lineHeight: 1.6 }}>
                ℹ️ TCS of 5% applies to transfers above ₹7 lakh under Indian tax law. This is not an REPAIHUB fee — it's deducted by the Indian government. You can claim TCS credit when filing your Indian ITR.
              </p>
            )}

            <Link to="/signup" style={{ display: 'block', textAlign: 'center', background: '#C9963A', color: '#0B1C2C', padding: '1rem', fontFamily: "'DM Sans'", fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E8B86D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C9963A')}>
              Start Your Transfer →
            </Link>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#8BA0B4', marginTop: '0.75rem' }}>Rate locked at confirmation · No surprises · Standard delivery 24–48 hrs</p>
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
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 700, color: '#C9963A', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Repaihub</span>
              <p style={{ fontSize: '0.8rem', color: '#8BA0B4', maxWidth: 260, lineHeight: 1.7 }}>Canada's first digital platform for NRO outward remittance. Legal. Simple. 24–48 hours.</p>
            </div>
            <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1rem' }}>Product</div>
                {[
                  { to: '/guide', label: 'NRI Guide' },
                  { to: '/login', label: 'Sign In' },
                  { to: '/signup', label: 'Get Started' },
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
              © 2026 REPAIHUB Inc. &nbsp;·&nbsp; FINTRAC Registered MSB &nbsp;·&nbsp; Ontario, Canada
            </p>
            <p style={{ fontSize: '0.72rem', color: '#8BA0B4', lineHeight: 1.6 }}>
              All transfers comply with FEMA regulations and RBI guidelines.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
