import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, mapDbTransfer } from '../../store/useStore'
import type { Transfer, TransferStatus } from '../../store/useStore'
import { apiGetTransfers } from '../../lib/api'
import { formatCAD, formatINR } from '../../lib/utils'
import { getStatusDetail, isActive } from '../../lib/transferStatus'
import { ChevronRight, Plus, AlertTriangle, Bell } from 'lucide-react'

/**
 * REPAIHUB Dashboard — mobile-first.
 *
 * The home screen answers ONE question: "where is my money right now?"
 * Everything else lives a tab away.
 *
 * Vertical order (single column, max 480px wide, centered):
 *   1. Greeting strip (compact)
 *   2. Live FX rate + the single primary CTA
 *   3. Pending action banner — conditional, hidden when no action required
 *   4. Active transfers list — the heart of the screen
 *   5. View-all link to /app/transfer when there are completed/historic rows
 *
 * Deleted from the previous design: vanity total/this-year stat boxes,
 * outward/inward summary boxes, the full LRS progress bar, the "How your
 * transfer works" educational footer, the dual-pane recent + quick-actions
 * grid. Those live in dedicated tabs (Transfers, Settings) where customers
 * actively go to look up that information.
 */
// Track viewport width so the dashboard renders a real desktop layout
// (wider container, FX strip + CTA on a row, 2-column active grid) instead
// of just centering the mobile column on a wide screen.
function useIsDesktop(threshold = 768) {
  const [v, setV] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= threshold
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setV(window.innerWidth >= threshold)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [threshold])
  return v
}

export default function Dashboard() {
  const { user, transfers, fxRate, setTransfers, isAuthenticated } = useStore()
  const nav = useNavigate()
  const isDesktop = useIsDesktop()

  // historyError = true when the backend couldn't load transfers. Without this,
  // a 5xx silently rendered as "No active transfers" — actively misleading on
  // a remittance product. The backend now returns 200 with { partial: true,
  // error } on failure (see src/routes/transfers.ts), and apiGetTransfers
  // re-throws so the frontend can react. We also keep a manual-retry handle
  // so the user can re-fetch without reloading the whole tab.
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = useCallback(() => {
    if (!isAuthenticated) return
    setHistoryLoading(true)
    setHistoryError(null)
    apiGetTransfers()
      .then(ts => setTransfers(ts.map(mapDbTransfer)))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Could not load transfer history.'
        setHistoryError(msg)
        // Do NOT clear existing transfers — keep optimistic state from
        // NewTransfer's addTransfer() so the customer still sees their
        // just-submitted row.
      })
      .finally(() => setHistoryLoading(false))
  }, [isAuthenticated, setTransfers])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Active = not COMPLETED, not FAILED. Cap at 5 on the home screen so the
  // mobile fold stays clean; everything else is on the Transfers tab.
  const activeAll  = transfers.filter(t => isActive(t.status))
  const activeShown = activeAll.slice(0, 5)
  const allCount   = transfers.length

  // Pending action banner: surface the FIRST transfer whose status mapping
  // includes an actionRequired field. Today the helper never sets one — when
  // backend adds compliance-blocking flags, this banner activates without UI
  // changes.
  const pendingAction = activeAll
    .map(t => ({ t, detail: getStatusDetail(t.status, t.direction) }))
    .find(x => x.detail?.actionRequired)

  // Color tokens (in line with the rest of the app).
  const C = {
    bg:        '#0B1C2C',
    card:      '#132233',
    border:    'rgba(201,150,58,0.2)',
    accent:    '#C9963A',
    accentLt:  '#E8B86D',
    text:      '#FAF6F0',
    muted:     '#8BA0B4',
    success:   '#27AE60',
    warning:   '#F39C12',
    danger:    '#E74C3C',
    subtle:    'rgba(201,150,58,0.06)',
  } as const

  return (
    <div style={{
      maxWidth: isDesktop ? 1000 : 480,
      margin:   '0 auto',
      padding:  isDesktop ? '2rem' : '1rem',
      display:  'flex',
      flexDirection: 'column',
      gap:      isDesktop ? '1.5rem' : '1rem',
    }}>

      {/* 0 — History load banner. Renders ONLY when /transfers/history failed.
             Replaces the previous behaviour of silently rendering an empty
             "No active transfers" state on a 5xx — which was actively
             misleading on a remittance product. */}
      {historyError && (
        <div role="status" aria-live="polite" style={{
          background:    'rgba(231,76,60,0.08)',
          border:        `1px solid ${C.danger}`,
          borderRadius:  8,
          padding:       '0.75rem 0.9rem',
          color:         C.text,
          fontSize:      '0.82rem',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          gap:           '0.75rem',
        }}>
          <span>
            <strong style={{ color: C.danger }}>Couldn't load transfers.</strong>{' '}
            We're showing your latest local state. Tap retry to fetch from the server.
          </span>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            style={{
              background:    'transparent',
              color:         C.accentLt,
              border:        `1px solid ${C.accentLt}`,
              borderRadius:  6,
              padding:       '0.3rem 0.75rem',
              fontSize:      '0.75rem',
              cursor:        historyLoading ? 'wait' : 'pointer',
              whiteSpace:    'nowrap',
              opacity:       historyLoading ? 0.6 : 1,
            }}
          >
            {historyLoading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {/* 1 — Greeting strip */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.4rem' }}>
          Dashboard
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isDesktop ? '2.2rem' : '1.6rem', fontWeight: 600, color: C.text, margin: 0, lineHeight: 1.2 }}>
          Hi, <em style={{ fontStyle: 'normal', color: C.accentLt }}>{user?.name?.split(' ')[0] || 'there'}</em>
        </h1>
        <p style={{ fontSize: '0.78rem', color: C.muted, margin: '0.25rem 0 0 0' }}>
          {[user?.canadaBank?.institution, user?.indiaBank?.bankName].filter(Boolean).join(' · ') || 'Account ready'}
        </p>
      </div>

      {/* 2 — FX rate strip + the primary CTA.
              Desktop: rate left, CTA right, single row.
              Mobile:  rate stacked, CTA full-width below. */}
      <div style={{
        background: C.subtle,
        border: `1px solid ${C.border}`,
        padding: isDesktop ? '1rem 1.25rem' : '0.85rem 1rem',
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'center' : 'stretch',
        justifyContent: 'space-between',
        gap: isDesktop ? '1rem' : '0.85rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flex: isDesktop ? 1 : undefined }}>
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted }}>
              Live FX
            </span>
            <div style={{ fontSize: isDesktop ? '1.4rem' : '1.15rem', fontWeight: 600, color: C.accentLt, fontFamily: "'DM Sans'", lineHeight: 1.1, marginTop: 2 }}>
              1 CAD = ₹{(fxRate || 0).toFixed(2)}
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: C.success, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, display: 'inline-block' }} />
            Live
          </span>
        </div>

        <button
          onClick={() => nav('/app/new-transfer')}
          style={{
            width: isDesktop ? 'auto' : '100%',
            minWidth: isDesktop ? 240 : undefined,
            background: C.accent,
            color: C.bg,
            border: 'none',
            padding: isDesktop ? '0.85rem 1.5rem' : '0.95rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            minHeight: 48,
          }}>
          <Plus size={16} /> New Transfer
        </button>
      </div>

      {/* 3 — Pending action banner — only when something is blocked on the user */}
      {pendingAction?.detail?.actionRequired && (
        <button
          onClick={() => nav(`/app/transfer/${pendingAction.t.id}`)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            background: 'rgba(243,156,18,0.08)',
            border: `1px solid ${C.warning}`,
            borderLeft: `4px solid ${C.warning}`,
            padding: '0.85rem 1rem',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
            color: 'inherit',
          }}>
          <AlertTriangle size={18} color={C.warning} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.warning, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Action needed
            </div>
            <div style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.4 }}>
              {pendingAction.detail.actionRequired.message}
            </div>
            <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: '0.25rem' }}>
              {pendingAction.t.reference}
            </div>
          </div>
          <ChevronRight size={18} color={C.muted} style={{ flexShrink: 0, alignSelf: 'center' }} />
        </button>
      )}

      {/* 4 — Active transfers */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent }}>
            Active {activeAll.length > 0 && `(${activeAll.length})`}
          </span>
          {allCount > 0 && (
            <button onClick={() => nav('/app/transfer')}
              style={{ background: 'none', border: 'none', color: C.accent, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}>
              View all <ChevronRight size={14} />
            </button>
          )}
        </div>

        {activeAll.length === 0 ? (
          <EmptyState onNew={() => nav('/app/new-transfer')} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : '1fr',
            gap: '0.6rem',
          }}>
            {activeShown.map(t => (
              <ActiveCard key={t.id} t={t} onOpen={() => nav(`/app/transfer/${t.id}`)} />
            ))}
            {activeAll.length > activeShown.length && (
              <button onClick={() => nav('/app/transfer')}
                style={{ background: 'none', border: `1px dashed ${C.border}`, color: C.muted, fontSize: '0.8rem', padding: '0.75rem', cursor: 'pointer' }}>
                +{activeAll.length - activeShown.length} more active · View all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden notification icon equivalent — the bell already lives in the
          top app bar.  No extra surface needed here. */}
      <div style={{ display: 'none' }}><Bell /></div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — inline so the dashboard stays one-file-readable.
// ─────────────────────────────────────────────────────────────────────────────

function ActiveCard({ t, onOpen }: { t: Transfer; onOpen: () => void }) {
  const detail = getStatusDetail(t.status, t.direction)
  const dir = t.direction === 'inward' ? '↙' : '↗'
  const pillBg = t.direction === 'inward' ? 'rgba(39,174,96,0.15)'   : 'rgba(232,184,109,0.15)'
  const pillFg = t.direction === 'inward' ? '#27AE60'                : '#E8B86D'
  const dirLabel = t.direction === 'inward' ? 'Canada → India'        : 'India → Canada'

  return (
    <button onClick={onOpen}
      style={{
        textAlign: 'left',
        background: '#132233',
        border: '1px solid rgba(201,150,58,0.2)',
        padding: '0.9rem 1rem',
        cursor: 'pointer',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
        width: '100%',
        minHeight: 92,
      }}>
      {/* Top row — direction pill + reference */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', background: pillBg, color: pillFg, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {dir} {dirLabel}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#8BA0B4', fontFamily: "'DM Sans'" }}>
          {t.reference}
        </span>
      </div>

      {/* Amount line — big, prominent, direction-aware ordering */}
      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FAF6F0', fontFamily: "'DM Sans'" }}>
        {t.direction === 'inward'
          ? <>{formatCAD(t.amountCAD)} <span style={{ color: '#8BA0B4' }}>→</span> {formatINR(t.amountINR)}</>
          : <>{formatINR(t.amountINR)} <span style={{ color: '#8BA0B4' }}>→</span> {formatCAD(t.amountCAD)}</>
        }
      </div>

      {/* Step dots */}
      <StepDots step={detail?.step ?? 1} total={detail?.totalSteps ?? 5} />

      {/* Status text + ETA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', color: '#FAF6F0', lineHeight: 1.35 }}>
            {detail?.label ?? statusFallbackLabel(t.status)}
          </div>
          {detail?.etaHint && (
            <div style={{ fontSize: '0.72rem', color: '#8BA0B4', marginTop: '0.15rem' }}>
              ETA · {detail.etaHint}
            </div>
          )}
        </div>
        {detail?.actionRequired && (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.45rem', background: 'rgba(243,156,18,0.15)', color: '#F39C12', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Needs you
          </span>
        )}
      </div>
    </button>
  )
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const filled = i < step
        const active = i === step - 1
        return (
          <span key={i}
            style={{
              flex: 1,
              height: 4,
              background: filled ? '#C9963A' : 'rgba(201,150,58,0.15)',
              boxShadow: active ? '0 0 0 1px rgba(201,150,58,0.5)' : 'none',
              transition: 'background 200ms ease',
            }}
          />
        )
      })}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      background: '#132233',
      border: '1px dashed rgba(201,150,58,0.3)',
      padding: '1.5rem 1rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.6rem',
    }}>
      <div style={{ fontSize: '1.6rem', opacity: 0.6 }}>📭</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FAF6F0' }}>No active transfers</div>
      <div style={{ fontSize: '0.78rem', color: '#8BA0B4', maxWidth: 280, lineHeight: 1.4 }}>
        Send your first transfer and track it here in real time.
      </div>
      <button onClick={onNew}
        style={{
          marginTop: '0.4rem',
          background: 'transparent',
          color: '#C9963A',
          border: '1px solid #C9963A',
          padding: '0.6rem 1.1rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          minHeight: 40,
        }}>
        + New Transfer
      </button>
    </div>
  )
}

function statusFallbackLabel(s: TransferStatus): string {
  switch (s) {
    case 'COMPLETED': return 'Completed'
    case 'FAILED':    return 'Failed'
    default:          return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
}
