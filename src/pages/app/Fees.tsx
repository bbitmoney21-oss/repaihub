import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGetFeeTiers } from '../../lib/api'
import type { FeeTiersResponse } from '../../lib/api'
import { formatCAD } from '../../lib/utils'

/**
 * Public Fees & Rates page — shows the live commission tier table so customers
 * can compare REPAIHUB to the alternatives BEFORE starting a transfer.  This is
 * the bundled-value pitch surface: "you're paying 1.0–2.0% but you're getting
 * 15CA filed + 15CB CA-certified + TDS check + FEMA, all in one app."
 *
 * Data is read from /fees/tiers (which reads outward_fee_tiers in Supabase),
 * so admins changing the slab table immediately update what customers see —
 * no deploy required.
 */
export default function Fees() {
  const nav = useNavigate()
  const [data, setData] = useState<FeeTiersResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGetFeeTiers().then(setData).catch(e => setError((e as Error).message))
  }, [])

  const C = {
    bg:       '#0B1C2C',
    card:     '#132233',
    border:   'rgba(201,150,58,0.2)',
    accent:   '#C9963A',
    accentLt: '#E8B86D',
    text:     '#FAF6F0',
    muted:    '#8BA0B4',
    success:  '#27AE60',
    subtle:   'rgba(201,150,58,0.06)',
  }

  function formatSlab(slabMinInr: number, slabMaxInr: number | null): string {
    const fmt = (n: number) =>
      n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString('en-IN')}`
    if (slabMinInr === 0) return `Up to ${fmt(slabMaxInr ?? 0)}`
    if (slabMaxInr === null) return `${fmt(slabMinInr)}+`
    return `${fmt(slabMinInr)} – ${fmt(slabMaxInr)}`
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.4rem' }}>
          Fees &amp; Rates
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 600, color: C.text, margin: 0, lineHeight: 1.15 }}>
          Transparent pricing
        </h1>
        <p style={{ fontSize: '0.88rem', color: C.muted, marginTop: '0.5rem', maxWidth: 640, lineHeight: 1.55 }}>
          Every REPAIHUB transfer is bundled with full RBI compliance:
          Form 145 (formerly 15CA) filed for you, a CA certificate (Form 146, formerly 15CB) from our
          partner CA when your tax-year total is above ₹5 lakh, a TDS check before anything moves, and FEMA reporting —
          all inside one app.  No paperwork, no branch visits, no manual
          back-and-forth.
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.4)', padding: '0.85rem 1rem', color: '#E74C3C', fontSize: '0.85rem' }}>
          Couldn&apos;t load live fee tiers: {error}.  The rates below may be slightly outdated.
        </div>
      )}

      {/* Outward tiers */}
      <section>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.6rem' }}>
          ↗ Outward · India → Canada (NRO repatriation)
        </div>
        <div style={{ border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ background: C.subtle, padding: '0.7rem 1rem', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted }}>
            <span>Amount</span>
            <span>Standard · 5 days</span>
            <span>Express · 3 days</span>
          </div>
          {(data?.tiers ?? []).map(t => (
            <div key={`${t.slabMinInr}`} style={{ background: C.card, padding: '0.85rem 1rem', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', borderTop: `1px solid ${C.border}`, fontSize: '0.88rem' }}>
              <span style={{ color: C.text, fontWeight: 600 }}>{t.label}</span>
              <span style={{ color: C.accentLt, fontWeight: 600, fontFamily: "'DM Sans'" }}>{formatCAD(t.flatFeeCAD)} + {(t.commissionRate * 100).toFixed(2)}%</span>
              <span style={{ color: C.text, fontWeight: 500, fontFamily: "'DM Sans'" }}>{formatCAD(t.expressFlatFeeCAD ?? t.flatFeeCAD)} + {((t.expressCommissionRate ?? t.commissionRate) * 100).toFixed(2)}%</span>
            </div>
          ))}
          {(data?.tiers?.length ?? 0) === 0 && !error && (
            <div style={{ background: C.card, padding: '1rem', color: C.muted, fontSize: '0.85rem', textAlign: 'center' }}>
              Loading rates…
            </div>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '0.5rem', lineHeight: 1.5 }}>
          Each percentage applies only to the part of your amount inside that band, like tax brackets, so there is no jump at ₹5 lakh or ₹25 lakh. You pay the base fee of the band your amount falls in. Example: ₹2 lakh standard ≈ CAD 43 in total. You always see the exact fee before you confirm. Tax on your Indian income (TDS) is settled before repatriation; our partner CA confirms it.
        </div>
      </section>

      {/* Inward */}
      <section>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.6rem' }}>
          ↙ Inward · Canada → India
        </div>
        <div style={{ border: `1px solid ${C.border}`, background: C.card, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: C.text, fontWeight: 600, fontSize: '0.9rem' }}>Below {data ? formatCAD(data.inward.freeAboveCAD) : 'CAD 500'}</span>
            <span style={{ color: C.accentLt, fontWeight: 600, fontFamily: "'DM Sans'" }}>
              {data ? formatCAD(data.inward.smallTransferFeeCAD) : 'CAD 1.99'} small-transfer fee
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: C.text, fontWeight: 600, fontSize: '0.9rem' }}>{data ? formatCAD(data.inward.freeAboveCAD) : 'CAD 500'} and above</span>
            <span style={{ color: C.success, fontWeight: 700 }}>No fee</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '0.25rem', lineHeight: 1.5 }}>
            We earn from the FX spread on inward transfers — no commission, no express surcharge.  The {data ? formatCAD(data.inward.smallTransferFeeCAD) : 'CAD 1.99'} small-transfer fee covers fixed processing costs on small amounts and is charged on top of the amount you send.
          </div>
        </div>
      </section>

      {/* Bundled value */}
      <section style={{ background: C.subtle, border: `1px solid ${C.border}`, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.5rem' }}>
          What&apos;s included
        </div>
        <ul style={{ paddingLeft: '1.2rem', margin: 0, color: C.text, fontSize: '0.88rem', lineHeight: 1.7 }}>
          <li>Form 145 (formerly 15CA) filed for you with the Income-tax Department</li>
          <li>Form 146 (formerly 15CB) certified by our partner CA above ₹5 lakh — no separate appointment</li>
          <li>TDS position checked by our partner CA</li>
          <li>FEMA / FINTRAC compliance reporting</li>
          <li>End-to-end status tracking with progress dots</li>
          <li>Partner bank's rate shown and locked when you confirm</li>
        </ul>
      </section>

      {/* CTA */}
      <button
        onClick={() => nav('/app/new-transfer')}
        style={{
          background: C.accent,
          color: C.bg,
          border: 'none',
          padding: '0.95rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          minHeight: 48,
        }}>
        Start a transfer →
      </button>
    </div>
  )
}
