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

export default function Privacy() {
  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <Link to="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>Repaihub</Link>
        <Link to="/" style={{ fontSize: '0.82rem', color: '#8BA0B4', textDecoration: 'none' }}>← Back to Home</Link>
      </nav>

      <div style={S.wrap}>
        <span style={S.label}>Legal</span>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p style={{ ...S.p, fontSize: '0.82rem', color: '#C9963A' }}>Last updated: April 13, 2026 · REPAIHUB Inc., Ontario, Canada</p>

        <p style={S.p}>
          REPAIHUB Inc. ("REPAIHUB", "we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information in accordance with the Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable Canadian privacy law.
        </p>

        <h2 style={S.h2}>1. Information We Collect</h2>
        <p style={S.p}>We collect only what is necessary to provide the REPAIHUB remittance service:</p>
        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          {[
            'Full legal name and email address (for account creation)',
            'Canadian bank account details (institution, transit, account number) — stored as cryptographic hashes only, never in plain text',
            'Indian NRO account details — cryptographic verification token only; we never store your actual account number',
            'PAN (Permanent Account Number) — stored as SHA-256 hash only',
            'Residency status (Canadian Citizen, PR, OCI, Work Permit)',
            'Transfer amounts, purposes, and dates',
            'Device and session information for fraud prevention',
          ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
        </ul>
        <p style={{ ...S.p, color: '#E8B86D', fontWeight: 500 }}>
          We never store passport images, Aadhaar numbers, bank statements, or any physical identity documents on our servers. Ever.
        </p>

        <h2 style={S.h2}>2. How We Use Your Information</h2>
        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          {[
            'To process and complete your NRO remittance transfers',
            'To file Form 15CA with the Indian Income Tax portal on your behalf',
            'To coordinate Form 15CB certification with our CA partner network',
            'To comply with FINTRAC reporting obligations as a registered MSB',
            'To detect and prevent fraud and money laundering',
            'To send transfer status notifications and service updates',
            'To provide annual transaction summaries for your tax filing',
          ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
        </ul>

        <h2 style={S.h2}>3. FINTRAC Compliance</h2>
        <p style={S.p}>
          As a FINTRAC-registered Money Services Business, REPAIHUB is required by the Proceeds of Crime (Money Laundering) and Terrorist Financing Act to collect and verify client identification information, report certain transactions, and maintain records for a minimum of 5 years. These obligations override standard privacy protections where required by law.
        </p>

        <h2 style={S.h2}>4. Data Sharing</h2>
        <p style={S.p}>We do not sell your personal information. We share data only with:</p>
        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          {[
            'Our banking infrastructure partners (Setu / Razorpay) — to execute the debit instruction on your NRO account',
            'Our CA partner network — only Form 15CB-related information required for certification',
            'Indian Income Tax portal — Form 15CA filing only',
            'FINTRAC — as required by Canadian law',
            'Canadian correspondent bank — for the CAD credit to your account',
          ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
        </ul>

        <h2 style={S.h2}>5. Data Security</h2>
        <p style={S.p}>
          We employ bank-grade encryption (AES-256) for data at rest and TLS 1.3 for data in transit. Account numbers and PAN are stored only as SHA-256 hashes — they cannot be reversed. Our infrastructure is hosted in Canada-region data centres compliant with ISO 27001.
        </p>

        <h2 style={S.h2}>6. Your Rights Under PIPEDA</h2>
        <p style={S.p}>You have the right to: access your personal information, correct inaccuracies, withdraw consent (subject to legal retention obligations), and request deletion of your data. Contact us at <a href="mailto:founder@repaihub.com" style={{ color: '#C9963A' }}>founder@repaihub.com</a> to exercise any of these rights.</p>

        <h2 style={S.h2}>7. Data Retention</h2>
        <p style={S.p}>Transfer records and compliance documentation are retained for a minimum of 5 years as required by FINTRAC. Account information is retained for the duration of your relationship with REPAIHUB and for up to 7 years after account closure for regulatory purposes.</p>

        <h2 style={S.h2}>8. Contact</h2>
        <p style={S.p}>Privacy Officer: <a href="mailto:founder@repaihub.com" style={{ color: '#C9963A' }}>founder@repaihub.com</a> &nbsp;·&nbsp; REPAIHUB Inc., Toronto, Ontario, Canada</p>

        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(201,150,58,0.2)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Link to="/terms" style={{ fontSize: '0.85rem', color: '#8BA0B4', textDecoration: 'none' }}>Terms of Service →</Link>
          <Link to="/" style={{ fontSize: '0.85rem', color: '#8BA0B4', textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
