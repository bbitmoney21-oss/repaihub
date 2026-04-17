import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { formatDate, residencyLabels } from '../../lib/utils'
import { Check, Bell, Download, LogOut, Shield, User } from 'lucide-react'

export default function AppSettings() {
  const { user, notifications, logout, markNotificationRead } = useStore()
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'tax' | 'security'>('profile')

  const unread = notifications.filter(n => !n.read).length

  const handleLogout = () => { logout(); nav('/') }

  const S = {
    page:   { padding: '2rem', maxWidth: 800, margin: '0 auto' },
    sLabel: { fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#C9963A', display: 'block', marginBottom: '0.5rem' },
    card:   { background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem', marginBottom: '1.5rem' },
    label:  { fontSize: '0.75rem', fontWeight: 600 as const, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8BA0B4', display: 'block', marginBottom: '0.5rem' },
    row:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 0', borderBottom: '1px solid rgba(201,150,58,0.1)', fontSize: '0.9rem' },
  }

  const tabs = [
    { id: 'profile',       label: 'Profile',       icon: User,    badge: 0 },
    { id: 'notifications', label: 'Notifications', icon: Bell,    badge: unread },
    { id: 'tax',           label: 'Tax Reports',   icon: Download, badge: 0 },
    { id: 'security',      label: 'Security',      icon: Shield,  badge: 0 },
  ]

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '2rem' }}>
        <span style={S.sLabel}>Account</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 600, color: '#FFFFFF' }}>Settings</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '2rem', borderBottom: '1px solid rgba(201,150,58,0.2)', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{ background: 'none', border: 'none', padding: '0.85rem 1.25rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', borderBottom: activeTab === tab.id ? '2px solid #C9963A' : '2px solid transparent', color: activeTab === tab.id ? '#E8B86D' : '#8BA0B4', transition: 'color 0.2s', marginBottom: -1 }}>
            <tab.icon size={15} />
            {tab.label}
            {tab.badge > 0 && <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#C9963A', color: '#0B1C2C', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <>
          <div style={S.card}>
            <span style={S.sLabel}>Personal Information</span>
            {[
              ['Full Name', user?.name || '—'],
              ['Email', user?.email || '—'],
              ['Phone', user?.phone || 'Not set'],
              ['Residency Status', residencyLabels[user?.residencyStatus || ''] || '—'],
            ].map(([k, v]) => (
              <div key={k} style={S.row}>
                <span style={{ color: '#8BA0B4' }}>{k}</span>
                <span style={{ color: '#FAF6F0', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <span style={S.sLabel}>KYC Verification</span>
            {[
              ['Canadian Bank', user?.canadaBank?.institution || '—', user?.canadaBankVerified],
              ['Indian NRO Bank', user?.indiaBank?.bankName || '—', user?.indiaNROVerified],
            ].map(([k, v, ok]) => (
              <div key={k as string} style={S.row}>
                <div>
                  <span style={{ color: '#8BA0B4' }}>{k as string}</span>
                  <div style={{ fontSize: '0.8rem', color: '#FAF6F0', marginTop: '0.1rem' }}>{v as string}</div>
                </div>
                <span style={{ color: ok ? '#27AE60' : '#E74C3C', fontWeight: 600, fontSize: '0.82rem' }}>{ok ? '✓ Verified' : '✗ Not verified'}</span>
              </div>
            ))}
            {user?.kycCompletedAt && (
              <div style={{ fontSize: '0.78rem', color: '#8BA0B4', marginTop: '0.75rem' }}>KYC completed {formatDate(user.kycCompletedAt)}</div>
            )}
          </div>

          <div style={S.card}>
            <span style={S.sLabel}>Account Actions</span>
            <button onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', background: 'transparent', border: '1px solid rgba(231,76,60,0.3)', color: '#E74C3C', padding: '0.85rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(231,76,60,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <LogOut size={16} /> Sign Out of REPAIHUB
            </button>
          </div>
        </>
      )}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={S.sLabel}>Notifications</span>
            {unread > 0 && (
              <button onClick={() => notifications.forEach(n => markNotificationRead(n.id))}
                style={{ fontSize: '0.78rem', color: '#C9963A', background: 'none', border: 'none', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p style={{ color: '#8BA0B4', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>No notifications yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notifications.map(n => (
                <div key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  style={{ display: 'flex', gap: '1rem', padding: '1rem', background: n.read ? '#0B1C2C' : 'rgba(201,150,58,0.06)', border: `1px solid ${n.read ? 'rgba(201,150,58,0.1)' : 'rgba(201,150,58,0.2)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6, background: n.read ? 'transparent' : n.type === 'success' ? '#27AE60' : n.type === 'error' ? '#E74C3C' : '#C9963A', border: n.read ? '1px solid rgba(201,150,58,0.2)' : 'none' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.85rem', color: n.read ? '#8BA0B4' : '#FAF6F0', lineHeight: 1.5, marginBottom: '0.25rem' }}>{n.message}</p>
                    <span style={{ fontSize: '0.72rem', color: '#8BA0B4' }}>{formatDate(n.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tax reports tab */}
      {activeTab === 'tax' && (
        <>
          <div style={S.card}>
            <span style={S.sLabel}>Annual Tax Summary</span>
            <p style={{ fontSize: '0.9rem', color: '#8BA0B4', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              REPAIHUB generates an annual summary of all your NRO transfers for your Indian ITR filing. This report includes Form 15CA references, amounts transferred, and TCS deducted.
            </p>
            {[
              { year: 'FY 2026 (Apr 25 – Mar 26)', status: 'In Progress', count: 3, note: 'Year end: Mar 31, 2026' },
              { year: 'FY 2025 (Apr 24 – Mar 25)', status: 'Available', count: 0, note: 'No transfers recorded' },
            ].map(report => (
              <div key={report.year} style={{ background: '#0B1C2C', padding: '1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#FAF6F0', marginBottom: '0.2rem' }}>{report.year}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8BA0B4' }}>{report.count} transfers · {report.note}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: report.status === 'Available' ? '#27AE60' : '#F39C12', fontWeight: 600 }}>{report.status}</span>
                  <button
                    style={{ background: report.count > 0 ? '#C9963A' : 'rgba(201,150,58,0.2)', color: '#0B1C2C', border: 'none', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 700, cursor: report.count > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    disabled={report.count === 0}>
                    <Download size={13} /> Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.2)', borderLeft: '3px solid #C9963A', padding: '1.25rem 1.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9963A', display: 'block', marginBottom: '0.4rem' }}>ITR Filing Reminder</span>
            <p style={{ fontSize: '0.85rem', color: '#8BA0B4', lineHeight: 1.7, margin: 0 }}>
              If TCS was deducted on your transfers, claim it back when you file your Indian Income Tax Return (ITR). The deadline is typically July 31. REPAIHUB's annual summary has everything your CA needs.
            </p>
          </div>
        </>
      )}

      {/* Security tab */}
      {activeTab === 'security' && (
        <>
          <div style={S.card}>
            <span style={S.sLabel}>Security</span>
            {[
              { label: 'Two-Factor Authentication', value: 'Enabled via App', icon: '🔐' },
              { label: 'Biometric Login', value: 'Face ID / Fingerprint', icon: '👆' },
              { label: 'Session Timeout', value: '15 minutes', icon: '⏱' },
              { label: 'Data Encryption', value: 'AES-256 at rest', icon: '🔒' },
              { label: 'Transfer Confirmation', value: 'Biometric required', icon: '✅' },
            ].map(item => (
              <div key={item.label} style={S.row}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                  <span style={{ color: '#FAF6F0', fontSize: '0.9rem' }}>{item.label}</span>
                </div>
                <span style={{ color: '#27AE60', fontWeight: 500, fontSize: '0.82rem' }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <span style={S.sLabel}>Data & Privacy</span>
            {[
              'We never store your banking credentials',
              'Account numbers stored as SHA-256 hash only',
              'No Aadhaar data — ever',
              'PAN used for verification only — immediately discarded',
              'Audit log is immutable — no delete, no update',
              'All data in AWS ca-central-1 (Canada)',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(201,150,58,0.1)', fontSize: '0.85rem', color: '#FAF6F0' }}>
                <Check size={14} color="#27AE60" style={{ flexShrink: 0, marginTop: 2 }} />
                {item}
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.2)', padding: '1.25rem 1.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3498DB', display: 'block', marginBottom: '0.4rem' }}>Data Request</span>
            <p style={{ fontSize: '0.85rem', color: '#8BA0B4', lineHeight: 1.7, margin: 0 }}>
              Under PIPEDA, you can request a copy of all data we hold about you, or request deletion. Email <strong style={{ color: '#FAF6F0' }}>founder@repaihub.com</strong> with subject "PIPEDA Data Request".
            </p>
          </div>
        </>
      )}
    </div>
  )
}
