import { useState, useEffect, useMemo } from 'react'
import { X, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FileSignature } from 'lucide-react'

/**
 * Form 15CA Part A — self-declaration popup for sub-₹5L outward transfers.
 *
 * UX goal (Winman-style): the customer should do the absolute minimum.
 * Everything we already know is auto-filled and shown read-only in a
 * collapsed summary.  Only the mandatory fields the IT department forces
 * the customer to confirm are shown as editable inputs, each marked with
 * a red * and validated before submit.  A typed digital signature (must
 * match the registered name) acts as electronic signature under IT Act
 * 2000 § 3A.
 *
 * Reusable answers — Father's name and Indian address — are cached in
 * localStorage so a second transfer pre-fills them automatically.  When
 * migration 026 lands these will move to the profile.
 *
 * STARTER FIELD SET — extend when official 15CA Part A sample is provided.
 */

const LS_KEY = 'rh_form15ca_partA_v1'
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/

export interface Form15CAPartAData {
  // Remitter (mostly pre-filled, customer confirms PAN typo)
  remitterName:         string
  remitterPAN:          string
  remitterFatherName:   string         // CUSTOMER FILLS — cached
  remitterAddressIndia: string         // CUSTOMER FILLS — cached
  remitterEmail:        string
  remitterPhone:        string

  // Beneficiary (pre-filled, locked)
  beneficiaryName:      string
  beneficiaryCountry:   'CA'

  // Transaction (pre-filled, locked)
  amountInr:            number
  amountCad:            number
  exchangeRate:         number
  purposeCode:          string
  remittanceDate:       string

  // Tax answers (CUSTOMER FILLS, defaults pre-set for typical NRO repatriation)
  isChargeableToTax:    boolean
  tdsDeducted:          boolean
  tdsAmountInr:         number

  // Aggregate FY remittance (auto-computed)
  aggregateFyRemittanceInr: number

  // Declaration + signature (CUSTOMER FILLS)
  declared:             boolean
  signature: {
    typedName:          string         // customer types full legal name
    signedAt:           string         // ISO timestamp
    method:             'typed_electronic'
  }
}

interface Props {
  open:                 boolean
  amountInr:            number
  amountCad:            number
  exchangeRate:         number
  purposeCode:          string
  remitterName:         string
  remitterPAN:          string | null
  remitterEmail:        string
  remitterPhone:        string
  beneficiaryName:      string
  aggregateFyRemittanceInr: number
  onSubmit: (data: Form15CAPartAData) => void
  onCancel: () => void
}

interface CachedAnswers { fatherName?: string; indianAddress?: string }

function loadCached(): CachedAnswers {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CachedAnswers
    return {
      fatherName:    typeof parsed.fatherName === 'string' ? parsed.fatherName : undefined,
      indianAddress: typeof parsed.indianAddress === 'string' ? parsed.indianAddress : undefined,
    }
  } catch { return {} }
}
function saveCached(a: CachedAnswers) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(a)) } catch { /* private mode etc — ignore */ }
}

export default function Form15CAPartAModal({
  open, amountInr, amountCad, exchangeRate, purposeCode,
  remitterName, remitterPAN, remitterEmail, remitterPhone,
  beneficiaryName, aggregateFyRemittanceInr,
  onSubmit, onCancel,
}: Props) {

  const cached = useMemo(loadCached, [])

  const [pan, setPAN]               = useState(remitterPAN ?? '')
  const [fatherName, setFatherName] = useState(cached.fatherName ?? '')
  const [indianAddress, setAddress] = useState(cached.indianAddress ?? '')
  const [chargeable, setChargeable] = useState(false)
  const [tdsDeducted, setTds]       = useState(false)
  const [tdsAmount, setTdsAmount]   = useState('')
  const [signedName, setSignedName] = useState('')
  const [declared, setDeclared]     = useState(false)
  const [showAuto, setShowAuto]     = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => { if (open) setError(null) }, [open])

  const aggregateAfter   = aggregateFyRemittanceInr + amountInr
  const exceedsPartABand = aggregateAfter > 500_000

  // Signature must match registered name (case-insensitive, trimmed) — same
  // gate Winman uses to prevent customers from signing as another person.
  const expectedName = remitterName.trim().toLowerCase()
  const signatureValid =
    signedName.trim().length > 0 &&
    signedName.trim().toLowerCase() === expectedName

  // Required-field gate — keeps the submit button disabled until everything
  // mandatory is filled.  Visual cue mirrors what Winman does: red * + a
  // disabled button + an explicit list of what's still missing so the
  // customer is never guessing which field is blocking them.
  const tdsAmountNum   = Number(tdsAmount)
  const tdsAmountValid = !tdsDeducted || (tdsAmountNum > 0 && Number.isFinite(tdsAmountNum))

  // Build a list of human-readable field names that are still missing or
  // invalid.  Empty array = form is submittable.
  const missingFields: string[] = []
  if (!PAN_REGEX.test(pan.trim().toUpperCase())) missingFields.push('Valid PAN (AAAAA9999A)')
  if (fatherName.trim().length < 2)              missingFields.push("Father's name")
  if (indianAddress.trim().length < 10)          missingFields.push('Indian address')
  if (tdsDeducted && !tdsAmountValid)            missingFields.push('TDS amount (you selected Yes)')
  if (!signatureValid && signedName.trim().length === 0)
                                                  missingFields.push('Digital signature (type your full name)')
  else if (!signatureValid)                      missingFields.push(`Signature must match registered name (${remitterName})`)
  if (!declared)                                  missingFields.push('Tick the declaration box')
  if (exceedsPartABand)                          missingFields.push('FY total exceeds ₹5,00,000 — use the standard CA flow')

  const allMandatoryFilled = missingFields.length === 0

  if (!open) return null

  function submit() {
    setError(null)

    const panClean = pan.trim().toUpperCase()
    if (!PAN_REGEX.test(panClean)) { setError('PAN must look like AAAAA9999A.'); return }
    if (fatherName.trim().length < 2) { setError("Father's name is required by the IT department."); return }
    if (indianAddress.trim().length < 10) { setError('Please enter your full Indian address.'); return }
    if (tdsDeducted && !tdsAmountValid) { setError('TDS amount must be a positive number.'); return }
    if (!signatureValid) {
      setError(`Signature must match your registered name exactly: ${remitterName}.`)
      return
    }
    if (!declared) { setError('You must tick the declaration to file Form 15CA Part A.'); return }
    if (exceedsPartABand) {
      setError(`This transfer pushes your FY total above ₹5,00,000. Use the standard CA-routed flow.`)
      return
    }

    saveCached({ fatherName: fatherName.trim(), indianAddress: indianAddress.trim() })

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
      isChargeableToTax:     chargeable,
      tdsDeducted,
      tdsAmountInr:          tdsDeducted ? Number(tdsAmount) : 0,
      aggregateFyRemittanceInr,
      declared:              true,
      signature: {
        typedName: signedName.trim(),
        signedAt:  new Date().toISOString(),
        method:    'typed_electronic',
      },
    })
  }

  const C = {
    overlay: 'rgba(8, 16, 26, 0.7)',
    bg: '#0B1C2C', card: '#132233', border: 'rgba(201,150,58,0.22)',
    accent: '#C9963A', accentLt: '#E8B86D',
    text: '#FAF6F0', muted: '#8BA0B4', danger: '#E74C3C', success: '#27AE60',
    subtle: 'rgba(201,150,58,0.06)', autofill: 'rgba(39,174,96,0.06)',
  }

  const Star = () => <span style={{ color: C.danger, fontWeight: 700 }}> *</span>

  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {children}
    </span>
  )

  const inputStyle: React.CSSProperties = {
    background: C.bg, border: `1px solid ${C.border}`, color: C.text,
    padding: '0.65rem 0.75rem', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
    minHeight: 44,
  }

  const radioBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, minWidth: 80, padding: '0.6rem 0.75rem',
    background: active ? 'rgba(201,150,58,0.18)' : C.bg,
    border: `1px solid ${active ? C.accent : C.border}`,
    color: active ? C.accent : C.text,
    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center',
    minHeight: 44,
  })

  // Compact summary line — Winman-style "what we have on file"
  const autoLine = (label: string, value: string) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.3rem 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: '0.72rem', color: C.muted }}>{label}</span>
      <span style={{ fontSize: '0.78rem', color: C.text, fontFamily: 'inherit', textAlign: 'right' }}>{value}</span>
    </div>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label="Form 15CA Part A self-declaration"
      style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '1.1rem 1.25rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.3rem' }}>
              Form 15CA · Part A
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 600, margin: 0, lineHeight: 1.15 }}>
              Sign &amp; send
            </h2>
            <p style={{ fontSize: '0.78rem', color: C.muted, margin: '0.4rem 0 0 0', lineHeight: 1.45 }}>
              For outward remittance up to ₹5L per FY. We auto-fill everything we have on record — only the fields below need your input.
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Auto-filled — collapsed by default */}
          <div style={{ background: C.autofill, border: `1px solid ${C.border}`, padding: '0.75rem 0.85rem' }}>
            <button onClick={() => setShowAuto(!showAuto)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: 0 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.success, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={14} /> Auto-filled · {showAuto ? 'hide' : 'review'}
              </span>
              {showAuto ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
            </button>
            {showAuto && (
              <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column' }}>
                {autoLine('Name',         remitterName)}
                {autoLine('Email',        remitterEmail)}
                {autoLine('Phone',        remitterPhone)}
                {autoLine('Beneficiary',  `${beneficiaryName} · Canada`)}
                {autoLine('Amount',       `₹${amountInr.toLocaleString('en-IN')}  →  CAD ${amountCad.toFixed(2)}`)}
                {autoLine('Exchange rate',`1 CAD = ₹${exchangeRate.toFixed(2)}`)}
                {autoLine('Purpose code', purposeCode)}
                {autoLine('FY total after', `₹${aggregateAfter.toLocaleString('en-IN')}`)}
                {autoLine('Date',         new Date().toLocaleDateString('en-CA'))}
              </div>
            )}
          </div>

          {exceedsPartABand && (
            <div style={{ background: 'rgba(231,76,60,0.08)', border: `1px solid ${C.danger}`, padding: '0.65rem 0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} color={C.danger} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.45 }}>
                FY total after this transfer would exceed ₹5,00,000. Form 15CA Part C and CA-certified Form 15CB are required at that level. Use the standard CA-routed flow instead.
              </div>
            </div>
          )}

          {/* Mandatory fields — what we need from you */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.1rem' }}>
              What we need from you
            </div>

            {/* PAN — pre-filled, editable */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <FieldLabel>PAN<Star /></FieldLabel>
              <input value={pan} maxLength={10}
                onChange={e => setPAN(e.target.value.toUpperCase())}
                placeholder="AAAAA9999A"
                style={{ ...inputStyle, fontFamily: "'DM Sans', monospace", letterSpacing: '0.05em' }} />
            </label>

            {/* Father's name — required by IT, cached */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <FieldLabel>Father&apos;s name (as per PAN)<Star /></FieldLabel>
              <input value={fatherName}
                onChange={e => setFatherName(e.target.value)}
                placeholder="e.g. Ramesh Bhagi"
                style={inputStyle} />
              {cached.fatherName && (
                <span style={{ fontSize: '0.7rem', color: C.success }}>Auto-filled from your last transfer</span>
              )}
            </label>

            {/* Indian address — required, cached */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <FieldLabel>Indian address (NRO-registered)<Star /></FieldLabel>
              <textarea value={indianAddress}
                onChange={e => setAddress(e.target.value)}
                placeholder="House / Street, City, State, PIN"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} />
              {cached.indianAddress && (
                <span style={{ fontSize: '0.7rem', color: C.success }}>Auto-filled from your last transfer</span>
              )}
            </label>

            {/* Tax chargeable */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <FieldLabel>Chargeable to tax in India?<Star /></FieldLabel>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setChargeable(false)} style={radioBtn(!chargeable)}>No (typical)</button>
                <button type="button" onClick={() => setChargeable(true)}  style={radioBtn(chargeable)}>Yes</button>
              </div>
              <span style={{ fontSize: '0.7rem', color: C.muted, marginTop: '0.1rem' }}>
                NRO-savings repatriations of already-taxed funds are typically NOT chargeable. Pick &lsquo;No&rsquo; if unsure.
              </span>
            </div>

            {/* TDS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <FieldLabel>TDS deducted at source?<Star /></FieldLabel>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setTds(false); setTdsAmount('') }} style={radioBtn(!tdsDeducted)}>No</button>
                <button type="button" onClick={() => setTds(true)}  style={radioBtn(tdsDeducted)}>Yes</button>
              </div>
              {tdsDeducted && (
                <input value={tdsAmount}
                  onChange={e => setTdsAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="TDS amount in ₹"
                  inputMode="decimal"
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Sans'",
                    marginTop: '0.4rem',
                    borderColor: tdsAmount.length === 0 || !tdsAmountValid ? C.danger : C.border,
                  }} />
              )}
            </div>
          </div>

          {/* Digital signature */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.85rem', border: `1px solid ${C.border}`, background: C.subtle }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileSignature size={14} /> Digital signature<Star />
            </div>
            <span style={{ fontSize: '0.78rem', color: C.muted, lineHeight: 1.45 }}>
              Type your full registered name to sign.  Counts as electronic signature under IT Act 2000 § 3A.
            </span>
            <input value={signedName}
              onChange={e => setSignedName(e.target.value)}
              placeholder={remitterName}
              style={{ ...inputStyle, fontFamily: "'Cormorant Garamond', cursive", fontSize: '1.1rem', fontStyle: 'italic',
                color: signatureValid ? C.accentLt : C.text,
                borderColor: signedName.length > 0 && !signatureValid ? C.danger : C.border }} />
            {signedName.length > 0 && !signatureValid && (
              <span style={{ fontSize: '0.7rem', color: C.danger }}>
                Must match your registered name: <strong>{remitterName}</strong>
              </span>
            )}
            {signatureValid && (
              <span style={{ fontSize: '0.7rem', color: C.success }}>Signature accepted · {new Date().toLocaleString()}</span>
            )}
          </div>

          {/* Declaration checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: 'rgba(201,150,58,0.06)', padding: '0.85rem', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
            <input type="checkbox" checked={declared}
              onChange={e => setDeclared(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: C.accent, flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.5 }}>
              I declare the information above is true, the funds are from my NRO account on which applicable Indian taxes have been paid, and my aggregate outward remittances during this financial year do not exceed ₹5,00,000.<Star />
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
        <div style={{ padding: '1rem 1.25rem', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {missingFields.length > 0 && (
            <div style={{ background: 'rgba(243,156,18,0.08)', border: `1px solid ${C.warning}`, padding: '0.6rem 0.8rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.warning, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                Before you can submit
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: C.text, lineHeight: 1.5 }}>
                {missingFields.map(f => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}
          <button onClick={submit}
            disabled={!allMandatoryFilled}
            style={{
              width: '100%', minHeight: 48,
              background: allMandatoryFilled ? C.accent : 'rgba(201,150,58,0.3)',
              color: C.bg, border: 'none', padding: '0.95rem',
              fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              cursor: allMandatoryFilled ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}>
            <CheckCircle2 size={16} /> Sign &amp; send transfer
          </button>
          <button onClick={onCancel}
            style={{ width: '100%', minHeight: 40, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, padding: '0.6rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
