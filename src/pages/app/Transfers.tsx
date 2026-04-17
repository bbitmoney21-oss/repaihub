import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { mapApiTransfer } from '../../store/useStore'
import { apiGetTransfers } from '../../lib/api'
import { formatINR, formatCAD, formatDate, statusLabel, statusColor } from '../../lib/utils'
import { Plus, ChevronRight, Search } from 'lucide-react'

export default function Transfers() {
  const { transfers, setTransfers, token } = useStore()
  const nav = useNavigate()

  useEffect(() => {
    if (!token) return
    apiGetTransfers().then(r => setTransfers(r.data.transfers.map(mapApiTransfer))).catch(() => {})
  }, [token])
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [search, setSearch] = useState('')

  const filtered = transfers.filter(t => {
    const matchFilter = filter === 'all' ? true :
      filter === 'active' ? !['COMPLETED', 'FAILED'].includes(t.status) :
      t.status === 'COMPLETED'
    const matchSearch = !search || t.id.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const S = {
    page:  { padding: '2rem', maxWidth: 900, margin: '0 auto' },
    sLabel:{ fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#C9963A', display: 'block', marginBottom: '0.5rem' },
  }

  const statusDot = (status: string) => (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[status] || '#8BA0B4', display: 'inline-block', marginRight: '0.4rem' }} />
  )

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={S.sLabel}>Transfer History</span>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 600, color: '#FFFFFF' }}>All Transfers</h1>
        </div>
        <button onClick={() => nav('/app/new-transfer')}
          style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '0.75rem 1.5rem', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={14} /> New Transfer
        </button>
      </div>

      {/* Filters + search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all','active','completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background: filter === f ? '#C9963A' : 'transparent', color: filter === f ? '#0B1C2C' : '#8BA0B4', border: `1px solid ${filter === f ? '#C9963A' : 'rgba(201,150,58,0.2)'}`, padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}>
              {f === 'all' ? `All (${transfers.length})` : f === 'active' ? `Active (${transfers.filter(t => !['COMPLETED','FAILED'].includes(t.status)).length})` : `Done (${transfers.filter(t => t.status === 'COMPLETED').length})`}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8BA0B4' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID…"
            className="input-field" style={{ display: 'block', paddingLeft: '2.2rem', width: 200, fontSize: '0.85rem' }} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#132233', border: '1px solid rgba(201,150,58,0.2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💸</div>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#FFFFFF', marginBottom: '0.5rem' }}>No transfers yet</h3>
          <p style={{ fontSize: '0.9rem', color: '#8BA0B4', marginBottom: '2rem' }}>Your NRO to CAD transfers will appear here</p>
          <button onClick={() => nav('/app/new-transfer')}
            style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '0.85rem 2rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            Send Your First Transfer →
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid rgba(201,150,58,0.2)' }}>
          {/* Header row */}
          <div style={{ background: '#132233', padding: '0.75rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '1rem', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4' }}>
            <span>Transfer ID</span><span>Date</span><span>Amount INR</span><span>Amount CAD</span><span>Status</span><span/>
          </div>
          {filtered.map((t, i) => (
            <div key={t.id}
              onClick={() => nav(`/app/transfer/${t.id}`)}
              style={{ background: i % 2 === 0 ? '#0B1C2C' : '#091826', padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s', borderTop: '1px solid rgba(201,150,58,0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#132233')}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#0B1C2C' : '#091826')}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FAF6F0' }}>{t.id}</div>
                {t.express && <span style={{ fontSize: '0.65rem', background: 'rgba(201,150,58,0.15)', color: '#C9963A', padding: '0.15rem 0.4rem', borderRadius: 2, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Express</span>}
              </div>
              <span style={{ fontSize: '0.82rem', color: '#8BA0B4' }}>{formatDate(t.date)}</span>
              <span style={{ fontSize: '0.9rem', color: '#FAF6F0', fontFamily: "'DM Sans'" }}>{formatINR(t.amountINR)}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#E8B86D', fontFamily: "'DM Sans'" }}>{formatCAD(t.amountCAD)}</span>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600, color: statusColor[t.status] }}>
                {statusDot(t.status)}{statusLabel[t.status]}
              </div>
              <ChevronRight size={16} color="#8BA0B4" />
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '1px', background: 'rgba(201,150,58,0.2)', border: '1px solid rgba(201,150,58,0.2)', marginTop: '1.5rem' }}>
          {[
            { label: 'Total Transfers', value: String(transfers.length) },
            { label: 'Total CAD Received', value: formatCAD(transfers.filter(t => t.status === 'COMPLETED').reduce((a,t) => a+t.amountCAD, 0)) },
            { label: 'Total INR Sent', value: formatINR(transfers.filter(t => t.status === 'COMPLETED').reduce((a,t) => a+t.amountINR, 0)) },
            { label: 'Total Fees Paid', value: formatCAD(transfers.filter(t => t.status === 'COMPLETED').reduce((a,t) => a+t.fee, 0)) },
          ].map(s => (
            <div key={s.label} style={{ background: '#132233', padding: '1.25rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.3rem' }}>{s.label}</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FAF6F0', fontFamily: "'DM Sans'" }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
