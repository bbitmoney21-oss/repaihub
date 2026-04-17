import { Link } from 'react-router-dom'

const S = {
  page: { background: '#0B1C2C', color: '#FAF6F0', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" },
  nav: { position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 3rem', background: 'rgba(11,28,44,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(201,150,58,0.2)' },
  wrap: { maxWidth: 760, margin: '0 auto', padding: '8rem 2rem 5rem' },
  h1: { fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' },
  h2: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#E8B86D', marginTop: '2.5rem', marginBottom: '0.75rem' },
  p: { color: '#8BA0B4', lineHeight: 1.8, fontSize: '0.95rem', marginBottom: '1rem' },
  li: { color: '#8BA0B4', lineHeight: 1.8, fontSize: '0.95rem', marginBottom: '0.4rem' },
  label: { fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: '#C9963A', display: 'block', marginBottom: '1rem' },
}

export default function Terms() {
  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link to="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>Repaihub</Link>
        <Link to="/" style={{ fontSize: '0.82rem', color: '#8BA0B4', textDecoration: 'none' }}>← Back to Home</Link>
      </nav>

      <div style={S.wrap}>
        <span style={S.label}>Legal</span>
        <h1 style={S.h1}>Terms of Service</h1>
        <p style={{ ...S.p, fontSize: '0.82rem', color: '#C9963A' }}>Last updated: April 13, 2026 · REPAIHUB Inc., Ontario, Canada</p>

        <p style={S.p}>
          By creating an account or using the REPAIHUB platform, you agree to these Terms of Service. Please read them carefully. If you do not agree, do not use REPAIHUB.
        </p>

        <h2 style={S.h2}>1. About REPAIHUB</h2>
        <p style={S.p}>
          REPAIHUB Inc. is a Money Services Business (MSB) registered with the Financial Transactions and Reports Analysis Centre of Canada (FINTRAC). REPAIHUB provides a technology platform that facilitates the legal transfer of funds from NRO (Non-Resident Ordinary) bank accounts in India to overseas bank accounts, in compliance with FEMA (Foreign Exchange Management Act) and RBI guidelines.
        </p>
        <p style={{ ...S.p, fontWeight: 500, color: '#FAF6F0' }}>
          REPAIHUB is not a bank. We are a technology intermediary. Your funds are held and processed by our licensed banking partners (Setu / Razorpay and their correspondent banks), not by REPAIHUB directly.
        </p>

        <h2 style={S.h2}>2. Eligibility</h2>
        <p style={S.p}>You must be:</p>
        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          {[
            'At least 18 years of age',
            'A Canadian Citizen, Permanent Resident, OCI card holder, or valid Work Permit holder',
            'The legitimate owner of the NRO account from which funds are being transferred',
            'In compliance with all applicable Canadian and Indian laws regarding foreign exchange',
          ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
        </ul>

        <h2 style={S.h2}>3. Pass-Through Model</h2>
        <p style={S.p}>
          REPAIHUB operates on a pass-through model. This means: our banking partner (Setu or Razorpay) receives the INR from your NRO account, performs the currency conversion, and sends the CAD to your designated Canadian bank account. REPAIHUB never takes custody of your funds. Our fee is deducted by the banking partner before the CAD is disbursed.
        </p>

        <h2 style={S.h2}>4. FX Rates and Fees</h2>
        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          {[
            'The FX rate is locked at the time you confirm a transfer. Market movements after confirmation do not affect your transfer.',
            'Flat fees range from CAD $8 to CAD $15 depending on transfer size. Express upgrades cost an additional CAD $15.',
            'Our FX spread is 0.6–0.8% below mid-market rate. The exact rate is displayed before you confirm.',
            'TCS (Tax Collected at Source) at 5% applies to transfers above ₹7,00,000 under Indian tax law. This is an Indian government requirement, not an REPAIHUB fee.',
          ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
        </ul>

        <h2 style={S.h2}>5. Compliance Obligations</h2>
        <p style={S.p}>
          You represent that all funds being transferred are legally yours, have been appropriately taxed in India (TDS deducted where applicable), and you are entitled to remit them under RBI's USD 1 million annual limit for NRO accounts. You agree to provide accurate information for Form 15CA filing. Providing false information is a violation of Indian law (Section 276C of the Income Tax Act) and these Terms.
        </p>

        <h2 style={S.h2}>6. Prohibited Uses</h2>
        <p style={S.p}>You may not use REPAIHUB to:</p>
        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          {[
            'Transfer funds on behalf of another person without their explicit, documented consent',
            'Circumvent Indian tax obligations or FEMA limits',
            'Launder money or fund illegal activities',
            'Transfer funds exceeding the RBI annual limit of USD 1 million per financial year',
            "Use another person's NRO account without legal authority",
          ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
        </ul>

        <h2 style={S.h2}>7. Limitation of Liability</h2>
        <p style={S.p}>
          REPAIHUB's liability is limited to the fees paid for the specific transfer in question. We are not liable for delays caused by Indian banks, SWIFT network issues, correspondent banking delays, or regulatory reviews beyond our control. We are not a tax advisor; annual ITR and Canadian T1 filing remain your responsibility.
        </p>

        <h2 style={S.h2}>8. Governing Law</h2>
        <p style={S.p}>
          These Terms are governed by the laws of the Province of Ontario and the laws of Canada applicable therein. Any disputes shall be resolved in the courts of Ontario.
        </p>

        <h2 style={S.h2}>9. Contact</h2>
        <p style={S.p}>Legal inquiries: <a href="mailto:founder@repaihub.com" style={{ color: '#C9963A' }}>founder@repaihub.com</a> &nbsp;·&nbsp; REPAIHUB Inc., Toronto, Ontario, Canada</p>

        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(201,150,58,0.2)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Link to="/privacy" style={{ fontSize: '0.85rem', color: '#8BA0B4', textDecoration: 'none' }}>Privacy Policy →</Link>
          <Link to="/" style={{ fontSize: '0.85rem', color: '#8BA0B4', textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
