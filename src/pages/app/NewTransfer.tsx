import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, mapDbTransfer } from '../../store/useStore'
import { apiCreateTransfer, apiUpdateProfile, apiGetFeeTiers } from '../../lib/api'
import type { OutwardFeeTier, Form15CAPartASubmission } from '../../lib/api'
import Form15CAPartAModal from '../../components/transfer/Form15CAPartAModal'
import type { Form15CAPartAData } from '../../components/transfer/Form15CAPartAModal'
import { formatINR, formatCAD, generateRef } from '../../lib/utils'
import { Check, AlertCircle, Zap, Clock, ArrowLeft, ArrowLeftRight, Building2 } from 'lucide-react'
import type { ResidencyStatus } from '../../store/useStore'

const RESIDENCY_OPTIONS: { id: ResidencyStatus; title: string; desc: string }[] = [
  { id: 'citizen',     title: 'Canadian Citizen',   desc: 'You hold a Canadian passport' },
  { id: 'pr',          title: 'Permanent Resident', desc: 'You hold a PR card' },
  { id: 'oci',         title: 'OCI Card Holder',    desc: 'Overseas Citizen of India card' },
  { id: 'work_permit', title: 'Work Permit Holder', desc: 'Currently on a Canadian work permit' },
]

type Step = 1 | 2 | 3 | 4 | 5
type Direction = 'outward' | 'inward'

// Fallback commission rate used until live tiers (from /fees/tiers) load.
// Live tiers come from outward_fee_tiers in Supabase — see migration 025.
const COMMISSION_RATE_FALLBACK = 0.018
const FEE_FLAT_STD   = 25      // outward standard flat fee CAD — spec: CAD $25 flat (REQ-06)
const FEE_FLAT_EXP   = 49      // outward express flat fee (std $25 + $24 surcharge)
// Inward fee model: profit comes from FX spread, not from explicit fees.
// We charge a small-transfer fee of \$1.99 when the CAD amount is below \$500.
// Above \$500: no fee at all. Express vs Standard does NOT change the price.
const FEE_INWARD_SMALL_TXN     = 1.99
const FEE_INWARD_FREE_THRESHOLD = 500
const TCS_THRESHOLD_INR = 700_000

const PURPOSES = [
  'Repatriation of savings',
  'Rental income',
  'Pension / salary',
  'Property sale proceeds',
  'Investment returns',
  'Family maintenance',
  'Other',
]

// RBI purpose codes — must match RBIPurposeCode type and RBI_PURPOSE_CODES_ENABLED env
// S0014 = repatriation of non-resident deposits (correct RBI code for NRO outward, REQ-03)
// P1301 was wrong — removed. P1302 used for NRE path.
const PURPOSE_CODES: Record<string, string> = {
  'Repatriation of savings': 'S0014',
  'Rental income':           'S0014',
  'Pension / salary':        'S0014',
  'Property sale proceeds':  'S0014',
  'Investment returns':      'P0001',
  'Family maintenance':      'P1101',
  'Other':                   'S0014',
}

// SourceOfFunds type values — must match SourceOfFunds union in types/compliance.ts
const SOURCE_OF_FUNDS: Record<string, string> = {
  'Repatriation of savings': 'other',
  'Rental income':           'rental_income',
  'Pension / salary':        'pension',
  'Property sale proceeds':  'property_sale',
  'Investment returns':      'matured_investment',
  'Family maintenance':      'other',
  'Other':                   'other',
}

const DRAFT_KEY = 'rh_transfer_draft'

export default function NewTransfer() {
  const { user, fxRate, addTransfer, addNotification, setResidency } = useStore()
  const nav = useNavigate()

  // Deferred KYC — capture residency on first transfer if not already set
  const [residencyPicker, setResidencyPicker] = useState(!user?.residencyStatus)
  const [selectedResidency, setSelectedResidency] = useState<ResidencyStatus>(user?.residencyStatus || '')
  const [savingResidency, setSavingResidency] = useState(false)

  async function confirmResidency() {
    if (!selectedResidency) return
    setSavingResidency(true)
    try { await apiUpdateProfile({ residency: selectedResidency }) } catch { /* non-fatal */ }
    setResidency(selectedResidency)
    setResidencyPicker(false)
    setSavingResidency(false)
  }

  const [step, setStep]               = useState<Step>(1)
  const [direction, setDirection]     = useState<Direction>('outward')
  const [amount, setAmount]           = useState('')
  const [express, setExpress]         = useState(false)
  const [purpose, setPurpose]         = useState('')
  const [loading, setLoading]         = useState(false)
  const [txnRef, setTxnRef]           = useState('')
  const [progress, setProgress]       = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)

  // Live fee tiers (loaded from /fees/tiers on mount).  Empty array means
  // we use COMMISSION_RATE_FALLBACK as a single flat rate (keeps the page
  // working if the API is unreachable, e.g. cold start, brand-new dev DB).
  const [feeTiers, setFeeTiers] = useState<OutwardFeeTier[]>([])

  useEffect(() => {
    apiGetFeeTiers()
      .then(r => setFeeTiers(r.tiers))
      .catch(() => { /* fall back silently to COMMISSION_RATE_FALLBACK */ })
  }, [])

  // Form 15CA Part A modal — opened at Step-4 confirm for sub-₹5L outward
  // transfers.  When closed, submitTransfer is called with the form data.
  const [show15CA, setShow15CA] = useState(false)

  // REQ-02: Account type question (NRO | NRE) — asked once per outward session.
  // REQ-07: NRE self-declaration checkbox — submit disabled until checked.
  const [accountType, setAccountType] = useState<'NRO' | 'NRE' | ''>('')
  const [tempAccountType, setTempAccountType] = useState<'NRO' | 'NRE' | ''>('')
  const [nreDeclaration, setNreDeclaration] = useState(false)

  // Restore draft state after returning from bank connection pages
  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return
    try {
      const draft = JSON.parse(raw) as { amount: string; express: boolean; purpose: string; direction: Direction; step: Step }
      sessionStorage.removeItem(DRAFT_KEY)
      setAmount(draft.amount)
      setExpress(draft.express)
      setPurpose(draft.purpose)
      setDirection(draft.direction)
      setStep(draft.step)
    } catch { sessionStorage.removeItem(DRAFT_KEY) }
  }, [])

  // Navigate to bank connection page — saves current form state so we return to step 2
  function connectBank(path: string) {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ amount, express, purpose, direction, step: 2 as Step }))
    nav(`${path}?returnTo=/app/new-transfer`)
  }

  const isOutward = direction === 'outward'
  const rate      = fxRate || 83
  const amt       = parseFloat(amount.replace(/,/g, '')) || 0

  const amtINR        = isOutward ? amt : amt * rate
  // Resolve the tier this transfer falls into.  When the live tier list is
  // empty (initial render or API error) we fall back to a single 1.8% rate
  // and the legacy flat fees, so the form is never blocked.
  const currentTier: OutwardFeeTier | null = (() => {
    if (!feeTiers || feeTiers.length === 0) return null
    for (const t of feeTiers) {
      const above = amtINR >= t.slabMinInr
      const below = t.slabMaxInr === null || amtINR <= t.slabMaxInr
      if (above && below) return t
    }
    return feeTiers[feeTiers.length - 1]
  })()
  const currentCommissionRate = currentTier ? currentTier.commissionRate : COMMISSION_RATE_FALLBACK
  // Tier-driven flat fee: tier base, with the express surcharge added on top
  // when the user opts for express. Waivers (waiveFlatFee, flatFeeWaiveAboveInr)
  // are honoured here as well so the customer preview matches the backend math.
  const tierFlatBase = currentTier
    ? (() => {
        if (currentTier.waiveFlatFee) return 0
        if (currentTier.flatFeeWaiveAboveInr != null && amtINR >= currentTier.flatFeeWaiveAboveInr) return 0
        return currentTier.flatFeeCAD
      })()
    : FEE_FLAT_STD
  const expressSurcharge = express ? (FEE_FLAT_EXP - FEE_FLAT_STD) : 0  // = \$25
  const flatFee       = tierFlatBase + expressSurcharge
  const tcsApplies    = isOutward && amtINR > TCS_THRESHOLD_INR
  const tcsAmt        = tcsApplies ? amtINR * 0.05 : 0
  const netINR        = amtINR - tcsAmt
  const grossCAD      = isOutward ? netINR / rate : amt
  const commissionCAD = isOutward ? Math.round(grossCAD * currentCommissionRate * 100) / 100 : 0
  const totalFees     = commissionCAD + flatFee
  const amtCAD        = isOutward ? Math.max(0, grossCAD - totalFees) : amt
  // Inward fee model: user enters the amount they want to convert ('Amount to send').
  // The \$1.99 small-transfer fee is charged ON TOP of that amount when it's
  // below \$500. So the customer's account is debited (amt + fee), the rail
  // converts the full `amt`, and the recipient receives amt * rate.
  const inwardFee      = !isOutward && amt > 0 && amt < FEE_INWARD_FREE_THRESHOLD ? FEE_INWARD_SMALL_TXN : 0
  const inwardTotalCAD = !isOutward ? amt + inwardFee : 0
  const receiveINR     = isOutward ? 0 : amt * rate

  // FEMA Section 6(4): NRO repatriation cap = USD 1,000,000 per Indian FY (Apr–Mar). REQ-05
  // NRE path has no annual cap — this limit applies to NRO only.
  const LRS_LIMIT_USD = 1_000_000
  const USD_INR_RATE_DEFAULT = 83
  const annualLimitCAD = Math.round((LRS_LIMIT_USD * USD_INR_RATE_DEFAULT) / (rate || 63.42))
  const limitRemaining = annualLimitCAD - (user?.annualLimitUsed || 0)
  const exceedsLimit   = isOutward && amtINR / rate > limitRemaining
  const minOk          = isOutward ? amt >= 10000 : amt >= 100

  const hasIndiaBank  = !!user?.indiaBank
  const hasCanadaBank = !!user?.canadaBank
  const bothBanksOk   = isOutward ? (hasIndiaBank && hasCanadaBank) : (hasCanadaBank && hasIndiaBank)

  const flipDirection = () => {
    setDirection(d => d === 'outward' ? 'inward' : 'outward')
    setAmount('')
  }

  const formatAmountInput = (v: string) => {
    const n = v.replace(/\D/g, '')
    return n ? parseInt(n).toLocaleString(isOutward ? 'en-IN' : 'en-CA') : ''
  }

  // Aggregate outward INR remittance during the current Indian FY (Apr-Mar).
  // Feeds the 15CA Part A modal preview AND the backend's compliance gate.
  function aggregateOutwardFyInr(): number {
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const fyStartIso  = `${fyStartYear}-04-01`
    return useStore
      .getState()
      .transfers
      .filter(t => t.direction !== 'inward' && t.status !== 'FAILED' && t.date >= fyStartIso)
      .reduce((sum, t) => sum + (t.amountINR || 0), 0)
  }

  // Step-4 confirm entry point.
  //
  // Part A 'fast lane' modal opens ONLY when the customer is legally
  // eligible for it:
  //   1) outward direction, AND
  //   2) this transfer alone is < ₹5L, AND
  //   3) cumulative FY outward (incl. this transfer) is <= ₹5L.
  //
  // Form 15CB is triggered by EITHER a single >₹5L transfer OR cumulative
  // FY > ₹5L — at that band Part A is no longer legal, so opening a Part A
  // modal would be both wrong and confusing.  Ineligible customers go
  // straight through submitTransfer() which routes through the standard
  // CA-queued flow that creates the Form 15CB compliance request.
  //
  // For the ineligible case we briefly surface a notification so the
  // customer knows WHY there's no popup and that their transfer is going
  // through the CA-routed path instead.
  async function handleConfirm() {
    const fyAfter = aggregateOutwardFyInr() + amt
    const inPartABand = isOutward && amt < 500_000 && fyAfter <= 500_000
    if (inPartABand) {
      setShow15CA(true)
      return
    }
    if (isOutward && amt < 500_000 && fyAfter > 500_000) {
      addNotification({
        message: `FY total of ₹${fyAfter.toLocaleString('en-IN')} exceeds the ₹5L Part A band — this transfer needs CA-certified Form 15CB. Routing through the standard flow now.`,
        type: 'info',
      })
    }
    return submitTransfer()
  }

  async function submitTransfer(form15caData?: Form15CAPartAData) {
    setShow15CA(false)
    setLoading(true)
    setTransferError(null)
    const ref = generateRef()
    setTxnRef(ref)

    const form15ca: Form15CAPartASubmission | undefined = form15caData
      ? { ...form15caData, beneficiaryCountry: 'CA' as const }
      : undefined

    // Start the real API call immediately — runs concurrently with the animation
    const apiPromise = apiCreateTransfer({
      amountInr:     isOutward ? amt : receiveINR,
      amountCad:     isOutward ? amtCAD : amt,
      amountFrom:    isOutward ? amt : amt,
      exchangeRate:  rate,
      feeCad:        isOutward ? totalFees : 0,
      purposeCode:   isOutward ? (accountType === 'NRE' ? 'P1302' : (PURPOSE_CODES[purpose] ?? 'S0014')) : 'S0014',
      sourceOfFunds: isOutward ? (SOURCE_OF_FUNDS[purpose] ?? 'other') : 'other',
      speed:         express ? 'express' : 'standard',
      reference:     ref,
      direction,
      form15ca,
    })

    // ─── Submission UX ────────────────────────────────────────────────────────
    //
    // Previous designs lied to the customer with a fake percentage that
    // crawled to 88% on a hardcoded 3 s timer, then sat frozen waiting on
    // the real API. The "stuck at 88%" complaint was unfixable while the
    // bar was percentage-driven, because we genuinely don't know how long
    // /transfers/initiate will take (4 supabase queries + risk + compliance
    // + insert + side-effects, can be 1-8 s on cloud).
    //
    // New behaviour: an indeterminate progress bar that animates
    // CONTINUOUSLY via CSS until the API resolves. The customer sees
    // motion the whole time — no freeze possible — and the bar fills to
    // 100% only when the transfer is genuinely confirmed. Compliance
    // messages rotate every 1.2 s so there's reassurance the system is
    // doing real work.
    //
    // Total floor: ~apiTime + 600 ms outro. Ceiling: same.
    const messages = isOutward
      ? [
          'Verifying KYC tokens…',
          `Locking FX rate at ₹${rate}…`,
          'Generating Form 145 XML…',
          'Filing with IT portal…',
          'Assigning CA for Form 146…',
          'Confirming with server…',
        ]
      : [
          'Verifying FINTRAC compliance…',
          'Processing CAD withdrawal…',
          'Routing to India NRO account…',
          'Confirming with server…',
        ]

    setProgress(0)             // 0 means: render the indeterminate bar (see JSX)
    setProgressMsg(messages[0])

    let msgIdx = 0
    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, messages.length - 1)
      setProgressMsg(messages[msgIdx])
    }, 1200)

    const now = new Date().toISOString()
    try {
      const transfer = await apiPromise

      // Real success — transfer is in the database, response was 2xx.
      clearInterval(msgInterval)
      setProgress(100)         // > 0 means: render the determinate bar at 100%
      setProgressMsg('Transfer initiated!')

      // Defensive: a throw inside addTransfer / mapDbTransfer / addNotification
      // (e.g. unexpected response shape, store mutation race) MUST NOT flip
      // the customer's screen to 'Transfer Failed'. The transfer is already
      // recorded server-side; surface success regardless and log the inner
      // error to the console for follow-up.
      try {
        addTransfer(mapDbTransfer(transfer as Record<string, unknown>))
        addNotification({
          message: isOutward
            ? `Transfer initiated — ₹${amt.toLocaleString('en-IN')} → ${formatCAD(amtCAD)}. CA reviewing Form 146.`
            : `Inward transfer initiated — ${formatCAD(amt)} → ₹${Math.round(receiveINR).toLocaleString('en-IN')}.`,
          type: 'info',
          timestamp: now,
        })
      } catch (postErr) {
        console.error('[Transfer] Post-success bookkeeping failed (transfer is already in DB):', postErr)
      }
      setLoading(false)
      setStep(5)
      setTimeout(() => nav('/app/dashboard'), 600)
    } catch (err: unknown) {
      // Real failure — tell the user, do NOT fake success
      clearInterval(msgInterval)
      const msg = err instanceof Error ? err.message : 'Transfer failed. Please try again.'
      setTransferError(msg)
      setLoading(false)
    }
  }

  const S = {
    page:  { padding: '2rem', maxWidth: 640, margin: '0 auto' },
    card:  { background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2rem' },
    label: { fontSize: '0.75rem', fontWeight: 600 as const, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8BA0B4', display: 'block' as const, marginBottom: '0.5rem' },
    row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.9rem' },
  }

  const DirectionToggle = () => (
    <div style={{ background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.25)', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#8BA0B4', marginBottom: '0.25rem' }}>From</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FAF6F0' }}>{isOutward ? '🇮🇳 India' : '🇨🇦 Canada'}</div>
        <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>{isOutward ? `${accountType || 'NRO'} Account (INR)` : 'Chequing Account (CAD)'}</div>
      </div>
      <button
        onClick={flipDirection}
        title="Flip direction"
        style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(201,150,58,0.15)', border: '1px solid rgba(201,150,58,0.4)', color: '#C9963A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
      >
        <ArrowLeftRight size={16} />
      </button>
      <div style={{ flex: 1, textAlign: 'right' as const }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#8BA0B4', marginBottom: '0.25rem' }}>To</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FAF6F0' }}>{isOutward ? '🇨🇦 Canada' : '🇮🇳 India'}</div>
        <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>{isOutward ? 'Chequing Account (CAD)' : 'NRO Account (INR)'}</div>
      </div>
    </div>
  )

  const STEP_LABELS = ['Amount', 'Accounts', 'Review', 'Confirm']

  const StepDots = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
      {[1, 2, 3, 4].map(s => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
            background: step > s ? 'rgba(39,174,96,0.2)' : step === s ? '#C9963A' : 'rgba(201,150,58,0.1)',
            border:     step > s ? '1px solid rgba(39,174,96,0.5)' : step === s ? 'none' : '1px solid rgba(201,150,58,0.2)',
            color:      step > s ? '#27AE60' : step === s ? '#0B1C2C' : '#8BA0B4',
          }}>
            {step > s ? <Check size={12} /> : s}
          </div>
          {s < 4 && <div style={{ width: 30, height: 2, background: step > s ? '#27AE60' : 'rgba(201,150,58,0.2)' }} />}
        </div>
      ))}
      <div style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#8BA0B4' }}>
        {STEP_LABELS[(step > 4 ? 4 : step) - 1]}
      </div>
    </div>
  )

  const BankCard = ({ bank, label }: { bank: { name: string; sub: string }; label: string }) => (
    <div style={{ border: '1px solid #C9963A', background: 'rgba(201,150,58,0.06)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <Building2 size={20} color="#C9963A" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FAF6F0' }}>{bank.name}</div>
        <div style={{ fontSize: '0.78rem', color: '#8BA0B4' }}>{bank.sub}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: '0.25rem' }}>
        <Check size={16} color="#27AE60" />
        <span style={{ fontSize: '0.65rem', color: '#27AE60' }}>{label}</span>
      </div>
    </div>
  )

  const ConnectPrompt = ({ text, onClick }: { text: string; onClick: () => void }) => (
    <div style={{ border: '1px dashed rgba(201,150,58,0.3)', padding: '1.25rem', textAlign: 'center' as const }}>
      <div style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '0.75rem' }}>No account connected</div>
      <button onClick={onClick} style={{ background: 'transparent', border: '1px solid rgba(201,150,58,0.4)', color: '#C9963A', padding: '0.5rem 1.25rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
        {text}
      </button>
    </div>
  )

  // ── Residency picker screen (shown once if residency not yet set) ─────────────
  if (residencyPicker) {
    return (
      <div style={{ ...S.page, maxWidth: 520 }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => nav('/app/dashboard')} style={{ background: 'none', border: 'none', color: '#8BA0B4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', padding: 0 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>Before Your First Transfer</h1>
            <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.2rem' }}>One quick question — takes 10 seconds</p>
          </div>
        </div>
        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Your residency status determines your transfer limits and the compliance forms required by RBI.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
            {RESIDENCY_OPTIONS.map(opt => (
              <div key={opt.id} onClick={() => setSelectedResidency(opt.id)}
                style={{ border: `1px solid ${selectedResidency === opt.id ? '#C9963A' : 'rgba(201,150,58,0.2)'}`, background: selectedResidency === opt.id ? 'rgba(201,150,58,0.08)' : '#0B1C2C', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `1px solid ${selectedResidency === opt.id ? '#C9963A' : 'rgba(201,150,58,0.3)'}`, background: selectedResidency === opt.id ? '#C9963A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  {selectedResidency === opt.id && <Check size={10} color="#0B1C2C" />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#FAF6F0', fontSize: '0.9rem' }}>{opt.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8BA0B4', marginTop: '0.15rem' }}>{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={confirmResidency} disabled={!selectedResidency || savingResidency}
            style={{ width: '100%', background: selectedResidency ? '#C9963A' : 'rgba(201,150,58,0.3)', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: selectedResidency && !savingResidency ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {savingResidency ? 'Saving…' : 'Continue to Transfer →'}
          </button>
        </div>
      </div>
    )
  }

  // ── REQ-02: Account type picker (outward only, asked once per session) ─────────
  if (!residencyPicker && isOutward && !accountType) {
    return (
      <div style={{ ...S.page, maxWidth: 520 }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => nav('/app/dashboard')} style={{ background: 'none', border: 'none', color: '#8BA0B4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', padding: 0 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>Account Type</h1>
            <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.2rem' }}>Which India account are you repatriating from?</p>
          </div>
        </div>
        <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '2rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Your account type determines the compliance route — NRO requires CA-certified forms, NRE is freely repatriable under FEMA.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {([
              { id: 'NRO' as const, title: 'NRO — Non-Resident Ordinary', desc: 'Taxable Indian income. Requires Form 145/146 CA certification and is subject to the USD 1M FEMA annual cap.' },
              { id: 'NRE' as const, title: 'NRE — Non-Resident External', desc: 'Tax-free, freely repatriable under FEMA. No Form 145/146. No annual cap. Self-declaration required.' },
            ] as const).map(opt => (
              <div key={opt.id} onClick={() => setTempAccountType(opt.id)}
                style={{ border: `1px solid ${tempAccountType === opt.id ? '#C9963A' : 'rgba(201,150,58,0.2)'}`, background: tempAccountType === opt.id ? 'rgba(201,150,58,0.08)' : '#0B1C2C', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2, border: `1px solid ${tempAccountType === opt.id ? '#C9963A' : 'rgba(201,150,58,0.3)'}`, background: tempAccountType === opt.id ? '#C9963A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {tempAccountType === opt.id && <Check size={10} color="#0B1C2C" />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#FAF6F0', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{opt.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8BA0B4', lineHeight: 1.5 }}>{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setAccountType(tempAccountType as 'NRO' | 'NRE')} disabled={!tempAccountType}
            style={{ width: '100%', background: tempAccountType ? '#C9963A' : 'rgba(201,150,58,0.3)', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: tempAccountType ? 'pointer' : 'not-allowed' }}>
            Continue →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => step > 1 && step < 5 ? setStep(s => (s - 1) as Step) : nav('/app/dashboard')}
          style={{ background: 'none', border: 'none', color: '#8BA0B4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', padding: 0 }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>New Transfer</h1>
          <p style={{ fontSize: '0.8rem', color: '#8BA0B4', marginTop: '0.2rem' }}>Rate: 1 CAD = ₹{rate}</p>
        </div>
      </div>

      {/* Direction toggle — persistent above step dots */}
      {step < 5 && <DirectionToggle />}
      {step < 5 && <StepDots />}

      {/* ── STEP 1: Amount + Speed ── */}
      {step === 1 && (
        <div style={S.card}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Enter Amount</h2>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>
            {isOutward
            ? accountType === 'NRE'
              ? 'Minimum ₹10,000 · No annual cap (NRE account)'
              : `Minimum ₹10,000 · NRO annual limit: ${formatCAD(limitRemaining)} remaining`
            : 'Minimum CAD 100'
          }
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={S.label}>{isOutward ? 'Amount to Send (INR)' : 'Amount to Send (CAD)'}</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#C9963A', fontSize: '1.2rem', fontWeight: 600 }}>
                {isOutward ? '₹' : '$'}
              </span>
              <input
                value={amount}
                onChange={e => setAmount(formatAmountInput(e.target.value))}
                placeholder={isOutward ? '1,00,000' : '1,000'}
                className="input-field"
                style={{ display: 'block', paddingLeft: '2.5rem', fontSize: '1.4rem', fontWeight: 600, fontFamily: "'DM Sans'" }}
              />
            </div>
            {exceedsLimit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#E74C3C', fontSize: '0.8rem' }}>
                <AlertCircle size={14} /> Exceeds your annual limit ({formatCAD(limitRemaining)} remaining)
              </div>
            )}
          </div>

          {/* Live preview */}
          {minOk && !exceedsLimit && (
            <div style={{ background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.2)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              {isOutward ? (
                <>
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Amount (INR)</span><span style={{ color: '#FAF6F0' }}>{formatINR(amt)}</span></div>
                  {tcsApplies && <div style={S.row}><span style={{ color: '#F39C12', fontSize: '0.85rem' }}>TCS 5% (reclaim in ITR)</span><span style={{ color: '#F39C12' }}>− {formatINR(tcsAmt)}</span></div>}
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Net amount sent</span><span style={{ color: '#FAF6F0' }}>{formatINR(netINR)}</span></div>
                  <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '0.75rem 0' }} />
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>FX Rate</span><span style={{ color: '#FAF6F0' }}>1 CAD = ₹{rate}</span></div>
                  <div style={S.row}>
                    <span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>
                      Commission {(currentCommissionRate * 100).toFixed(2)}%{currentTier ? ` · ${currentTier.label}` : ''}
                    </span>
                    <span style={{ color: '#8BA0B4' }}>− {formatCAD(commissionCAD)}</span>
                  </div>
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>{express ? 'Express flat fee' : 'Flat fee'}</span><span style={{ color: '#8BA0B4' }}>− {formatCAD(flatFee)}</span></div>
                  <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '0.75rem 0' }} />
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Total fees</span><span style={{ color: '#8BA0B4', fontWeight: 600 }}>− {formatCAD(totalFees)}</span></div>
                  <div style={S.row}><span style={{ color: '#E8B86D', fontSize: '0.9rem', fontWeight: 600 }}>You receive (CAD)</span><span style={{ color: '#E8B86D', fontSize: '1.2rem', fontWeight: 700, fontFamily: "'DM Sans'" }}>{formatCAD(amtCAD > 0 ? amtCAD : 0)}</span></div>
                </>
              ) : (
                <>
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Amount you send (CAD)</span><span style={{ color: '#FAF6F0' }}>{formatCAD(amt)}</span></div>
                  {amt > 0 && inwardFee > 0 && (
                    <div style={S.row}>
                      <span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Small-transfer fee</span>
                      <span style={{ color: '#8BA0B4' }}>+ {formatCAD(inwardFee)}</span>
                    </div>
                  )}
                  {amt >= FEE_INWARD_FREE_THRESHOLD && (
                    <div style={S.row}>
                      <span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Fee</span>
                      <span style={{ color: '#27AE60', fontWeight: 600 }}>No fee</span>
                    </div>
                  )}
                  {amt > 0 && inwardFee > 0 && (
                    <div style={S.row}>
                      <span style={{ color: '#FAF6F0', fontSize: '0.85rem', fontWeight: 600 }}>Total to pay</span>
                      <span style={{ color: '#FAF6F0', fontWeight: 600 }}>{formatCAD(inwardTotalCAD)}</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '0.75rem 0' }} />
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>FX Rate</span><span style={{ color: '#FAF6F0' }}>1 CAD = ₹{rate}</span></div>
                  <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '0.75rem 0' }} />
                  <div style={S.row}><span style={{ color: '#E8B86D', fontSize: '0.9rem', fontWeight: 600 }}>You receive (INR)</span><span style={{ color: '#E8B86D', fontSize: '1.2rem', fontWeight: 700, fontFamily: "'DM Sans'" }}>{formatINR(receiveINR)}</span></div>
                </>
              )}
            </div>
          )}

          {/* Speed selector — both directions.
              Backend honours `speed` for outward (real fee service) and inward
              ($5 flat + $10 express surcharge in src/routes/transfers.ts). */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={S.label}>Transfer Speed</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                {
                  key: false,
                  icon: <Clock size={16} />,
                  title: 'Standard',
                  time: isOutward ? '24–48 Hours' : '1–2 Days',
                  fee: isOutward
                    ? `${formatCAD(FEE_FLAT_STD)} flat + 1.8%`
                    : (amt > 0 && amt < FEE_INWARD_FREE_THRESHOLD
                        ? `${formatCAD(FEE_INWARD_SMALL_TXN)} (under ${formatCAD(FEE_INWARD_FREE_THRESHOLD)})`
                        : 'No fee'),
                },
                {
                  key: true,
                  icon: <Zap size={16} />,
                  title: 'Express',
                  time: isOutward ? '8–12 Hours' : '4–8 Hours',
                  fee: isOutward
                    ? `${formatCAD(FEE_FLAT_EXP)} flat + 1.8%`
                    : (amt > 0 && amt < FEE_INWARD_FREE_THRESHOLD
                        ? `${formatCAD(FEE_INWARD_SMALL_TXN)} (under ${formatCAD(FEE_INWARD_FREE_THRESHOLD)})`
                        : 'No fee'),
                },
              ].map(opt => {
                const selected = express === opt.key
                return (
                  <div
                    key={String(opt.key)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    onClick={() => setExpress(opt.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpress(opt.key) } }}
                    style={{
                      border: `2px solid ${selected ? '#C9963A' : 'rgba(201,150,58,0.25)'}`,
                      background: selected ? 'rgba(201,150,58,0.18)' : '#0B1C2C',
                      boxShadow: selected ? '0 0 0 1px rgba(201,150,58,0.35) inset' : 'none',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'border-color 120ms ease, background 120ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: selected ? '#FAF6F0' : '#8BA0B4', marginBottom: '0.4rem' }}>
                      {opt.icon} <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#FAF6F0' }}>{opt.title}</span>
                      {selected && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#C9963A', textTransform: 'uppercase' }}>Selected</span>}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#C9963A' }}>{opt.time}</div>
                    <div style={{ fontSize: '0.78rem', color: '#8BA0B4', marginTop: '0.2rem' }}>{opt.fee}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <button onClick={() => setStep(2)} disabled={!minOk || exceedsLimit}
            style={{ width: '100%', background: minOk && !exceedsLimit ? '#C9963A' : 'rgba(201,150,58,0.3)', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: minOk && !exceedsLimit ? 'pointer' : 'not-allowed' }}>
            Continue →
          </button>
        </div>
      )}

      {/* ── STEP 2: Bank Accounts ── */}
      {step === 2 && (
        <div style={S.card}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Bank Accounts</h2>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>
            Select accounts for this transfer. Verified via Flinks (Canada) and DigiLocker (India).
          </p>

          {/* FROM */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={S.label}>{isOutward ? 'From — India NRO Account' : 'From — Canada Account'}</label>
            {isOutward
              ? hasIndiaBank
                ? <BankCard bank={{ name: user!.indiaBank!.bankName, sub: `${user!.indiaBank!.branch} · NRO Account` }} label="DigiLocker verified" />
                : <ConnectPrompt text="Connect via DigiLocker →" onClick={() => connectBank('/onboarding/india-nro')} />
              : hasCanadaBank
                ? <BankCard bank={{ name: user!.canadaBank!.institution, sub: `${user!.canadaBank!.accountType} · ${user!.canadaBank!.holderName}` }} label="Flinks verified" />
                : <ConnectPrompt text="Connect via Flinks →" onClick={() => connectBank('/onboarding/canada-bank')} />
            }
          </div>

          {/* TO */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={S.label}>{isOutward ? 'To — Canada Account' : 'To — India NRO Account'}</label>
            {isOutward
              ? hasCanadaBank
                ? <BankCard bank={{ name: user!.canadaBank!.institution, sub: `${user!.canadaBank!.accountType} · ${user!.canadaBank!.holderName}` }} label="Flinks verified" />
                : <ConnectPrompt text="Connect via Flinks →" onClick={() => connectBank('/onboarding/canada-bank')} />
              : hasIndiaBank
                ? <BankCard bank={{ name: user!.indiaBank!.bankName, sub: `${user!.indiaBank!.branch} · NRO Account` }} label="DigiLocker verified" />
                : <ConnectPrompt text="Connect via DigiLocker →" onClick={() => connectBank('/onboarding/india-nro')} />
            }
          </div>

          <div style={{ fontSize: '0.78rem', color: '#8BA0B4', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            REPAIHUB never stores your banking credentials. Accounts are verified in real time via Flinks and DigiLocker as required by FINTRAC and RBI.
          </div>

          {!bothBanksOk && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#F39C12', fontSize: '0.82rem' }}>
              <AlertCircle size={14} /> Connect both accounts above to continue
            </div>
          )}

          <button onClick={() => setStep(3)} disabled={!bothBanksOk}
            style={{ width: '100%', background: bothBanksOk ? '#C9963A' : 'rgba(201,150,58,0.3)', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: bothBanksOk ? 'pointer' : 'not-allowed' }}>
            Continue →
          </button>
        </div>
      )}

      {/* ── STEP 3: Review + Purpose ── */}
      {step === 3 && (
        <div style={S.card}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Review Transfer</h2>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>
            {isOutward ? 'Select purpose and review all details.' : 'Review all details before confirming.'}
          </p>

          {/* Purpose — outward only */}
          {isOutward && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={S.label}>Purpose (required for Form 145)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {PURPOSES.map(p => (
                  <div key={p} onClick={() => setPurpose(p)}
                    style={{ border: `1px solid ${purpose === p ? '#C9963A' : 'rgba(201,150,58,0.2)'}`, background: purpose === p ? 'rgba(201,150,58,0.08)' : '#0B1C2C', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${purpose === p ? '#C9963A' : 'rgba(201,150,58,0.3)'}`, background: purpose === p ? '#C9963A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {purpose === p && <Check size={9} color="#0B1C2C" />}
                    </div>
                    <span style={{ fontSize: '0.88rem', color: '#FAF6F0' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div style={{ background: '#0B1C2C', padding: '1.25rem', marginBottom: '1.5rem' }}>
            {([
              ['From', isOutward ? user?.indiaBank?.bankName ?? 'India NRO Account'   : user?.canadaBank?.institution ?? 'Canada Account'],
              ['To',   isOutward ? user?.canadaBank?.institution ?? 'Canada Account'   : user?.indiaBank?.bankName ?? 'India NRO Account'],
              [isOutward ? 'Amount (INR)' : 'Amount (CAD)', isOutward ? formatINR(amt) : formatCAD(amt)],
              tcsApplies ? ['TCS 5% (refundable)', `− ${formatINR(tcsAmt)}`] : null,
              ['FX Rate', `1 CAD = ₹${rate}`],
              [
                'Speed',
                isOutward
                  ? (express ? 'Express (8–12 hrs)' : 'Standard (24–48 hrs)')
                  : (express ? 'Express (4–8 hrs)' : 'Standard (1–2 days)'),
              ],
              isOutward ? [
                `Commission (${(currentCommissionRate * 100).toFixed(2)}%${currentTier ? ' · ' + currentTier.label : ''})`,
                formatCAD(commissionCAD),
              ] : null,
              isOutward ? ['Flat fee', formatCAD(flatFee)] : null,
              (!isOutward && inwardFee > 0) ? ['Small-transfer fee', `+ ${formatCAD(inwardFee)}`] : null,
              (!isOutward && inwardFee === 0) ? ['Fee', 'No fee'] : null,
              (!isOutward && inwardFee > 0) ? ['Total to pay', formatCAD(inwardTotalCAD)] : null,
              (isOutward && purpose) ? ['Purpose', purpose] : null,
            ] as ([string,string]|null)[]).filter(Boolean).map(([k, v]) => (
              <div key={k} style={{ ...S.row, borderBottom: '1px solid rgba(201,150,58,0.1)', paddingBottom: '0.75rem' }}>
                <span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>{k}</span>
                <span style={{ color: k === 'TCS 5% (refundable)' ? '#F39C12' : '#FAF6F0', fontSize: '0.88rem', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ ...S.row, marginTop: '0.5rem', marginBottom: 0, paddingTop: '0.75rem' }}>
              <span style={{ color: '#E8B86D', fontSize: '0.95rem', fontWeight: 600 }}>{isOutward ? 'You receive (CAD)' : 'You receive (INR)'}</span>
              <span style={{ color: '#E8B86D', fontSize: '1.3rem', fontWeight: 700, fontFamily: "'DM Sans'" }}>
                {isOutward ? formatCAD(amtCAD > 0 ? amtCAD : 0) : formatINR(receiveINR)}
              </span>
            </div>
          </div>

          {isOutward && accountType === 'NRO' && (
            <div style={{ background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.2)', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#8BA0B4', lineHeight: 1.6 }}>
              By confirming, you authorise REPAIHUB to file Form 145 on your behalf under IT Act 2025 and engage our CA partner to certify Form 146 (purpose code S0014). This transfer complies with RBI FEMA regulations.
            </div>
          )}

          {/* REQ-07: NRE self-declaration — mandatory before submit */}
          {isOutward && accountType === 'NRE' && (
            <div style={{ background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.25)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={nreDeclaration}
                  onChange={e => setNreDeclaration(e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0, accentColor: '#27AE60' }}
                />
                <span style={{ fontSize: '0.82rem', color: '#8BA0B4', lineHeight: 1.6 }}>
                  I declare that the funds being repatriated are held in my <strong style={{ color: '#FAF6F0' }}>NRE (Non-Resident External)</strong> account, represent income earned outside India, and are freely repatriable under FEMA. No Form 145/146 is required for NRE repatriation. I accept full responsibility for this declaration.
                </span>
              </label>
            </div>
          )}

          {(() => {
            const needsDecl = isOutward && accountType === 'NRE' && !nreDeclaration
            const needsPurpose = isOutward && accountType === 'NRO' && !purpose
            const disabled = needsDecl || needsPurpose
            return (
              <button onClick={() => setStep(4)} disabled={disabled}
                style={{ width: '100%', background: disabled ? 'rgba(201,150,58,0.3)' : '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer' }}>
                Looks Good — Confirm →
              </button>
            )
          })()}
        </div>
      )}

      {/* ── STEP 4: Confirm ── */}
      {step === 4 && (
        <div style={S.card}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Confirm Transfer</h2>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', marginBottom: '2rem' }}>
            {isOutward
              ? `Sending ${formatINR(amt)} from your India NRO account.`
              : `Sending ${formatCAD(amt)} from your Canadian account.`}
          </p>

          <div style={{ textAlign: 'center', padding: '2rem', background: '#0B1C2C', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
            {isOutward ? (
              <>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#E8B86D' }}>{formatINR(amt)}</div>
                <div style={{ color: '#C9963A', margin: '0.35rem 0', fontSize: '1.4rem' }}>→</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#E8B86D' }}>{formatCAD(amtCAD > 0 ? amtCAD : 0)}</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#E8B86D' }}>{formatCAD(amt)}</div>
                <div style={{ color: '#C9963A', margin: '0.35rem 0', fontSize: '1.4rem' }}>→</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#E8B86D' }}>{formatINR(receiveINR)}</div>
              </>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              {/* Inline keyframes — scoped to this widget. The indeterminate
                  bar slides a 40%-wide swatch back and forth across the
                  track every 1.4 s so the customer always sees motion
                  while the API is in flight. The instant the API resolves,
                  progress flips to 100 and we render a full, static bar. */}
              <style>{`
                @keyframes rh-indeterminate {
                  0%   { left: -40%; }
                  100% { left: 100%; }
                }
              `}</style>
              <p style={{ fontSize: '0.9rem', color: '#8BA0B4', marginBottom: '1.5rem', minHeight: '1.2em' }}>{progressMsg}</p>
              <div style={{ height: 8, background: '#0B1C2C', overflow: 'hidden', marginBottom: '0.5rem', position: 'relative' }}>
                {progress < 100 ? (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '-40%',
                      width: '40%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, #C9963A, transparent)',
                      animation: 'rh-indeterminate 1.4s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <div style={{ height: '100%', background: '#C9963A', width: '100%', transition: 'width 0.3s ease' }} />
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#8BA0B4' }}>
                {progress < 100 ? 'Processing…' : '100%'}
              </span>
            </div>
          ) : transferError ? (
            <div>
              <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.4)', padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <AlertCircle size={18} color="#E74C3C" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#E74C3C', marginBottom: '0.25rem' }}>Transfer Failed</div>
                  <div style={{ fontSize: '0.82rem', color: '#FAF6F0' }}>{transferError}</div>
                </div>
              </div>
              <button onClick={handleConfirm}
                style={{ width: '100%', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1.1rem', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Retry →
              </button>
            </div>
          ) : (
            <button onClick={handleConfirm}
              style={{ width: '100%', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '1.1rem', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              🔐 Confirm &amp; Send
            </button>
          )}
        </div>
      )}

      {/* ── STEP 5: Success ── */}
      {step === 5 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 1.5rem', background: 'rgba(39,174,96,0.12)', border: '2px solid rgba(39,174,96,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={32} color="#27AE60" />
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Transfer Initiated!</h2>

          {isOutward ? (
            <>
              <p style={{ fontSize: '0.9rem', color: '#8BA0B4', marginBottom: '0.5rem' }}>Form 145 has been filed. Our CA is reviewing Form 146.</p>
              <p style={{ fontSize: '0.85rem', color: '#C9963A', marginBottom: '2rem' }}>Reference: {txnRef}</p>
              <div style={{ background: '#0B1C2C', padding: '1.25rem', marginBottom: '2rem', textAlign: 'left' }}>
                {[
                  ['Amount',  `${formatINR(amt)} → ${formatCAD(amtCAD > 0 ? amtCAD : 0)}`],
                  ['Rate',    `1 CAD = ₹${rate}`],
                  [
                    'Speed',
                    isOutward
                      ? (express ? 'Express: 8–12 hours' : 'Standard: 24–48 hours')
                      : (express ? 'Express: 4–8 hours' : 'Standard: 1–2 days'),
                  ],
                  ['Status',  'Form 145 Filed — CA Review Pending'],
                ].map(([k, v]) => (
                  <div key={k} style={S.row}>
                    <span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>{k}</span>
                    <span style={{ color: k === 'Status' ? '#3498DB' : '#FAF6F0', fontSize: '0.88rem', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.82rem', color: '#8BA0B4', marginBottom: '2rem', lineHeight: 1.6 }}>
                You'll receive notifications at every step. Our CA will certify Form 146 within {express ? '2–4 hours' : '4–8 hours'}. View your compliance documents in the Compliance section.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.9rem', color: '#8BA0B4', marginBottom: '0.5rem' }}>Your inward transfer is being processed.</p>
              <p style={{ fontSize: '0.85rem', color: '#C9963A', marginBottom: '2rem' }}>Reference: {txnRef}</p>
              <div style={{ background: '#0B1C2C', padding: '1.25rem', marginBottom: '2rem', textAlign: 'left' }}>
                {[
                  ['Amount',  `${formatCAD(amt)} → ${formatINR(receiveINR)}`],
                  ['Rate',    `1 CAD = ₹${rate}`],
                  ['Status',  'Processing'],
                ].map(([k, v]) => (
                  <div key={k} style={S.row}>
                    <span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>{k}</span>
                    <span style={{ color: k === 'Status' ? '#3498DB' : '#FAF6F0', fontSize: '0.88rem', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.82rem', color: '#8BA0B4', marginBottom: '2rem', lineHeight: 1.6 }}>
                Funds will arrive in your India NRO account within 1–3 business days.
              </p>
            </>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
            <button onClick={() => nav('/app/transfer')}
              style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '0.9rem', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Track Transfer
            </button>
            <button onClick={() => nav('/app/dashboard')}
              style={{ background: 'transparent', border: '1px solid rgba(201,150,58,0.3)', color: '#C9963A', padding: '0.85rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Form 15CA Part A self-declaration modal — appears at Step-4 confirm
          when the customer is sending a sub-₹5L outward transfer.  Returns
          form data straight into submitTransfer() which attaches it to the
          API payload so the backend can mark the transfer 'completed'
          without a CA-queue round-trip. */}

      {/* Form 15CA Part A self-declaration modal — appears at Step-4 confirm
          when the customer is sending a sub-₹5L outward transfer.  Returns
          form data straight into submitTransfer() which attaches it to the
          API payload so the backend can mark the transfer 'completed'
          without a CA-queue round-trip. */}
      <Form15CAPartAModal
        open={show15CA}
        amountInr={amt}
        amountCad={amtCAD > 0 ? amtCAD : 0}
        exchangeRate={rate}
        purposeCode={isOutward ? (accountType === 'NRE' ? 'P1302' : (PURPOSE_CODES[purpose] ?? 'S0014')) : 'S0014'}
        remitterName={user?.name ?? ''}
        remitterPAN={(user as { pan?: string | null } | null | undefined)?.pan ?? null}
        remitterEmail={user?.email ?? ''}
        remitterPhone={user?.phone ?? ''}
        beneficiaryName={user?.canadaBank?.holderName ?? user?.name ?? ''}
        aggregateFyRemittanceInr={aggregateOutwardFyInr()}
        onSubmit={submitTransfer}
        onCancel={() => setShow15CA(false)}
      />
    </div>
  )
}
