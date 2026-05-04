import { useState, useEffect, useMemo } from 'react'
import { X, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Form 15CA Part A — self-declaration popup for sub-₹5L outward transfers.
 *
 * Indian IT Act 2025 (and earlier rules) require Form 15CA Part A when an
 * outward remittance is up to ₹5L in a financial year and is or may be
 * chargeable to tax in India.  No Chartered Accountant certification (Form
 * 15CB) is required at this band — the customer self-declares via Part A
 * online with the IT department, and the remittance can proceed immediately.
 *
 * This modal collects the minimum legally-required fields the customer must
 * confirm BEFORE we file 15CA on their behalf and push the transfer to the
 * bank.  Everything else is pre-filled from profile + transfer state.
 *
 * STARTER FIELD SET — extend when official 15CA Part A sample is provided:
 *   - Customer-fill: Father's name, Indian address, chargeable-to-tax Y/N,
 *     TDS Y/N + amount (if Y), declaration checkbox.
 *   - Pre-filled / locked: name, PAN, email, phone, recipient bank, country,
 *     amount, currency, purpose, aggregate FY remittance.
 */

export interface Form15CAPartAData {
  // Remitter (pre-filled, customer reviews + confirms PAN)
  remitterName:         string
  remitterPAN:          string
  remitterFatherName:   string         // CUSTOMER FILLS
  remitterAddressIndia: string         // CUSTOMER FILLS
  remitterEmail:        string
  remitterPhone:        string

  // Beneficiary
  beneficiaryName:      string
  beneficiaryCountry:   'CA'           // locked

  // Transaction (pre-filled)
  amountInr:            number
  amountCad:            number
  exchangeRate:         number
  purposeCode:          string
  remittanceDate:       string         // ISO

  // Tax — customer answers
  isChargeableToTax:    boolean        // CUSTOMER FILLS (default false for NRO repatriation)
  tdsDeducted:          boolean        // CUSTOMER FILLS
  tdsAmountInr:         number         // CUSTOMER FILLS (only if tdsDeducted)

  // Aggregate FY remittance (auto-computed, customer reviews)
  aggregateFyRemittanceInr: number

  // Declaration
  declared:             boolean        // CUSTOMER FILLS (must be true)
}

interface Props {
  open:                 boolean
  amountInr:            number
  amountCad:            number
  exchangeRate:         number
  purposeCode:          string
  // Pre-fill seeds from app state
  remitterName:         string
  remitterPAN:          string | null
  remitterEmail:        string
  remitterPhone:        string
  beneficiaryName:      string
  // Aggregate FY remittance — caller computes from transfer history
  aggregateFyRemittanceInr: number

  onSubmit: (data: Form15CAPartAData) => void
  onCancel: () => void
}

const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/

export default function Form15CAPartAModal({
  open, amountInr, amountCad, exchangeRate, purposeCode,
  remitterName, remitterPAN, remitterEmail, remitterPhone,
  beneficiaryName, aggregateFyRemittanceInr,
  onSubmit, onCancel,
}: Props) {
  const [pan, setPAN]                       = useState(remitterPAN ?? '')
  const [fatherName, setFatherName]         = useState('')
  const [indianAddress, setIndianAddress]   = useState('')
  const [chargeableToTax, setChargeable]    = useState(false)
  const [tdsDeducted, setTdsDeducted]       = useState(false)
  const [tdsAmountStr, setTdsAmountStr]     = useState('')
  const [declared, setDeclared]             = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => { if (open) { setError(null) } }, [open])

  const aggregateAfter = useMemo(
    () => aggregateFyRemittanceInr + amountInr,
    [aggregateFyRemittanceInr, amountInr],
  )
  const exceedsPartABand = aggregateAfter > 500_000

  if (!open) return null

  function validateAndSubmit() {
    setError(null)

    const panClean = pan.trim().toUpperCase()
    if (!PAN_REGEX.test(panClean)) {
      setError('PAN must match the format AAAAA9999A (5 letters, 4 digits, 1 letter).')
      return
    }
    if (!fatherName.trim()) {
      setError('Father’s name is required by the IT department for Form 15CA.')
      return
    }
    if (!indianAddress.trim() || indianAddress.trim().length < 10) {
      setError('Please enter your full Indian address (this is your registered NRO address).')
      return
    }
    if (tdsDeducted) {
      const amt = Number(tdsAmountStr)
      if (!Number.isFinite(amt) || amt <= 0) {
        setError('TDS amount must be a positive number when TDS is deducted.')
        return
      }
    }
    if (!declared) {
      setError('You must tick the declaration box to file Form 15CA Part A.')
      return
    }
    if (exceedsPartABand) {
      setError(
        `This transfer would push your FY total above ₹5,00,000. Form 15CA Part C and Form 15CB (CA-certified) ` +
        `are required at that level. Please go back and reduce the amount, or proceed without Part A.`,
      )
      return
    }

    onSubmit({
      remitterName,
      remitterPAN:           panClean,
      remitterFatherName:    fatherName.trim(),
      remitterAddressIndia:  indianAddress.trim(),
      remitterEmail,
      remitterPhone,
      beneficiaryName,
      beneficiaryCountry:    'CA',
      amountInr,
      amountCad,
      exchangeRate,
      purposeCode,
      remittanceDate:        new Date().toISOString(),
      isChargeableToTax:     chargeableToTax,
      tdsDeducted,
      tdsAmountInr:          tdsDeducted ? Number(tdsAmountStr) : 0,
      aggregateFyRemittanceInr,
      declared:              true,
    })
  }

  // Styles — consistent with the rest of the app
  const C = {
    overlay: 'rgba(8, 16, 26, 0.7)',
    bg:      '#0B1C2C',
    card:    '#132233',
    border:  'rgba(201,150,58,0.22)',
    accent:  '#C9963A',
    text:    '#FAF6F0',
    muted:   '#8BA0B4',
    danger:  '#E74C3C',
    success: '#27AE60',
  }
  const Field = ({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: C.accent }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.1rem' }}>{hint}</span>}
    </label>
  )
  const inputStyle: React.CSSProperties = {
    background: C.bg, border: `1px solid ${C.border}`, color: C.text,
    padding: '0.65rem 0.75rem', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
    minHeight: 40,
  }
  const lockedStyle: React.CSSProperties = { ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }
  const radioGroupStyle: React.CSSProperties = { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }
  const radioBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    minWidth: 80,
    padding: '0.5rem 0.75rem',
    background: active ? 'rgba(201,150,58,0.15)' : C.bg,
    border: `1px solid ${active ? C.accent : C.border}`,
    color: active ? C.accent : C.text,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Form 15CA Part A self-declaration"
      style={{
        position: 'fixed', inset: 0, background: C.overlay, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, color: C.text,
        width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '1.1rem 1.25rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.3rem' }}>
              Form 15CA · Part A
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, margin: 0, lineHeight: 1.15 }}>
              Self-declaration
            </h2>
            <p style={{ fontSize: '0.82rem', color: C.muted, margin: '0.4rem 0 0 0', lineHeight: 1.45 }}>
              Required for outward remittance up to ₹5,00,000 per financial year.
              No CA certification needed. Submit and we file with the IT department immediately.
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Section 1 — Remitter (pre-filled, PAN editable for typo correction) */}
          <SectionLabel>Your details</SectionLabel>
          <Field label="Full name">
            <input value={remitterName} disabled style={lockedStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="PAN" required hint="Edit if the pre-filled value is incorrect">
              <input value={pan} maxLength={10}
                onChange={e => setPAN(e.target.value.toUpperCase())}
                placeholder="AAAAA9999A"
                style={{ ...inputStyle, fontFamily: "'DM Sans', monospace", letterSpacing: '0.05em' }} />
            </Field>
            <Field label="Father's name" required>
              <input value={fatherName}
                onChange={e => setFatherName(e.target.value)}
                placeholder="As per PAN records"
                style={inputStyle} />
            </Field>
          </div>
          <Field label="Address in India" required hint="Your NRO-account registered address">
            <textarea value={indianAddress}
              onChange={e => setIndianAddress(e.target.value)}
              placeholder="House / Street, City, State, PIN"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Email">
              <input value={remitterEmail} disabled style={lockedStyle} />
            </Field>
            <Field label="Phone">
              <input value={remitterPhone} disabled style={lockedStyle} />
            </Field>
          </div>

          {/* Section 2 — Transfer */}
          <SectionLabel>This transfer</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Amount (INR)">
              <input value={`₹${amountInr.toLocaleString('en-IN')}`} disabled style={lockedStyle} />
            </Field>
            <Field label="Amount (CAD)">
              <input value={`CAD ${amountCad.toFixed(2)}`} disabled style={lockedStyle} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Purpose code">
              <input value={purposeCode} disabled style={lockedStyle} />
            </Field>
            <Field label="FY total after this transfer">
              <input value={`₹${aggregateAfter.toLocaleString('en-IN')}`} disabled
                style={{ ...lockedStyle, color: exceedsPartABand ? C.danger : C.text }} />
            </Field>
          </div>
          {exceedsPartABand && (
            <div style={{ background: 'rgba(231,76,60,0.08)', border: `1px solid ${C.danger}`, padding: '0.65rem 0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} color={C.danger} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.45 }}>
                This transfer pushes your FY total above ₹5,00,000.  Form 15CA Part C and CA-certified Form 15CB are required at that level.  Reduce the amount or use the standard CA-routed flow.
              </div>
            </div>
          )}

          {/* Section 3 — Tax */}
          <SectionLabel>Tax declaration</SectionLabel>
          <Field label="Is this remittance chargeable to tax in India?" required hint="Most NRO-savings repatriations are NOT taxable (already-taxed funds). Pick 'No' if unsure.">
            <div style={radioGroupStyle}>
              <button type="button" onClick={() => setChargeable(false)} style={radioBtn(!chargeableToTax)}>No</button>
              <button type="button" onClick={() => setChargeable(true)}  style={radioBtn(chargeableToTax)}>Yes</button>
            </div>
          </Field>
          <Field label="Has TDS already been deducted at source?" required>
            <div style={radioGroupStyle}>
              <button type="button" onClick={() => setTdsDeducted(false)} style={radioBtn(!tdsDeducted)}>No</button>
              <button type="button" onClick={() => setTdsDeducted(true)}  style={radioBtn(tdsDeducted)}>Yes</button>
            </div>
          </Field>
          {tdsDeducted && (
            <Field label="TDS amount (INR)" required>
              <input value={tdsAmountStr}
                onChange={e => setTdsAmountStr(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                inputMode="decimal"
                style={{ ...inputStyle, fontFamily: "'DM Sans'" }} />
            </Field>
          )}

          {/* Section 4 — Declaration */}
          <SectionLabel>Declaration</SectionLabel>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: 'rgba(201,150,58,0.06)', padding: '0.85rem', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
            <input type="checkbox" checked={declared}
              onChange={e => setDeclared(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: C.accent, flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', color: C.text, lineHeight: 1.5 }}>
              I declare that the information provided is true and correct to the best of my knowledge,
              that the funds being remitted are from my NRO account on which applicable Indian taxes have been paid,
              and that my aggregate outward remittances during the current financial year do not exceed ₹5,00,000.
            </span>
          </label>

          {error && (
            <div style={{ background: 'rgba(231,76,60,0.1)', border: `1px solid ${C.danger}`, padding: '0.65rem 0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} color={C.danger} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: '0.82rem', color: C.text }}>{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.25rem', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '0.6rem', flexDirection: 'column' }}>
          <button onClick={validateAndSubmit}
            disabled={exceedsPartABand}
            style={{
              width: '100%', minHeight: 48,
              background: exceedsPartABand ? 'rgba(201,150,58,0.3)' : C.accent,
              color: C.bg, border: 'none', padding: '0.95rem',
              fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              cursor: exceedsPartABand ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}>
            <CheckCircle2 size={16} /> File 15CA &amp; send transfer
          </button>
          <button onClick={onCancel}
            style={{
              width: '100%', minHeight: 40,
              background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
              padding: '0.6rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}>
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em',
      textTransform: 'uppercase', color: '#C9963A',
      borderBottom: '1px solid rgba(201,150,58,0.15)',
      paddingBottom: '0.35rem',
    }}>
      {children}
    </div>
  )
}
