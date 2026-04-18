import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore, mapDbTransfer } from '../../store/useStore'
import { apiGetTransfers } from '../../lib/api'
import { formatINR, formatCAD, formatDate, statusLabel, statusColor } from '../../lib/utils'
import { ArrowLeft, Check, Clock, AlertCircle } from 'lucide-react'

const ALL_STATUSES = [
  'INITIATED', 'KYC_VERIFIED', '15CA_FILED', '15CB_CERTIFIED',
  'BANK_PROCESSING', 'SWIFT_SENT', 'COMPLETED',
]

export default function TransferDetail() {
  const { id } = useParams()
  const { transfers, updateTransfer, isAuthenticated } = useStore()
  const nav = useNavigate()
  const t = transfers.find(x => x.id === id)

  useEffect(() => {
    if (!id || !isAuthenticated) return
    apiGetTransfers().then(ts => {
      const found = ts.find((x: { id: string }) => x.id === id)
      if (found) updateTransfer(id, mapDbTransfer(found))
    }).catch(() => {})
  }, [id, isAuthenticated])

  if (!t) return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <p style={{ color: '#8BA0B4' }}>Transfer not found.</p>
      <button onClick={() => nav('/app/transfer')} style={{ marginTop: '1rem', background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '0.75rem 1.5rem', cursor: 'pointer' }}>← Back</button>
    </div>
  )

  const currentIdx = ALL_STATUSES.indexOf(t.status)
  const isFailed = t.status === 'FAILED'

  const S = {
    page:  { padding: '2rem', maxWidth: 760, margin: '0 auto' },
    sLabel:{ fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#C9963A', display: 'block', marginBottom: '0.5rem' },
    card:  { background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem', marginBottom: '1.5rem' },
    row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.9rem' },
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => nav('/app/transfer')} style={{ background: 'none', border: 'none', color: '#8BA0B4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <span style={S.sLabel}>Transfer Details</span>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>{t.id}</h1>
        </div>
      </div>

      {/* Status header */}
      <div style={{ background: isFailed ? 'rgba(231,76,60,0.08)' : 'rgba(201,150,58,0.06)', border: `1px solid ${isFailed ? 'rgba(231,76,60,0.3)' : 'rgba(201,150,58,0.2)'}`, padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            {isFailed ? <AlertCircle size={20} color="#E74C3C" /> : t.status === 'COMPLETED' ? <Check size={20} color="#27AE60" /> : <Clock size={20} color="#F39C12" />}
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: statusColor[t.status] }}>{statusLabel[t.status]}</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#8BA0B4' }}>
            {t.status === 'COMPLETED' ? 'Funds delivered to your Canadian account' :
             isFailed ? 'Transfer failed — contact support' :
             'Transfer in progress — you will be notified at each step'}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: '#E8B86D', lineHeight: 1 }}>{formatCAD(t.amountCAD)}</div>
          <div style={{ fontSize: '0.8rem', color: '#8BA0B4' }}>{formatINR(t.amountINR)} → CAD</div>
        </div>
      </div>

      {/* Progress tracker */}
      {!isFailed && (
        <div style={S.card}>
          <span style={S.sLabel}>Transfer Progress</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {ALL_STATUSES.map((status, idx) => {
              const done  = currentIdx > idx || t.status === 'COMPLETED'
              const active = currentIdx === idx && t.status !== 'COMPLETED'
              const event  = t.events.find(e => e.status === status)
              return (
                <div key={status} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', paddingBottom: idx < ALL_STATUSES.length - 1 ? '1rem' : 0 }}>
                  {/* Dot + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      background: done ? 'rgba(39,174,96,0.15)' : active ? 'rgba(201,150,58,0.15)' : 'rgba(255,255,255,0.04)',
                      border: done ? '1px solid rgba(39,174,96,0.5)' : active ? '1px solid #C9963A' : '1px solid rgba(201,150,58,0.2)',
                      color: done ? '#27AE60' : active ? '#C9963A' : '#8BA0B4',
                    }}>
                      {done ? <Check size={14} /> : idx + 1}
                    </div>
                    {idx < ALL_STATUSES.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 20, background: done ? 'rgba(39,174,96,0.3)' : 'rgba(201,150,58,0.15)', margin: '4px 0' }} />
                    )}
                  </div>
                  {/* Text */}
                  <div style={{ paddingTop: '0.2rem', paddingBottom: idx < ALL_STATUSES.length - 1 ? '0.75rem' : 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: done ? '#FAF6F0' : active ? '#FAF6F0' : '#8BA0B4', marginBottom: '0.15rem' }}>{statusLabel[status]}</div>
                    {event ? (
                      <>
                        <div style={{ fontSize: '0.78rem', color: '#8BA0B4' }}>{event.note}</div>
                        <div style={{ fontSize: '0.72rem', color: '#8BA0B4', marginTop: '0.2rem', opacity: 0.7 }}>{formatDate(event.timestamp)}</div>
                      </>
                    ) : active ? (
                      <div style={{ fontSize: '0.78rem', color: '#C9963A' }}>In progress…</div>
                    ) : !done ? (
                      <div style={{ fontSize: '0.78rem', color: '#8BA0B4' }}>Pending</div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transfer details */}
      <div style={S.card}>
        <span style={S.sLabel}>Transfer Details</span>
        {[
          ['Transfer ID', t.id],
          ['Reference', t.reference],
          ['Date Initiated', formatDate(t.date)],
          ['Amount (INR)', formatINR(t.amountINR)],
          ['Amount (CAD)', formatCAD(t.amountCAD)],
          ['FX Rate', `1 CAD = ₹${t.rate}`],
          ['Fee', formatCAD(t.fee)],
          ['Speed', t.express ? 'Express (8–12 hours)' : 'Standard (24–48 hours)'],
        ].map(([k, v]) => (
          <div key={k} style={{ ...S.row, borderBottom: '1px solid rgba(201,150,58,0.1)', paddingBottom: '0.75rem' }}>
            <span style={{ color: '#8BA0B4', fontSize: '0.85rem' }}>{k}</span>
            <span style={{ color: '#FAF6F0', fontWeight: 500, fontSize: '0.88rem' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* FINTRAC Note */}
      {parseFloat(formatCAD(t.amountCAD).replace(/[^0-9.]/g, '')) >= 10000 && (
        <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.2)', borderLeft: '3px solid #3498DB', padding: '1.25rem 1.5rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3498DB', display: 'block', marginBottom: '0.4rem' }}>FINTRAC Report Filed</span>
          <p style={{ fontSize: '0.85rem', color: '#8BA0B4', lineHeight: 1.6, margin: 0 }}>
            This transfer exceeded CAD $10,000. A Large Cash Transaction Report has been automatically submitted to FINTRAC as required by Canadian law. This is completely normal and legal — it is not a flag on your account.
          </p>
        </div>
      )}
    </div>
  )
}
