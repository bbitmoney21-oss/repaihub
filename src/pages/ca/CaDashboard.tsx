import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, XCircle, AlertCircle, Download, Upload, LogOut, RefreshCw } from 'lucide-react'
import { getCaToken, clearCaToken } from './CaLogin'
import { type ComplianceRequest, type WalletDocument } from '../../lib/api'

// ── CA-specific fetch helper ──────────────────────────────────────────────────
async function caFetch(path: string, init: RequestInit = {}) {
  const token = getCaToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  if (res.status === 401) {
    clearCaToken()
    window.location.href = '/ca-login'
  }
  return res
}

async function parseErr(res: Response): Promise<string> {
  try { return (await res.json()).error || `Error ${res.status}` } catch { return `Error ${res.status}` }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { background: '#0B1C2C', minHeight: '100vh', color: '#FAF6F0' },
  header: { background: '#132233', borderBottom: '1px solid rgba(201,150,58,0.2)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  main: { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  card: { background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem', marginBottom: '1rem' },
  sLabel: { fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#C9963A', display: 'block', marginBottom: '0.4rem' },
  h2: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 600, color: '#FFFFFF', margin: 0 },
  p: { fontSize: '0.85rem', color: '#8BA0B4', margin: 0 },
  btn: (color: string = '#C9963A', textColor: string = '#0B1C2C') => ({
    background: color, color: textColor, border: 'none',
    padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer',
  }),
  btnOutline: { background: 'transparent', border: '1px solid rgba(201,150,58,0.4)', color: '#C9963A', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' },
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:      { label: 'Needs CA Action', color: '#F39C12', icon: Clock },
  under_review: { label: 'Needs CA Action', color: '#F39C12', icon: Clock },
  approved:     { label: 'Approved',        color: '#27AE60', icon: CheckCircle },
  rejected:     { label: 'Rejected',        color: '#E74C3C', icon: XCircle },
}

const DOC_LABELS: Record<string, string> = {
  bank_statement: 'Bank Statement', tds_certificate: 'TDS Certificate',
  pan_card: 'PAN Card', aadhaar: 'Aadhaar', property_deed: 'Property Deed',
  investment_proof: 'Investment Proof',
  '15ca_pdf': 'Form 145', 'form145_pdf': 'Form 145',
  '15cb_pdf': 'Form 146', 'form146_pdf': 'Form 146',
  other: 'Other',
}

function fmt(n: number) { return `₹${new Intl.NumberFormat('en-IN').format(Math.round(n))}` }

function downloadWinmanExport(request: ComplianceRequest) {
  const t = request.transfers
  const fy = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`
    : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(-2)}`
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const lines = [
    '================================================',
    'REPAIHUB — Form 146 Data Export (Winman / Gen / Taxmann)',
    `Transfer Ref: ${(request as unknown as Record<string,unknown>).transfer_id ?? request.id}`,
    `Compliance ID: ${request.id}`,
    `Generated: ${now} IST`,
    '================================================',
    `ASSESSEE_NAME: [Customer name — from KYC records]`,
    `ASSESSEE_PAN: [Customer PAN — from KYC records]`,
    `NATURE_OF_REMITTANCE: ${t?.source_of_funds?.replace(/_/g,' ') ?? 'NRO Repatriation'}`,
    `AMOUNT_INR: ₹${t ? new Intl.NumberFormat('en-IN').format(Math.round(t.amount_inr)) : '-'}`,
    `GROSS_AMOUNT_FOREIGN_CURRENCY: CAD ${t?.amount_cad?.toFixed(2) ?? '-'}`,
    `NET_AMOUNT_TO_CUSTOMER: CAD ${t?.net_amount_cad?.toFixed(2) ?? '-'}`,
    `CURRENCY_CODE: CAD`,
    `COUNTRY_OF_REMITTANCE: Canada`,
    `AD_BANK: Fable Fintech (AD Cat-I bank)`,
    `PURPOSE_CODE: ${t?.purpose_code ?? 'P1301'}`,
    `TDS_SECTION: 397(3)(d) [IT Act 2025] / 195 [IT Act 1961 — legacy]`,
    `TDS_RATE: [Check Form 26AS for actual TDS rate]`,
    `TDS_AMOUNT_INR: [Check Form 26AS]`,
    `DTAA_APPLICABLE: Yes`,
    `DTAA_ARTICLE: Article 23 — India-Canada DTAA 1996`,
    `FINANCIAL_YEAR: ${fy}`,
    `FORM_145_PART: Part ${(request as unknown as Record<string,unknown>).form145_part ?? request.fifteen_ca_part ?? 'C'}`,
    '================================================',
    'CA CHECKLIST (complete BEFORE certifying Form 146):',
    '[ ] Form 26AS downloaded — verify TDS amount matches',
    '[ ] TDS certificate reviewed against Form 26AS',
    '[ ] DTAA applicability confirmed — Article 23 India-Canada',
    '[ ] Source of funds documents reviewed',
    '[ ] Remittance amount matches bank statement',
    '[ ] FEMA compliance confirmed — USD 1M annual limit',
    '================================================',
    'AFTER FILING ON incometax.gov.in → e-File → Income Tax Forms → Form 146:',
    '',
    'Form 146 Ack Number: ___________________________',
    'Filed on (date): _______________________________',
    `CA Name: ______________________________________`,
    `ICAI Membership Number: ________________________`,
    '',
    '>>> Record the Form 146 Ack Number in REPAIHUB CA Portal, then click APPROVE.',
    '================================================',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `repaihub-form146-data-${request.id.slice(0,8)}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: '#8BA0B4', icon: Clock }
  const Icon = s.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: `${s.color}18`, border: `1px solid ${s.color}44`, color: s.color, padding: '0.2rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <Icon size={11} /> {s.label}
    </span>
  )
}

const UDIN_REGEX = /^\d{18}$/

// ── Approve modal ─────────────────────────────────────────────────────────────
function ApproveModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [cbNumber, setCbNumber] = useState('')
  const [udin, setUdin] = useState('')
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!cbNumber || cbNumber.trim().length < 5) {
      setError('Form 146 acknowledgement number is required (as received from incometax.gov.in).')
      return
    }
    if (udin && !UDIN_REGEX.test(udin.trim())) {
      setError('UDIN must be exactly 18 digits as issued by the ICAI portal.')
      return
    }
    if (remarks.length < 10) {
      setError('CA remarks must be at least 10 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await caFetch(`/ca/compliance/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ cbNumber, remarks, ...(udin.trim() ? { udin: udin.trim() } : {}) }),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      onDone()
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Record Form 146 Reference & Approve" onClose={onClose}>
      {error && <ErrBox msg={error} />}
      <div style={{ fontSize: '0.78rem', color: '#8BA0B4', background: 'rgba(201,150,58,0.06)', border: '1px solid rgba(201,150,58,0.15)', padding: '0.65rem 0.85rem', marginBottom: '0.25rem' }}>
        Enter the Form 146 certificate number generated by your CA software (Winman / Gen / Taxmann). REPAIHUB records this reference — it does not issue Form 146.
      </div>
      <Field label="Form 146 Certificate Number (from your CA software)">
        <input className="input-field" style={{ display: 'block' }} value={cbNumber} onChange={e => setCbNumber(e.target.value)} placeholder="e.g. F146-2026-001" />
      </Field>
      <Field label="UDIN — Unique Document Identification Number (optional, from ICAI portal)">
        <input className="input-field" style={{ display: 'block' }} value={udin} onChange={e => setUdin(e.target.value.replace(/\D/g, '').slice(0, 18))} placeholder="18-digit code from udin.icai.org" maxLength={18} />
        <span style={{ fontSize: '0.7rem', color: '#8BA0B4' }}>Generate at udin.icai.org after filing Form 146. Leave blank if not yet available.</span>
      </Field>
      <Field label="CA Remarks (min 10 chars)">
        <textarea className="input-field" style={{ display: 'block', minHeight: 80, resize: 'vertical' }} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Tax compliance confirmed. TDS verified in Form 26AS under Section 397(3)(d)…" />
      </Field>
      <ModalActions>
        <button style={S.btn('#27AE60')} onClick={submit} disabled={loading}>{loading ? 'Approving…' : 'Record Form 146 Reference & Approve'}</button>
        <button style={S.btn('transparent', '#8BA0B4')} onClick={onClose}>Cancel</button>
      </ModalActions>
    </Modal>
  )
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!reason.trim()) { setError('Rejection reason is required.'); return }
    setLoading(true); setError('')
    try {
      const res = await caFetch(`/ca/compliance/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      onDone(); onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Reject Compliance Request" onClose={onClose}>
      {error && <ErrBox msg={error} />}
      <Field label="Rejection Reason">
        <textarea className="input-field" style={{ display: 'block', minHeight: 80, resize: 'vertical' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="Documents incomplete — missing TDS certificate for FY 2025-26." />
      </Field>
      <ModalActions>
        <button style={S.btn('#E74C3C')} onClick={submit} disabled={loading}>{loading ? 'Rejecting…' : 'Reject'}</button>
        <button style={S.btn('transparent', '#8BA0B4')} onClick={onClose}>Cancel</button>
      </ModalActions>
    </Modal>
  )
}

// ── Upload PDF modal ──────────────────────────────────────────────────────────
function UploadPdfModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  // docType values kept as old DB names ('15cb_pdf'/'15ca_pdf') for CHECK constraint compat
  // Labels displayed to user use the new Form 145/146 naming
  const [docType, setDocType] = useState<'15cb_pdf' | '15ca_pdf'>('15cb_pdf')
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!file) { setError('Select a PDF file.'); return }
    setLoading(true); setError('')
    try {
      // Step 1: get signed upload URL from CA endpoint
      const urlRes = await caFetch(`/ca/compliance/${id}/upload-pdf-url`, {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/pdf', docType }),
      })
      if (!urlRes.ok) throw new Error(await parseErr(urlRes))
      const { tokenId, storagePath, signedUrl } = await urlRes.json()

      // Step 2: PUT directly to Supabase Storage signed URL
      const put = await fetch(signedUrl, {
        method: 'PUT', body: file,
        headers: { 'Content-Type': file.type || 'application/pdf', 'x-upsert': 'true' },
      })
      if (!put.ok) throw new Error(`Storage upload failed (${put.status}) — ensure the wallet-docs bucket exists in Supabase Dashboard.`)

      // Step 3: confirm — saves metadata to wallet_documents table
      const confirmRes = await caFetch(`/ca/compliance/${id}/confirm-pdf`, {
        method: 'POST',
        body: JSON.stringify({
          tokenId, storagePath, fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileSizeBytes: file.size, docType,
          docLabel: label || (docType === '15cb_pdf' ? 'Form 146 Certificate' : 'Form 145 Filed Copy'),
        }),
      })
      if (!confirmRes.ok) throw new Error(await parseErr(confirmRes))
      onDone(); onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Upload PDF to Customer Wallet" onClose={onClose}>
      {error && <ErrBox msg={error} />}
      <Field label="Document Type">
        <select className="input-field" style={{ display: 'block' }} value={docType} onChange={e => setDocType(e.target.value as '15cb_pdf' | '15ca_pdf')}>
          <option value="15cb_pdf">Form 146 (CA Certificate)</option>
          <option value="15ca_pdf">Form 145 (Filed Copy)</option>
        </select>
      </Field>
      <Field label="Label (optional)">
        <input className="input-field" style={{ display: 'block' }} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Form 146 Certificate — Transfer RH-2026-001" />
      </Field>
      <Field label="PDF File">
        <input type="file" accept=".pdf,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.82rem', color: '#FAF6F0' }} />
      </Field>
      <ModalActions>
        <button style={S.btn()} onClick={submit} disabled={loading}>{loading ? 'Uploading…' : 'Upload to Wallet'}</button>
        <button style={S.btn('transparent', '#8BA0B4')} onClick={onClose}>Cancel</button>
      </ModalActions>
    </Modal>
  )
}

// ── Form 145 filing modal ─────────────────────────────────────────────────────
function File15CAModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [caNumber, setCaNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!caNumber.trim()) { setError('Form 145 acknowledgement number is required.'); return }
    setLoading(true); setError('')
    try {
      const res = await caFetch(`/ca/compliance/${id}/file-15ca`, {
        method: 'POST',
        body: JSON.stringify({ caNumber }),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      onDone(); onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Record Form 145 Ack Number" onClose={onClose}>
      {error && <ErrBox msg={error} />}
      <div style={{ fontSize: '0.78rem', color: '#8BA0B4', marginBottom: '0.25rem' }}>
        Enter the acknowledgement number you received after filing Form 145 on incometax.gov.in.
      </div>
      <Field label="Form 145 Acknowledgement Number">
        <input className="input-field" style={{ display: 'block' }} value={caNumber} onChange={e => setCaNumber(e.target.value)} placeholder="e.g. F145-2026-XXXXXXXX" />
      </Field>
      <ModalActions>
        <button style={S.btn()} onClick={submit} disabled={loading}>{loading ? 'Saving…' : 'Save Form 145 Ack Number'}</button>
        <button style={S.btn('transparent', '#8BA0B4')} onClick={onClose}>Cancel</button>
      </ModalActions>
    </Modal>
  )
}

// ── Small reusable bits ───────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.3)', padding: '2rem', width: '100%', maxWidth: 480 }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#FFFFFF', marginBottom: '1.5rem' }}>{title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.4rem' }}>{label}</label>
      {children}
    </div>
  )
}
function ModalActions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>{children}</div>
}
function ErrBox({ msg }: { msg: string }) {
  return <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', padding: '0.65rem 1rem', fontSize: '0.82rem', color: '#E74C3C' }}>{msg}</div>
}

// ── Request row ───────────────────────────────────────────────────────────────
type ModalType = 'approve' | 'reject' | 'upload-pdf' | '15ca' | null

function RequestRow({ request, onRefresh }: { request: ComplianceRequest; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState<ModalType>(null)
  const [docs, setDocs] = useState<WalletDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  const t = request.transfers

  async function expand() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    if (docs.length > 0) return
    setLoadingDocs(true)
    try {
      const res = await caFetch(`/ca/compliance/${request.id}`)
      if (res.ok) {
        const data = await res.json()
        setDocs(data.request.wallet_documents ?? [])
      }
    } finally {
      setLoadingDocs(false)
    }
  }

  async function downloadDoc(tokenId: string) {
    const res = await caFetch(`/ca/compliance/${request.id}/wallet-doc/${tokenId}/url`)
    if (!res.ok) { alert('Download failed'); return }
    const { url, fileName } = await res.json()
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.target = '_blank'; a.click()
  }

  function onActionDone() {
    onRefresh()
    // Refresh docs if expanded
    if (expanded) {
      setLoadingDocs(true)
      caFetch(`/ca/compliance/${request.id}`)
        .then(r => r.json())
        .then(d => setDocs(d.request.wallet_documents ?? []))
        .finally(() => setLoadingDocs(false))
    }
  }

  return (
    <>
      {modal === 'approve'     && <ApproveModal   id={request.id} onClose={() => setModal(null)} onDone={onActionDone} />}
      {modal === 'reject'      && <RejectModal    id={request.id} onClose={() => setModal(null)} onDone={onActionDone} />}
      {modal === 'upload-pdf'  && <UploadPdfModal id={request.id} onClose={() => setModal(null)} onDone={onActionDone} />}
      {modal === '15ca'        && <File15CAModal  id={request.id} onClose={() => setModal(null)} onDone={onActionDone} />}

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <StatusBadge status={request.status} />
              {(request.fifteen_ca_part || (request as unknown as Record<string,unknown>).form145_part) && (
                <span style={{ fontSize: '0.68rem', color: '#8BA0B4', background: 'rgba(201,150,58,0.08)', padding: '0.15rem 0.45rem', border: '1px solid rgba(201,150,58,0.2)' }}>
                  Form 145 Part {(request as unknown as Record<string,unknown>).form145_part as string || request.fifteen_ca_part}
                </span>
              )}
            </div>
            {t ? (
              <div>
                <div style={{ fontSize: '0.88rem', color: '#FAF6F0', marginBottom: '0.2rem', fontWeight: 500 }}>
                  {fmt(t.amount_inr)} · Gross: CAD {t.amount_cad?.toFixed(2)} · {t.source_of_funds?.replace(/_/g, ' ')}
                </div>
                {t.total_fees_cad != null && (
                  <div style={{ fontSize: '0.72rem', color: '#8BA0B4' }}>
                    Commission 1.8%: CAD {t.commission_cad?.toFixed(2)} + Flat: CAD {t.flat_fee_cad?.toFixed(2)}
                    {' = '}Total fees: CAD {t.total_fees_cad?.toFixed(2)}
                    {' · '}
                    <span style={{ color: '#27AE60', fontWeight: 600 }}>Net to customer: CAD {t.net_amount_cad?.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : null}
            <div style={{ fontSize: '0.72rem', color: '#8BA0B4' }}>
              {new Date(request.created_at).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {(request.fifteen_cb_number || (request as unknown as Record<string,unknown>).form146_number) && ` · Form 146 Ref: ${(request as unknown as Record<string,unknown>).form146_number ?? request.fifteen_cb_number}`}
              {(request.fifteen_ca_number || (request as unknown as Record<string,unknown>).form145_number) && ` · Form 145 Ack: ${(request as unknown as Record<string,unknown>).form145_number ?? request.fifteen_ca_number}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
            {(request.status === 'pending' || request.status === 'under_review') && (
              <>
                <button style={S.btn('#27AE60')} onClick={() => setModal('approve')}>Certify Form 146</button>
                <button style={S.btn('#E74C3C')} onClick={() => setModal('reject')}>Reject</button>
              </>
            )}
            {/* Upload PDF + File Form 145 available once approved */}
            {request.status === 'approved' && (
              <>
                <button style={S.btnOutline} onClick={() => setModal('upload-pdf')}>
                  <Upload size={11} style={{ display: 'inline', marginRight: 4 }} />Upload PDF
                </button>
                <button style={S.btnOutline} onClick={() => setModal('15ca')}>File Form 145</button>
              </>
            )}
            <button style={{ ...S.btnOutline, borderColor: 'rgba(201,150,58,0.6)', color: '#C9963A' }} onClick={() => downloadWinmanExport(request)}>
              <Download size={11} style={{ display: 'inline', marginRight: 4 }} />Winman Data
            </button>
            <button style={S.btnOutline} onClick={expand}>{expanded ? 'Hide' : 'Docs'}</button>
          </div>
        </div>

        {/* CA Workflow Guide — shown for pending/under_review only */}
        {(request.status === 'pending' || request.status === 'under_review') && (
          <div style={{ marginTop: '0.75rem', background: 'rgba(201,150,58,0.04)', border: '1px solid rgba(201,150,58,0.15)', borderLeft: '3px solid #C9963A', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C9963A', marginBottom: '0.5rem' }}>CA Action Required — 3 Steps</div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {[
                { n: '1', title: 'Download & import data', desc: 'Click "Winman Data" → import into Winman / Gen / Taxmann → certify Form 146' },
                { n: '2', title: 'File on IT Portal', desc: 'Go to incometax.gov.in → e-File → Income Tax Forms → Form 146 → get Ack No.' },
                { n: '3', title: 'Record in REPAIHUB', desc: 'Click "Certify Form 146" above → enter Form 146 Ack No. → submit' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flex: '1 1 180px' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(201,150,58,0.2)', border: '1px solid rgba(201,150,58,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700, color: '#C9963A', flexShrink: 0, marginTop: '1px' }}>{step.n}</span>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#FAF6F0', marginBottom: '0.15rem' }}>{step.title}</div>
                    <div style={{ fontSize: '0.68rem', color: '#8BA0B4', lineHeight: 1.4 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {request.status === 'rejected' && request.rejection_reason && (
          <div style={{ marginTop: '0.75rem', background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)', padding: '0.65rem', fontSize: '0.82rem', color: '#E74C3C' }}>
            {request.rejection_reason}
          </div>
        )}
        {request.status === 'approved' && request.ca_remarks && (
          <div style={{ marginTop: '0.75rem', background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.2)', padding: '0.65rem', fontSize: '0.82rem', color: '#8BA0B4' }}>
            {request.ca_remarks}
          </div>
        )}

        {expanded && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(201,150,58,0.12)', paddingTop: '1rem' }}>
            {loadingDocs ? (
              <div style={{ fontSize: '0.82rem', color: '#8BA0B4' }}>Loading documents…</div>
            ) : docs.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#8BA0B4' }}>No documents uploaded by customer yet.</div>
            ) : docs.map(d => (
              <div key={d.token_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(201,150,58,0.08)', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: '#FAF6F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.doc_label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#8BA0B4' }}>
                    {DOC_LABELS[d.doc_type] ?? d.doc_type} · {d.uploaded_by === 'ca' ? <span style={{ color: '#27AE60' }}>uploaded by CA</span> : 'by customer'}
                  </div>
                </div>
                <button style={S.btnOutline} onClick={() => downloadDoc(d.token_id)}>
                  <Download size={11} style={{ display: 'inline', marginRight: 4 }} />Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function CaDashboard() {
  const nav = useNavigate()
  const [requests, setRequests] = useState<ComplianceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [caUser, setCaUser] = useState<{ name: string; email: string } | null>(null)

  function logout() { clearCaToken(); nav('/ca-login') }

  async function load() {
    setLoading(true); setError('')
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : ''
      const res = await caFetch(`/ca/compliance${qs}`)
      if (!res.ok) throw new Error(await parseErr(res))
      const data = await res.json()
      setRequests(data.requests)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getCaToken()) { nav('/ca-login'); return }
    // Decode token to get name
    try {
      const payload = JSON.parse(atob(getCaToken()!.split('.')[1]))
      setCaUser({ name: payload.name || payload.email, email: payload.email })
    } catch {}
    load()
  }, [statusFilter])

  const counts = { total: requests.length, needs_action: 0, approved: 0, rejected: 0 }
  requests.forEach(r => {
    if (r.status === 'pending' || r.status === 'under_review') counts.needs_action++
    else if (r.status === 'approved') counts.approved++
    else if (r.status === 'rejected') counts.rejected++
  })

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 700, color: '#E8B86D', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Repaihub</span>
          <span style={{ fontSize: '0.72rem', color: '#8BA0B4', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CA Compliance Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {caUser && <span style={{ fontSize: '0.82rem', color: '#8BA0B4' }}>{caUser.name}</span>}
          <button style={S.btnOutline} onClick={load}><RefreshCw size={13} style={{ display: 'inline', marginRight: 4 }} />Refresh</button>
          <button style={S.btnOutline} onClick={logout}><LogOut size={13} style={{ display: 'inline', marginRight: 4 }} />Sign out</button>
        </div>
      </div>

      <div style={S.main}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '1px', background: 'rgba(201,150,58,0.15)', border: '1px solid rgba(201,150,58,0.15)', marginBottom: '2rem' }}>
          {[
            { label: 'Total', value: counts.total, color: '#FAF6F0' },
            { label: 'Needs Action', value: counts.needs_action, color: '#F39C12' },
            { label: 'Approved', value: counts.approved, color: '#27AE60' },
            { label: 'Rejected', value: counts.rejected, color: '#E74C3C' },
          ].map(s => (
            <div key={s.label} style={{ background: '#132233', padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8BA0B4', marginBottom: '0.3rem' }}>{s.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.color, fontFamily: "'DM Sans'" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { v: '',             label: 'All' },
            { v: 'under_review', label: 'Needs Action' },
            { v: 'approved',     label: 'Approved' },
            { v: 'rejected',     label: 'Rejected' },
          ].map(({ v, label }) => (
            <button key={v} style={{ ...S.btnOutline, background: statusFilter === v ? 'rgba(201,150,58,0.15)' : 'transparent', borderColor: statusFilter === v ? '#C9963A' : 'rgba(201,150,58,0.4)' }} onClick={() => setStatusFilter(v)}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8BA0B4' }}>Loading compliance requests…</div>
        ) : error ? (
          <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', padding: '1rem', color: '#E74C3C', fontSize: '0.85rem' }}>{error}</div>
        ) : requests.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: '3rem', color: '#8BA0B4' }}>
            No compliance requests{statusFilter ? ` with status "${statusFilter}"` : ''}.
          </div>
        ) : (
          requests.map(r => <RequestRow key={r.id} request={r} onRefresh={load} />)
        )}
      </div>
    </div>
  )
}
