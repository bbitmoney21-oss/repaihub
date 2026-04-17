import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { mapApiTransfer } from '../../store/useStore'
import { apiGetTransfers, apiGetProfile } from '../../lib/api'
import { formatCAD, formatDateShort, statusLabel, statusColor, residencyLabels } from '../../lib/utils'
import { ArrowRight, TrendingUp, Plus } from 'lucide-react'

export default function Dashboard() {
  const { user, transfers, fxRate, setTransfers, setAuth, token } = useStore()
  const nav = useNavigate()

  useEffect(() => {
    if (!token) return
    apiGetTransfers().then(r => setTransfers(r.data.transfers.map(mapApiTransfer))).catch(() => {})
    apiGetProfile().then(r => {
      const u = r.data.user
      setAuth(token, { id: u.id, email: u.email, residency: u.residency, status: u.status })
    }).catch(() => {})
  }, [token])
  const recent = transfers.slice(0, 3)
  const limitPct = user ? (user.annualLimitUsed / user.annualLimitTotal) * 100 : 0
  const limitRemaining = user ? user.annualLimitTotal - user.annualLimitUsed : 0

  const totalCAD = transfers.filter(t => t.status === 'COMPLETED').reduce((a, t) => a + t.amountCAD, 0)
  const thisYear = transfers.filter(t => t.status === 'COMPLETED' && t.date.startsWith('2026')).length

  const S = {
    page:    { padding: '2rem', maxWidth: 1100, margin: '0 auto' } as React.CSSProperties,
    sLabel:  { fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#C9963A', marginBottom: '0.5rem', display: 'block' },
    card:    { background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem' } as React.CSSProperties,
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <span style={S.sLabel}>Dashboard</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.3rem' }}>
          Welcome back, <em style={{ fontStyle: 'normal', color: '#E8B86D' }}>{user?.name?.split(' ')[0] || 'Raj'}</em>
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#8BA0B4' }}>
          {residencyLabels[user?.residencyStatus || ''] || 'Canadian Citizen'} &nbsp;·&nbsp; {user?.canadaBank?.institution} &nbsp;·&nbsp; {user?.indiaBank?.bankName}
        </p>
      </div>

      {/* FX Rate Banner */}
      <div style={{ background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.2)', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TrendingUp color="#C9963A" size={20} />
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4' }}>Live FX Rate</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#E8B86D', fontFamily: "'DM Sans'", lineHeight: 1.1 }}>
              1 CAD = ₹{fxRate.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>|</div>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4' }}>₹1,00,000 =</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FAF6F0', lineHeight: 1.1 }}>
              {formatCAD(100000 / fxRate)}
            </div>
          </div>
        </div>
        <button onClick={() => nav('/app/new-transfer')}
          style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', padding: '0.75rem 1.5rem', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <Plus size={14} /> New Transfer
        </button>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '1px', background: 'rgba(201,150,58,0.2)', border: '1px solid rgba(201,150,58,0.2)', marginBottom: '2rem' }}>
        {[
          { label: 'Total Transferred', value: formatCAD(totalCAD), sub: 'All time — CAD', icon: '💰' },
          { label: 'This Year', value: `${thisYear} transfers`, sub: '2026 financial year', icon: '📅' },
          { label: 'Annual Limit Used', value: formatCAD(user?.annualLimitUsed || 0), sub: `of ${formatCAD(user?.annualLimitTotal || 83000)}`, icon: '📊' },
          { label: 'Limit Remaining', value: formatCAD(limitRemaining), sub: `${(100 - limitPct).toFixed(0)}% available`, icon: '✅' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#132233', padding: '1.5rem', transition: 'background 0.2s' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.4rem' }}>{stat.label}</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#FAF6F0', lineHeight: 1, marginBottom: '0.25rem', fontFamily: "'DM Sans'" }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Annual limit progress */}
      <div style={{ ...S.card, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={S.sLabel}>Annual RBI Limit — FY 2026</span>
            <div style={{ fontSize: '0.9rem', color: '#FAF6F0' }}>
              {formatCAD(user?.annualLimitUsed || 0)} used of {formatCAD(user?.annualLimitTotal || 83000)}
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: limitPct > 80 ? '#F39C12' : '#27AE60', fontWeight: 500 }}>
            {limitPct.toFixed(1)}% used
          </div>
        </div>
        <div style={{ height: 10, background: '#0B1C2C', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${limitPct}%`, background: limitPct > 80 ? '#F39C12' : '#C9963A', borderRadius: 5, transition: 'width 1s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: '#8BA0B4' }}>₹0</span>
          <span style={{ fontSize: '0.72rem', color: '#8BA0B4' }}>USD 1M (≈ CAD {formatCAD(user?.annualLimitTotal || 83000)})</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px,1fr))', gap: '1.5rem' }}>

        {/* Recent Transfers */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={S.sLabel}>Recent Transfers</span>
            <button onClick={() => nav('/app/transfer')} style={{ fontSize: '0.78rem', color: '#C9963A', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          {recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#8BA0B4', fontSize: '0.85rem' }}>
              No transfers yet.<br/>
              <button onClick={() => nav('/app/new-transfer')} style={{ marginTop: '1rem', background: 'none', border: '1px solid rgba(201,150,58,0.3)', color: '#C9963A', padding: '0.5rem 1rem', fontSize: '0.78rem', cursor: 'pointer' }}>Start your first transfer</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(201,150,58,0.1)' }}>
              {recent.map(t => (
                <div key={t.id} onClick={() => nav(`/app/transfer/${t.id}`)}
                  style={{ background: '#0B1C2C', padding: '1rem', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#132233')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#0B1C2C')}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#FAF6F0', marginBottom: '0.2rem' }}>{t.id}</div>
                    <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>{formatDateShort(t.date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FAF6F0' }}>{formatCAD(t.amountCAD)}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: statusColor[t.status] }}>
                      {statusLabel[t.status]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <span style={{ ...S.sLabel, marginBottom: '1rem' }}>Quick Actions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { icon: '💸', title: 'Send Money', desc: 'New NRO to CAD transfer', action: () => nav('/app/new-transfer'), primary: true },
              { icon: '📋', title: 'Track Transfer', desc: 'Live status on your transfer', action: () => nav('/app/transfer'), primary: false },
              { icon: '🛡', title: 'Compliance Centre', desc: 'FINTRAC, forms, limits', action: () => nav('/app/compliance'), primary: false },
              { icon: '📊', title: 'Tax Report', desc: 'Download annual summary', action: () => nav('/app/settings'), primary: false },
            ].map(item => (
              <div key={item.title} onClick={item.action}
                style={{ ...S.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', transition: 'background 0.2s', border: item.primary ? '1px solid rgba(201,150,58,0.4)' : '1px solid rgba(201,150,58,0.2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1C3147')}
                onMouseLeave={e => (e.currentTarget.style.background = '#132233')}>
                <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#FAF6F0', fontSize: '0.9rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8BA0B4', marginTop: '0.1rem' }}>{item.desc}</div>
                </div>
                <ArrowRight size={16} color="#8BA0B4" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CA Note */}
      <div style={{ marginTop: '2rem', background: 'rgba(201,150,58,0.04)', border: '1px solid rgba(201,150,58,0.2)', borderLeft: '3px solid #C9963A', padding: '1.25rem 1.5rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', display: 'block', marginBottom: '0.4rem' }}>How Your Transfer Works</span>
        <p style={{ fontSize: '0.85rem', color: '#8BA0B4', lineHeight: 1.7, margin: 0 }}>
          Every REPAIHUB transfer goes through our state machine: Initiate → KYC Check → Form 15CA filed → CA certifies 15CB → Bank processes → SWIFT → CAD in your account. You'll get a push notification at every step. Standard: 24–48 hours. Express: 8–12 hours.
        </p>
      </div>
    </div>
  )
}
