import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, mapDbTransfer } from '../../store/useStore'
import { apiCreateTransfer } from '../../lib/api'
import { formatINR, formatCAD, generateRef, sleep } from '../../lib/utils'
import { Check, AlertCircle, Zap, Clock, ArrowLeft, ArrowLeftRight, Building2 } from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5
type Direction = 'outward' | 'inward'

// Tiered commission — larger transfers pay less % (same logic as Wise/WU)
const FEE_TIERS = [
  { minINR: 5_000_000, rate: 0.010, label: '₹50L+',       pct: '1.0%' },
  { minINR: 2_000_000, rate: 0.014, label: '₹20L – ₹50L', pct: '1.4%' },
  { minINR:         0, rate: 0.018, label: '₹6L – ₹20L',  pct: '1.8%' },
]
function getTier(amtINR: number) { return FEE_TIERS.find(t => amtINR >= t.minINR) ?? FEE_TIERS[FEE_TIERS.length - 1] }

const FEE_FLAT_STD   = 24.99   // standard flat fee CAD
const FEE_FLAT_EXP   = 49.99   // express flat fee (incl. $25 surcharge)
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
const PURPOSE_CODES: Record<string, string> = {
  'Repatriation of savings': 'P1301',
  'Rental income':           'P1301',
  'Pension / salary':        'P1301',
  'Property sale proceeds':  'P1301',
  'Investment returns':      'P0001',
  'Family maintenance':      'P1101',
  'Other':                   'P1301',
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

export default function NewTransfer() {
  const { user, fxRate, addTransfer, addNotification } = useStore()
  const nav = useNavigate()

  const [step, setStep]               = useState<Step>(1)
  const [direction, setDirection]     = useState<Direction>('outward')
  const [amount, setAmount]           = useState('')
  const [express, setExpress]         = useState(false)
  const [purpose, setPurpose]         = useState('')
  const [loading, setLoading]         = useState(false)
  const [txnRef, setTxnRef]           = useState('')
  const [progress, setProgress]       = useState(0)
  const [progressMsg, setProgressMsg] = useState('')

  const isOutward = direction === 'outward'
  const rate      = fxRate || 83
  const amt       = parseFloat(amount.replace(/,/g, '')) || 0

  const amtINR        = isOutward ? amt : amt * rate
  const flatFee       = express ? FEE_FLAT_EXP : FEE_FLAT_STD
  const tcsApplies    = isOutward && amtINR > TCS_THRESHOLD_INR
  const tcsAmt        = tcsApplies ? amtINR * 0.05 : 0
  const netINR        = amtINR - tcsAmt
  const grossCAD      = isOutward ? netINR / rate : amt
  const tier          = getTier(amtINR)
  const commissionCAD = isOutward ? Math.round(grossCAD * tier.rate * 100) / 100 : 0
  const totalFees     = commissionCAD + flatFee
  const amtCAD        = isOutward ? Math.max(0, grossCAD - totalFees) : amt
  const receiveINR    = isOutward ? 0 : amt * rate

  const limitRemaining = (user?.annualLimitTotal || 83000) - (user?.annualLimitUsed || 0)
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

  async function handleConfirm() {
    setLoading(true)
    const ref = generateRef()
    setTxnRef(ref)

    const progressSteps: [number, string][] = isOutward ? [
      [15,  'Verifying KYC tokens…'],
      [30,  `Locking FX rate at ₹${rate}…`],
      [50,  'Generating Form 145 XML…'],
      [70,  'Filing with IT portal…'],
      [85,  'Assigning CA for Form 146…'],
      [100, 'Transfer initiated!'],
    ] : [
      [20,  'Verifying FINTRAC compliance…'],
      [50,  'Processing CAD withdrawal…'],
      [80,  'Routing to India NRO account…'],
      [100, 'Transfer initiated!'],
    ]

    for (const [pct, msg] of progressSteps) {
      await sleep(600)
      setProgress(pct)
      setProgressMsg(msg)
    }

    const now = new Date().toISOString()
    try {
      const transfer = await apiCreateTransfer({
        amountInr:     isOutward ? amt : receiveINR,
        amountCad:     isOutward ? amtCAD : amt,
        amountFrom:    isOutward ? amt : amt,   // INR for outward, CAD for inward
        exchangeRate:  rate,
        feeCad:        isOutward ? fee : 0,
        purposeCode:   isOutward ? (PURPOSE_CODES[purpose] ?? 'P1301') : 'P1301',
        sourceOfFunds: isOutward ? (SOURCE_OF_FUNDS[purpose] ?? 'other') : 'other',
        speed:         express ? 'express' : 'standard',
        reference:     ref,
        direction,
      })
      addTransfer(mapDbTransfer(transfer))
      const msg = isOutward
        ? `Transfer initiated — ₹${amt.toLocaleString('en-IN')} → ${formatCAD(amtCAD)}. CA reviewing Form 146.`
        : `Inward transfer initiated — ${formatCAD(amt)} → ₹${Math.round(receiveINR).toLocaleString('en-IN')}.`
      addNotification({ message: msg, type: 'info', timestamp: now })
    } catch {
      addTransfer({
        id:        'TXN-' + Date.now(),
        date:      now,
        amountINR: isOutward ? amt : receiveINR,
        amountCAD: isOutward ? amtCAD : amt,
        rate,
        fee:       isOutward ? fee : 0,
        status:    '15CA_FILED',
        express,
        reference: ref,
        events:    [{ status: 'INITIATED', timestamp: now, note: 'Transfer initiated' }],
      })
    }
    setLoading(false)
    setStep(5)
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
        <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>{isOutward ? 'NRO Account (INR)' : 'Chequing Account (CAD)'}</div>
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
            {isOutward ? `Minimum ₹10,000 · Annual limit: ${formatCAD(limitRemaining)} remaining` : 'Minimum CAD 100'}
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
                  {/* Tier pricing table */}
                  <div style={{ background: '#0B1C2C', border: '1px solid rgba(201,150,58,0.15)', padding: '0.65rem 0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8BA0B4', marginBottom: '0.4rem' }}>Tiered Commission</div>
                    {FEE_TIERS.map(t => (
                      <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0', color: t.label === tier.label ? '#E8B86D' : '#8BA0B4', fontWeight: t.label === tier.label ? 700 : 400 }}>
                        <span>{t.label}</span>
                        <span>{t.pct}{t.label === tier.label ? ' ← your tier' : ''}</span>
                      </div>
                    ))}
                  </div>
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Commission ({tier.pct})</span><span style={{ color: '#8BA0B4' }}>− {formatCAD(commissionCAD)}</span></div>
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>{express ? 'Express flat fee' : 'Flat fee'}</span><span style={{ color: '#8BA0B4' }}>− {formatCAD(flatFee)}</span></div>
                  <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '0.75rem 0' }} />
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Total fees</span><span style={{ color: '#8BA0B4', fontWeight: 600 }}>− {formatCAD(totalFees)}</span></div>
                  <div style={S.row}><span style={{ color: '#E8B86D', fontSize: '0.9rem', fontWeight: 600 }}>You receive (CAD)</span><span style={{ color: '#E8B86D', fontSize: '1.2rem', fontWeight: 700, fontFamily: "'DM Sans'" }}>{formatCAD(amtCAD > 0 ? amtCAD : 0)}</span></div>
                </>
              ) : (
                <>
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>Amount (CAD)</span><span style={{ color: '#FAF6F0' }}>{formatCAD(amt)}</span></div>
                  <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '0.75rem 0' }} />
                  <div style={S.row}><span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>FX Rate</span><span style={{ color: '#FAF6F0' }}>1 CAD = ₹{rate}</span></div>
                  <div style={{ height: 1, background: 'rgba(201,150,58,0.2)', margin: '0.75rem 0' }} />
                  <div style={S.row}><span style={{ color: '#E8B86D', fontSize: '0.9rem', fontWeight: 600 }}>You receive (INR)</span><span style={{ color: '#E8B86D', fontSize: '1.2rem', fontWeight: 700, fontFamily: "'DM Sans'" }}>{formatINR(receiveINR)}</span></div>
                </>
              )}
            </div>
          )}

          {/* Speed — outward only */}
          {isOutward && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={S.label}>Transfer Speed</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { key: false, icon: <Clock size={16} />, title: 'Standard', time: '24–48 Hours', fee: `${formatCAD(FEE_FLAT_STD)} flat + ${tier.pct}` },
                  { key: true,  icon: <Zap size={16} />,   title: 'Express',  time: '8–12 Hours',  fee: `${formatCAD(FEE_FLAT_EXP)} flat + ${tier.pct}` },
                ].map(opt => (
                  <div key={String(opt.key)} onClick={() => setExpress(opt.key)}
                    style={{ border: `1px solid ${express === opt.key ? '#C9963A' : 'rgba(201,150,58,0.2)'}`, background: express === opt.key ? 'rgba(201,150,58,0.08)' : '#0B1C2C', padding: '1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8BA0B4', marginBottom: '0.4rem' }}>
                      {opt.icon} <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#FAF6F0' }}>{opt.title}</span>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#C9963A' }}>{opt.time}</div>
                    <div style={{ fontSize: '0.78rem', color: '#8BA0B4', marginTop: '0.2rem' }}>{opt.fee}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                : <ConnectPrompt text="Connect via DigiLocker →" onClick={() => nav('/onboarding/india-nro')} />
              : hasCanadaBank
                ? <BankCard bank={{ name: user!.canadaBank!.institution, sub: `${user!.canadaBank!.accountType} · ${user!.canadaBank!.holderName}` }} label="Flinks verified" />
                : <ConnectPrompt text="Connect via Flinks →" onClick={() => nav('/onboarding/canada-bank')} />
            }
          </div>

          {/* TO */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={S.label}>{isOutward ? 'To — Canada Account' : 'To — India NRO Account'}</label>
            {isOutward
              ? hasCanadaBank
                ? <BankCard bank={{ name: user!.canadaBank!.institution, sub: `${user!.canadaBank!.accountType} · ${user!.canadaBank!.holderName}` }} label="Flinks verified" />
                : <ConnectPrompt text="Connect via Flinks →" onClick={() => nav('/onboarding/canada-bank')} />
              : hasIndiaBank
                ? <BankCard bank={{ name: user!.indiaBank!.bankName, sub: `${user!.indiaBank!.branch} · NRO Account` }} label="DigiLocker verified" />
                : <ConnectPrompt text="Connect via DigiLocker →" onClick={() => nav('/onboarding/india-nro')} />
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
              isOutward ? ['Speed', express ? 'Express (8–12 hrs)' : 'Standard (24–48 hrs)'] : null,
              isOutward ? [`Commission (${tier.pct} — ${tier.label})`, formatCAD(commissionCAD)] : null,
              isOutward ? ['Flat fee', formatCAD(flatFee)] : null,
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

          {isOutward && (
            <div style={{ background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.2)', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#8BA0B4', lineHeight: 1.6 }}>
              By confirming, you authorise REPAIHUB to file Form 145 on your behalf under IT Act 2025 and engage our CA partner to certify Form 146. This transfer complies with RBI FEMA regulations.
            </div>
          )}

          <button onClick={() => setStep(4)} disabled={isOutward && !purpose}
            style={{ width: '100%', background: isOutward && !purpose ? 'rgba(201,150,58,0.3)' : '#C9963A', color: '#0B1C2C', border: 'none', padding: '1rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: isOutward && !purpose ? 'not-allowed' : 'pointer' }}>
            Looks Good — Confirm →
          </button>
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
              <p style={{ fontSize: '0.9rem', color: '#8BA0B4', marginBottom: '1.5rem' }}>{progressMsg}</p>
              <div style={{ height: 8, background: '#0B1C2C', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ height: '100%', background: '#C9963A', width: `${progress}%`, transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontSize: '0.78rem', color: '#8BA0B4' }}>{progress}%</span>
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
                  ['Speed',   express ? 'Express: 8–12 hours' : 'Standard: 24–48 hours'],
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
    </div>
  )
}
