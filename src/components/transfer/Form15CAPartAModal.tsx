import { useState, useEffect } from 'react'
import { X, CheckCircle2, ShieldCheck } from 'lucide-react'

/**
 * Form 145 Part A — confirm & declare (transfers up to ₹5 lakh in the tax year).
 * Form 145 replaced Form 15CA on 1 April 2026 (Income-tax Act 2025).
 *
 * Minimum customer effort (founder rule): everything already verified through
 * DigiLocker / PAN verification is shown read-only — the customer does NOT
 * retype PAN, father's name or address. Father's name and Indian address come
 * from the DigiLocker record at filing time (verification partner), so REPAIHUB
 * never stores them (Rule 12). The customer answers one tax question and ticks
 * one declaration. PAN is still legally required at every amount; only the CA
 * certificate (Form 146) is not needed up to ₹5 lakh.
 */

const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/
export const VERIFIED_PAN_KEY = 'rh_verified_pan'   // sessionStorage only — cleared when the tab closes

export interface Form15CAPartAData {
  remitterName:         string
  remitterPAN:          string
  remitterFatherName:   string         // '' — fetched from DigiLocker at filing; never stored by REPAIHUB
  remitterAddressIndia: string         // '' — fetched from DigiLocker at filing; never stored by REPAIHUB
  remitterEmail:        string
  remitterPhone:        string
  beneficiaryName:      string
  beneficiaryCountry:   'CA'
  amountInr:            number
  amountCad:            number
  exchangeRate:         number
  purposeCode:          string
  remittanceDate:       string
  isChargeableToTax:    boolean
  tdsDeducted:          boolean
  tdsAmountInr:         number
  aggregateFyRemittanceInr: number
  declared:             boolean
  identitySource:       'digilocker' | 'customer_entered'
  signature: {
    typedName:          string         // verified name the customer declared as
    signedAt:           string
    method:             'checkbox_declaration'
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

type TaxAnswer = 'tds_deducted' | 'not_taxable' | 'not_sure'

function readVerifiedPan(): string | null {
  try { const v = sessionStorage.getItem(VERIFIED_PAN_KEY); return v && PAN_REGEX.test(v) ? v : null } catch { return null }
}
const mask = (pan: string) => 'XXXXXX' + pan.slice(6)
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

export default function Form15CAPartAModal({
  open, amountInr, amountCad, exchangeRate, purposeCode,
  remitterName, remitterPAN, remitterEmail, remitterPhone,
  beneficiaryName, aggregateFyRemittanceInr, onSubmit, onCancel,
}: Props) {
  const verifiedPan = remitterPAN && PAN_REGEX.test(remitterPAN) ? remitterPAN : readVerifiedPan()
  const [panEntry, setPanEntry] = useState('')
  const [tax, setTax] = useState<TaxAnswer | ''>('')
  const [declared, setDeclared] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setError(null); setDeclared(false) } }, [open])
  if (!open) return null

  const pan = verifiedPan ?? panEntry.trim().toUpperCase()
  const panOk = PAN_REGEX.test(pan)
  const aggregateAfter = aggregateFyRemittanceInr + amountInr
  const exceedsPartABand = aggregateAfter > 500_000
  const ready = panOk && !!tax && declared && !exceedsPartABand

  function submit() {
    if (!panOk) { setError('Please enter a valid PAN (5 letters, 4 digits, 1 letter).'); return }
    if (!tax) { setError('Please answer the tax question.'); return }
    if (!declared) { setError('Please tick the declaration.'); return }
    if (exceedsPartABand) { setError('This transfer takes your tax-year total above ₹5 lakh, so a CA certificate (Form 146) is needed.'); return }
    onSubmit({
      remitterName, remitterPAN: pan, remitterFatherName: '', remitterAddressIndia: '',
      remitterEmail, remitterPhone, beneficiaryName, beneficiaryCountry: 'CA',
      amountInr, amountCad, exchangeRate, purposeCode, remittanceDate: new Date().toISOString(),
      isChargeableToTax: tax === 'tds_deducted', tdsDeducted: tax === 'tds_deducted', tdsAmountInr: 0,
      aggregateFyRemittanceInr, declared: true,
      identitySource: verifiedPan ? 'digilocker' : 'customer_entered',
      signature: { typedName: remitterName, signedAt: new Date().toISOString(), method: 'checkbox_declaration' },
    })
  }

  const C = { overlay: 'rgba(8,16,26,0.75)', bg: '#0B1C2C', card: '#132233', border: 'rgba(201,150,58,0.22)', accent: '#C9963A', accentLt: '#E8B86D', text: '#FAF6F0', muted: '#8BA0B4', danger: '#F2A7A7', success: '#27AE60' }
  const row = (k: string, v: string, ok = false) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.45rem 0', borderBottom: `1px solid ${C.border}`, fontSize: '0.84rem' }}>
      <span style={{ color: C.muted }}>{k}</span>
      <span style={{ color: ok ? C.success : C.text, textAlign: 'right' }}>{v}</span>
    </div>
  )
  const choice = (id: TaxAnswer, title: string, sub: string) => (
    <button key={id} type="button" onClick={() => setTax(id)} aria-pressed={tax === id}
      style={{ textAlign: 'left', background: tax === id ? 'rgba(201,150,58,0.12)' : C.bg, border: `1px solid ${tax === id ? C.accent : C.border}`, color: C.text, padding: '0.7rem 0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>
      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{title}</div>
      <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: '0.15rem' }}>{sub}</div>
    </button>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label="Form 145 Part A declaration"
      style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0', overflowY: 'auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: '1.25rem 1.1rem 1.4rem', fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accent }}>Form 145 · Part A</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#FFF', margin: '0.2rem 0 0' }}>Confirm and send</h2>
          </div>
          <button onClick={onCancel} aria-label="Close" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>
        <p style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.55, margin: '0.6rem 0 0.9rem' }}>
          Up to ₹5 lakh in the tax year, no CA certificate (Form 146) is needed. We file Form 145 (formerly 15CA) for you from your verified details.
        </p>

        <div style={{ background: C.bg, border: `1px solid ${C.border}`, padding: '0.4rem 0.85rem 0.6rem', marginBottom: '1rem' }}>
          {row('Name', remitterName || '—')}
          {verifiedPan
            ? row('PAN', `${mask(verifiedPan)}  ✓ verified`, true)
            : null}
          {row("Father's name & address", 'From your DigiLocker record', true)}
          {row('Amount', `${inr(amountInr)} → CAD ${amountCad.toFixed(2)}`)}
          {row('To', `${beneficiaryName || remitterName}'s Canadian account`)}
          {row('Tax-year total after this', inr(aggregateAfter))}
        </div>

        {!verifiedPan && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>PAN (required at any amount)</span>
            <input value={panEntry} maxLength={10} onChange={e => setPanEntry(e.target.value.toUpperCase())} placeholder="ABCDE1234F"
              style={{ background: '#1C3147', border: `1px solid ${C.border}`, color: '#FFF', padding: '0.75rem', fontSize: '16px', fontFamily: 'inherit' }} />
          </label>
        )}

        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.45rem' }}>Has tax already been handled on this money?</div>
        <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '1rem' }}>
          {choice('tds_deducted', 'Yes — TDS was deducted', 'e.g. your bank deducted TDS on interest, rent or the sale')}
          {choice('not_taxable', 'Not taxable', 'e.g. savings that were already taxed')}
          {choice('not_sure', 'Not sure', 'Our partner CA will check before the money moves')}
        </div>

        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '1rem' }}>
          <input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: C.accent, flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.55 }}>
            I, {remitterName || 'the account holder'}, declare that these details are correct, the money is my own and applicable Indian taxes are paid, and I authorise REPAIHUB to file Form 145 Part A for this transfer.
          </span>
        </label>

        {exceedsPartABand && <p role="alert" style={{ color: C.danger, fontSize: '0.8rem', margin: '0 0 0.75rem' }}>This transfer takes your tax-year total above ₹5 lakh, so a CA certificate (Form 146) is needed — our partner CA will handle it.</p>}
        {error && <p role="alert" style={{ color: C.danger, fontSize: '0.8rem', margin: '0 0 0.75rem' }}>{error}</p>}

        <button onClick={submit} disabled={!ready}
          style={{ width: '100%', background: ready ? C.accent : 'rgba(201,150,58,0.3)', color: C.bg, border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: ready ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {ready ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />} Confirm & send
        </button>
        <p style={{ fontSize: '0.7rem', color: C.muted, textAlign: 'center', margin: '0.6rem 0 0' }}>REPAIHUB never stores your documents. Only a masked PAN is kept.</p>
      </div>
    </div>
  )
}
