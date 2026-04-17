import { useState } from 'react'
import { Link } from 'react-router-dom'

const FAQ_ITEMS = [
  { q: 'Can I transfer without going to India?', a: 'Yes — 100% digital. REPAIHUB handles Form 15CA filing, Form 15CB certification, and the actual transfer from your phone in Canada. No branch visit required.' },
  { q: 'My Indian mobile number is inactive. Can I still verify?', a: 'Yes. We use Email OTP as our primary method (your bank-registered email, works globally), then netbanking login as backup. ~60% of NRIs have inactive Indian SIMs — we designed around this reality from day one.' },
  { q: 'Does REPAIHUB store my passport or Aadhaar?', a: 'Never. Your account number and PAN are stored only as SHA-256 hashes. We store zero identity documents on our servers — ever.' },
  { q: 'Is TCS my money or a fee?', a: 'TCS is YOUR money — collected as a credit against your Indian tax liability. Claim it back when filing your Indian ITR. REPAIHUB shows you exactly when TCS applies before any transfer.' },
  { q: 'Will I owe tax in Canada on the transferred money?', a: 'The transfer itself is not a taxable event in Canada. However, the underlying income (rent, dividends) must be declared on your T1. The India-Canada DTAA protects you from double taxation. REPAIHUB provides annual summaries for your accountant.' },
  { q: 'Is REPAIHUB regulated?', a: 'Yes. FINTRAC-registered Money Services Business in Canada. Full compliance with FEMA, RBI outward remittance guidelines, and PIPEDA.' },
]

export default function Guide() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const S = {
    page:   { background: '#0B1C2C', color: '#FAF6F0', fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' } as React.CSSProperties,
    nav:    { position: 'sticky' as const, top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 3rem', background: 'rgba(11,28,44,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(201,150,58,0.2)' },
    logo:   { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.12em', textTransform: 'uppercase' as const, textDecoration: 'none' },
    hero:   { padding: '5rem 2rem 4rem', textAlign: 'center' as const, background: 'linear-gradient(180deg, #1C3147 0%, #0B1C2C 100%)', borderBottom: '1px solid rgba(201,150,58,0.2)' },
    content:{ maxWidth: 820, margin: '0 auto', padding: '4rem 2rem 6rem' },
    sLabel: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: '#C9963A', marginBottom: '0.5rem', display: 'block' },
    h2:     { fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(201,150,58,0.2)' },
    p:      { fontSize: '0.95rem', color: '#8BA0B4', marginBottom: '1.5rem', lineHeight: 1.8 },
    infoBox:{ background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.2)', borderLeft: '3px solid #C9963A', padding: '1.25rem 1.5rem', margin: '1.5rem 0', borderRadius: '0 4px 4px 0' },
    table:  { width: '100%', borderCollapse: 'collapse' as const, margin: '1.5rem 0', fontSize: '0.88rem' },
    th:     { padding: '0.85rem 1rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#C9963A', background: '#1C3147', borderBottom: '1px solid #C9963A' },
    td:     { padding: '1rem', color: '#FAF6F0', verticalAlign: 'top' as const, lineHeight: 1.5, borderBottom: '1px solid rgba(201,150,58,0.1)' },
    tdGold: { padding: '1rem', color: '#E8B86D', fontWeight: 500, verticalAlign: 'top' as const, lineHeight: 1.5, borderBottom: '1px solid rgba(201,150,58,0.1)' },
  }

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link to="/" style={S.logo}>Repaihub</Link>
        <Link to="/signup" style={{ background: '#C9963A', color: '#0B1C2C', padding: '0.6rem 1.25rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Get Started
        </Link>
      </nav>

      <div style={S.hero}>
        <span style={S.sLabel}>Plain English Guide</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.15, marginBottom: '1rem', marginTop: '1rem' }}>
          Everything You Need to Know About<br/><em style={{ fontStyle: 'normal', color: '#E8B86D' }}>NRO Outward Remittance</em>
        </h1>
        <p style={{ fontSize: '1rem', color: '#8BA0B4', maxWidth: 520, margin: '0 auto' }}>
          Account types, transfer limits, taxes, and how REPAIHUB handles it all — in plain English.
        </p>
      </div>

      <div style={S.content}>

        {/* 1. NRI vs NRO vs NRE */}
        <section style={{ marginBottom: '4rem' }}>
          <span style={S.sLabel}>Section 1</span>
          <h2 style={S.h2}>NRI, NRO & NRE — What's the Difference?</h2>
          <p style={S.p}>If you're Indian-origin and living in Canada, you're an NRI (Non-Resident Indian). You likely have one of two types of Indian bank accounts:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(201,150,58,0.2)', border: '1px solid rgba(201,150,58,0.2)', marginBottom: '2rem' }}>
            {[
              { code: 'NRO', full: 'Non-Resident Ordinary', title: 'Holds Indian-source income', desc: 'Salary earned in India, rental income, pension, property sale proceeds. This is the account REPAIHUB moves money FROM.', tags: ['REPAIHUB Handles This', 'India-Source Income'] },
              { code: 'NRE', full: 'Non-Resident External', title: 'Holds foreign-earned income', desc: 'Money you earned abroad and deposited into India. Fully repatriable freely — but most banks support this digitally already.', tags: ['Freely Repatriable'] },
            ].map(acc => (
              <div key={acc.code} style={{ background: '#132233', padding: '2rem', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '2rem', alignItems: 'start', transition: 'background 0.2s' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 700, color: '#E8B86D', lineHeight: 1 }}>{acc.code}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', textAlign: 'center' }}>{acc.full}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>{acc.title}</h3>
                  <p style={{ fontSize: '0.88rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '0.75rem' }}>{acc.desc}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {acc.tags.map(t => (
                      <span key={t} style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.3rem 0.7rem', border: '1px solid #C9963A', color: '#C9963A', background: 'rgba(201,150,58,0.06)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={S.infoBox}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.4rem', display: 'block' }}>REPAIHUB Serves NRO</span>
            <p style={{ fontSize: '0.9rem', color: '#FAF6F0', lineHeight: 1.7, margin: 0 }}>
              We specifically solve NRO outward remittance — the hard one. NRE repatriation is already supported by most banks online. <strong style={{ color: '#E8B86D' }}>NRO is where the gap is.</strong> That's our entire focus.
            </p>
          </div>
        </section>

        {/* 2. Transfer Limits */}
        <section style={{ marginBottom: '4rem' }}>
          <span style={S.sLabel}>Section 2</span>
          <h2 style={S.h2}>How Much Can You Transfer?</h2>
          <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2.5rem 2rem', textAlign: 'center', margin: '1.5rem 0' }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(3rem, 8vw, 5rem)', fontWeight: 700, color: '#E8B86D', lineHeight: 1, marginBottom: '0.5rem', display: 'block' }}>USD 1M</span>
            <div style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>per financial year (April to March)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(201,150,58,0.2)', border: '1px solid rgba(201,150,58,0.2)', textAlign: 'left' }}>
              {[
                { label: 'Annual Limit', value: '~₹8.3 Crore / CAD $1.4M' },
                { label: 'Min Transfer', value: '₹10,000 per transfer' },
                { label: 'FINTRAC Report', value: 'Auto at CAD $10,000+' },
              ].map(item => (
                <div key={item.label} style={{ background: '#0B1C2C', padding: '1.25rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.4rem', display: 'block' }}>{item.label}</span>
                  <span style={{ fontSize: '0.9rem', color: '#FAF6F0', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Form 15CA & 15CB */}
        <section style={{ marginBottom: '4rem' }}>
          <span style={S.sLabel}>Section 3</span>
          <h2 style={S.h2}>What is Form 15CA & 15CB?</h2>
          <p style={S.p}>These are two government forms required every time you transfer money out of your NRO account. Think of them as a receipt telling the Indian government: this money has been properly taxed and it's legal to send abroad.</p>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Form</th><th style={S.th}>What It Is</th><th style={S.th}>Who Files It</th><th style={S.th}>How Long</th></tr></thead>
            <tbody>
              <tr><td style={S.tdGold}>Form 15CA</td><td style={S.td}>Your declaration to the IT department</td><td style={S.td}><strong style={{ color: '#27AE60' }}>REPAIHUB files it automatically</strong></td><td style={S.td}>~30 minutes</td></tr>
              <tr><td style={S.tdGold}>Form 15CB</td><td style={S.td}>CA certificate confirming tax compliance</td><td style={S.td}><strong style={{ color: '#27AE60' }}>Our partner CA signs digitally</strong></td><td style={S.td}>2–4 hours</td></tr>
            </tbody>
          </table>
          <div style={S.infoBox}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.4rem', display: 'block' }}>Good News</span>
            <p style={{ fontSize: '0.9rem', color: '#FAF6F0', lineHeight: 1.7, margin: 0 }}>
              Once our CA has your details on file, future transfers go faster because they already know your situation. <strong style={{ color: '#E8B86D' }}>You never have to deal with these forms yourself.</strong>
            </p>
          </div>
        </section>

        {/* 4. TCS */}
        <section style={{ marginBottom: '4rem' }}>
          <span style={S.sLabel}>Section 4</span>
          <h2 style={S.h2}>What is TCS? Will It Apply to Me?</h2>
          <p style={S.p}>TCS stands for Tax Collected at Source. It's an Indian tax rule — NOT a fee we charge.</p>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Transfer Amount (Annual)</th><th style={S.th}>TCS Rate</th><th style={S.th}>What Happens</th></tr></thead>
            <tbody>
              <tr><td style={S.tdGold}>Below ₹7 lakh/year</td><td style={S.td}>0% — No TCS</td><td style={S.td}>Transfer proceeds normally</td></tr>
              <tr style={{ background: 'rgba(201,150,58,0.04)' }}><td style={S.tdGold}>Above ₹7 lakh/year</td><td style={S.td}>5% TCS collected</td><td style={S.td}>Indian bank collects 5% — <strong style={{ color: '#E8B86D' }}>you get it back in your ITR filing</strong></td></tr>
            </tbody>
          </table>
          <div style={S.infoBox}>
            <p style={{ fontSize: '0.9rem', color: '#FAF6F0', lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: '#E8B86D' }}>TCS is YOUR money.</strong> It's collected as a credit against your Indian tax liability. You claim it back when you file your Indian Income Tax Return. REPAIHUB will show you exactly when TCS applies before you confirm any transfer.
            </p>
          </div>
        </section>

        {/* 5. vs Competitors */}
        <section style={{ marginBottom: '4rem' }}>
          <span style={S.sLabel}>Section 5</span>
          <h2 style={S.h2}>Why Not Remitly or Wise?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1.5rem 0' }}>
            <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem', borderRadius: 4 }}>
              <h4 style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4', marginBottom: '1rem' }}>Others (Remitly, Wise)</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {['Move money INTO India only','No Form 15CA/15CB support','Not built for NRO accounts','No CA partner network'].map(item => (
                  <li key={item} style={{ fontSize: '0.85rem', color: '#FAF6F0', display: 'flex', alignItems: 'flex-start', gap: '0.6rem', lineHeight: 1.5 }}>
                    <span style={{ color: '#E74C3C', flexShrink: 0 }}>✗</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: 'rgba(201,150,58,0.04)', border: '1px solid #C9963A', padding: '1.5rem', borderRadius: 4 }}>
              <h4 style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '1rem' }}>REPAIHUB</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {['Move money OUT of India legally','15CA filed automatically','Built exclusively for NRO accounts','CA network ready for 15CB signing'].map(item => (
                  <li key={item} style={{ fontSize: '0.85rem', color: '#FAF6F0', display: 'flex', alignItems: 'flex-start', gap: '0.6rem', lineHeight: 1.5 }}>
                    <span style={{ color: '#27AE60', flexShrink: 0 }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: '4rem' }}>
          <span style={S.sLabel}>FAQ</span>
          <h2 style={S.h2}>Common Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)' }}>
                <button onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '1.25rem 1.5rem', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: openFAQ === i ? '#E8B86D' : '#FAF6F0', lineHeight: 1.4 }}>{item.q}</span>
                  <span style={{ color: '#C9963A', fontSize: '1.3rem', flexShrink: 0, display: 'inline-block', transform: openFAQ === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
                </button>
                {openFAQ === i && (
                  <div style={{ padding: '0 1.5rem 1.25rem', borderTop: '1px solid rgba(201,150,58,0.1)' }}>
                    <p style={{ fontSize: '0.9rem', color: '#8BA0B4', lineHeight: 1.8, marginTop: '1rem', marginBottom: 0 }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{ background: 'linear-gradient(135deg, #1C3147, #132233)', border: '1px solid rgba(201,150,58,0.2)', padding: '3rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: '#FFFFFF', marginBottom: '0.5rem', position: 'relative', zIndex: 1 }}>Ready to move your money legally?</h2>
          <p style={{ fontSize: '0.9rem', color: '#8BA0B4', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>Join the waitlist or try the demo app now.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
            <Link to="/signup" style={{ background: '#C9963A', color: '#0B1C2C', padding: '0.9rem 2rem', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.2s' }}>
              Get Started
            </Link>
            <Link to="/" style={{ background: 'transparent', border: '1px solid rgba(201,150,58,0.4)', color: '#C9963A', padding: '0.9rem 2rem', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Join Waitlist
            </Link>
          </div>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid rgba(201,150,58,0.2)', padding: '2rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#071420' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 700, color: '#C9963A', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>Repaihub</Link>
          <Link to="/privacy" style={{ fontSize: '0.75rem', color: '#8BA0B4', textDecoration: 'none' }}>Privacy</Link>
          <Link to="/terms" style={{ fontSize: '0.75rem', color: '#8BA0B4', textDecoration: 'none' }}>Terms</Link>
        </div>
        <p style={{ fontSize: '0.72rem', color: '#8BA0B4' }}>© 2026 REPAIHUB Inc. · FINTRAC Registered MSB · Ontario, Canada</p>
      </footer>
    </div>
  )
}
