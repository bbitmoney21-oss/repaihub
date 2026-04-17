import { useStore } from '../../store/useStore'
import { formatCAD } from '../../lib/utils'
import { ShieldCheck, FileText, Info } from 'lucide-react'

export default function Compliance() {
  const { user, transfers } = useStore()
  const usedCAD = user?.annualLimitUsed || 0
  const totalCAD = user?.annualLimitTotal || 83000
  const limitPct  = (usedCAD / totalCAD) * 100

  const S = {
    page: { padding: '2rem', maxWidth: 900, margin: '0 auto' },
    sLabel: { fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#C9963A', display: 'block', marginBottom: '0.5rem' },
    card: { background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem', marginBottom: '1.5rem' },
    h3: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.75rem' },
    p: { fontSize: '0.88rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '1rem' },
  }

  const fintracTransfers = transfers.filter(t => t.amountCAD >= 10000)
  const totalINR = transfers.filter(t => t.status === 'COMPLETED').reduce((a,t) => a + t.amountINR, 0)
  const tcsApplied = totalINR > 700000

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '2rem' }}>
        <span style={S.sLabel}>Compliance & Regulations</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>
          Compliance Centre
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#8BA0B4' }}>Your compliance dashboard — everything transparent, plain English.</p>
      </div>

      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '1px', background: 'rgba(201,150,58,0.2)', border: '1px solid rgba(201,150,58,0.2)', marginBottom: '2rem' }}>
        {[
          { icon: '🍁', label: 'FINTRAC Status', value: 'Registered MSB', color: '#27AE60' },
          { icon: '🇮🇳', label: 'RBI / FEMA', value: 'Compliant', color: '#27AE60' },
          { icon: '🔒', label: 'PIPEDA', value: 'Protected', color: '#27AE60' },
          { icon: '📋', label: '15CA Filed', value: `${transfers.length} forms`, color: '#C9963A' },
          { icon: '📝', label: '15CB Certified', value: `${transfers.filter(t => ['15CB_CERTIFIED','BANK_PROCESSING','SWIFT_SENT','COMPLETED'].includes(t.status)).length} certs`, color: '#C9963A' },
          { icon: '⚡', label: 'FINTRAC Reports', value: `${fintracTransfers.length} filed`, color: '#3498DB' },
        ].map(c => (
          <div key={c.label} style={{ background: '#132233', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{c.icon}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4', marginBottom: '0.3rem' }}>{c.label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Annual limit */}
      <div style={S.card}>
        <span style={S.sLabel}>RBI Annual Limit — FY 2026</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ ...S.h3, marginBottom: '0.25rem' }}>USD 1 Million Annual Cap</h3>
            <p style={{ ...S.p, marginBottom: 0 }}>Per RBI under FEMA rules. Resets every April 1 (Indian financial year).</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#E8B86D', fontFamily: "'DM Sans'" }}>{formatCAD(usedCAD)}</div>
            <div style={{ fontSize: '0.8rem', color: '#8BA0B4' }}>of {formatCAD(totalCAD)} used</div>
          </div>
        </div>
        <div style={{ height: 12, background: '#0B1C2C', borderRadius: 6, overflow: 'hidden', marginBottom: '0.5rem' }}>
          <div style={{ height: '100%', width: `${limitPct}%`, background: limitPct > 80 ? '#F39C12' : '#C9963A', borderRadius: 6, transition: 'width 1s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8BA0B4' }}>
          <span>₹0</span>
          <span style={{ color: limitPct > 80 ? '#F39C12' : '#27AE60', fontWeight: 600 }}>{limitPct.toFixed(1)}% used · {formatCAD(totalCAD - usedCAD)} remaining</span>
          <span>~CAD {formatCAD(totalCAD)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '1.5rem' }}>

        {/* Form 15CA/15CB explained */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <FileText color="#C9963A" size={20} />
            <h3 style={{ ...S.h3, marginBottom: 0 }}>Form 15CA & 15CB</h3>
          </div>
          <p style={S.p}>Required for every NRO outward transfer. These tell the Indian government the money has been legally taxed.</p>
          <div style={{ background: '#0B1C2C', padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.5rem' }}>Form 15CA</div>
            <p style={{ ...S.p, marginBottom: 0, fontSize: '0.82rem' }}>Your declaration to the IT department. <strong style={{ color: '#27AE60' }}>REPAIHUB files this automatically</strong> — you never have to touch it.</p>
          </div>
          <div style={{ background: '#0B1C2C', padding: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.5rem' }}>Form 15CB</div>
            <p style={{ ...S.p, marginBottom: 0, fontSize: '0.82rem' }}>CA certificate confirming tax compliance. <strong style={{ color: '#27AE60' }}>Our partner CA signs digitally</strong> — typically within 2–4 hours.</p>
          </div>
        </div>

        {/* TCS */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Info color="#C9963A" size={20} />
            <h3 style={{ ...S.h3, marginBottom: 0 }}>TCS — Tax Collected at Source</h3>
          </div>
          <p style={S.p}>An Indian tax rule — not a REPAIHUB fee. Applies above ₹7 lakh/year.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { range: 'Below ₹7 lakh/year', rate: '0%', note: 'No TCS', color: '#27AE60' },
              { range: 'Above ₹7 lakh/year', rate: '5% TCS', note: 'Reclaim in ITR', color: '#F39C12' },
            ].map(row => (
              <div key={row.range} style={{ background: '#0B1C2C', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#FAF6F0', fontWeight: 500 }}>{row.range}</div>
                  <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>{row.note}</div>
                </div>
                <span style={{ color: row.color, fontWeight: 700, fontSize: '1rem', fontFamily: "'DM Sans'" }}>{row.rate}</span>
              </div>
            ))}
          </div>
          {tcsApplied && (
            <div style={{ background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.3)', padding: '0.75rem', fontSize: '0.82rem', color: '#FAF6F0', lineHeight: 1.6 }}>
              ⚠️ Your transfers this year exceed ₹7 lakh. TCS may apply. <strong style={{ color: '#E8B86D' }}>This money is yours — claim it in your Indian ITR filing.</strong>
            </div>
          )}
        </div>

        {/* FINTRAC */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <ShieldCheck color="#C9963A" size={20} />
            <h3 style={{ ...S.h3, marginBottom: 0 }}>FINTRAC Reporting</h3>
          </div>
          <p style={S.p}>REPAIHUB is a registered Money Services Business (MSB) under FINTRAC. We automatically report large transactions as required by law.</p>
          <div style={{ background: '#0B1C2C', padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.5rem' }}>Automatic Reports</div>
            {[
              ['Large Cash Transaction', 'CAD $10,000+', '#3498DB'],
              ['Suspicious Transaction', 'If flagged', '#E74C3C'],
              ['International EFT', 'CAD $10,000+', '#3498DB'],
            ].map(([type, threshold, color]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#FAF6F0' }}>{type}</span>
                <span style={{ color: color as string, fontWeight: 500 }}>{threshold}</span>
              </div>
            ))}
          </div>
          <p style={{ ...S.p, marginBottom: 0, fontSize: '0.8rem' }}>
            Being reported is <strong style={{ color: '#FAF6F0' }}>normal and legal</strong>. It means your transfer is in the system, protected, and legitimate. We'll always notify you when a report is filed.
          </p>
        </div>

        {/* Zero Storage KYC */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <ShieldCheck color="#C9963A" size={20} />
            <h3 style={{ ...S.h3, marginBottom: 0 }}>Zero Document Storage</h3>
          </div>
          <p style={S.p}>Unlike banks, we never store document images, scan copies, or sensitive personal data. Your identity is verified via cryptographic tokens only.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              ['Canadian KYC', 'Flinks OAuth token + account hash only'],
              ['Indian KYC', 'DigiLocker verification token only'],
              ['PAN Card', 'Never stored — hashed and discarded'],
              ['Aadhaar', 'Never requested — ever'],
              ['Bank Statements', 'Never accessed or stored'],
            ].map(([what, how]) => (
              <div key={what} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.82rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(201,150,58,0.1)' }}>
                <span style={{ color: '#FAF6F0', fontWeight: 500 }}>{what}</span>
                <span style={{ color: '#8BA0B4', textAlign: 'right', flex: 1 }}>{how}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PIPEDA notice */}
      <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.2)', padding: '1.25rem 1.5rem', marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3498DB', display: 'block', marginBottom: '0.4rem' }}>PIPEDA Data Protection</span>
        <p style={{ fontSize: '0.85rem', color: '#8BA0B4', lineHeight: 1.7, margin: 0 }}>
          Under Canada's Personal Information Protection and Electronic Documents Act (PIPEDA), you have the right to access, correct, and request deletion of your personal data at any time. Contact <strong style={{ color: '#FAF6F0' }}>founder@repaihub.com</strong> to exercise these rights.
        </p>
      </div>
    </div>
  )
}
