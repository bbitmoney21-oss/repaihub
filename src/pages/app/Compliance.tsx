import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, FileText, Upload, Download, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import {
  apiGetComplianceRequests, apiGetComplianceRequest, apiGetWalletDocumentUrl,
  apiComplianceUploadUrl, apiComplianceConfirmUpload,
  type ComplianceRequest, type WalletDocument,
} from '../../lib/api'

const S = {
  page: { padding: '2rem', maxWidth: 960, margin: '0 auto' },
  sLabel: { fontSize: '0.7rem', fontWeight: 600 as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#C9963A', display: 'block', marginBottom: '0.5rem' },
  card: { background: '#132233', border: '1px solid rgba(201,150,58,0.2)', padding: '1.5rem', marginBottom: '1rem' },
  h3: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 600, color: '#FFFFFF', margin: 0 },
  p: { fontSize: '0.85rem', color: '#8BA0B4', lineHeight: 1.6, margin: 0 },
  btn: (disabled?: boolean) => ({
    background: disabled ? '#1a2f45' : '#C9963A',
    color: disabled ? '#4a5568' : '#0B1C2C',
    border: 'none',
    padding: '0.5rem 1rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }),
  btnSm: {
    background: 'transparent',
    border: '1px solid rgba(201,150,58,0.4)',
    color: '#C9963A',
    padding: '0.35rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:      { label: 'Pending Review',  color: '#F39C12', icon: Clock },
  under_review: { label: 'Under Review',    color: '#3498DB', icon: AlertCircle },
  approved:     { label: 'Approved',        color: '#27AE60', icon: CheckCircle },
  rejected:     { label: 'Rejected',        color: '#E74C3C', icon: XCircle },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bank_statement:   'Bank Statement',
  tds_certificate:  'TDS Certificate',
  pan_card:         'PAN Card',
  aadhaar:          'Aadhaar',
  property_deed:    'Property Deed',
  investment_proof: 'Investment Proof',
  '15ca_pdf':       'Form 145',
  '15cb_pdf':       'Form 146',
  '145_pdf':        'Form 145',
  '146_pdf':        'Form 146',
  other:            'Other',
}

function formatINR(n: number) {
  return `₹${new Intl.NumberFormat('en-IN').format(Math.round(n))}`
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: '#8BA0B4', icon: Clock }
  const Icon = s.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: `${s.color}18`, border: `1px solid ${s.color}44`, color: s.color, padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <Icon size={12} /> {s.label}
    </span>
  )
}

function DocRow({ doc, onDownload }: { doc: WalletDocument; onDownload: (tokenId: string) => void }) {
  const uploaderColor = doc.uploaded_by === 'ca' ? '#27AE60' : '#8BA0B4'
  const uploaderLabel = doc.uploaded_by === 'ca' ? '(by CA)' : '(by you)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid rgba(201,150,58,0.08)', gap: '1rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', color: '#FAF6F0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.doc_label}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#8BA0B4', marginTop: '0.2rem' }}>
          {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} · FY {doc.year}{' '}
          <span style={{ color: uploaderColor }}>{uploaderLabel}</span>
        </div>
      </div>
      <button style={S.btnSm} onClick={() => onDownload(doc.token_id)}>
        <Download size={11} style={{ display: 'inline', marginRight: 4 }} />
        Download
      </button>
    </div>
  )
}

function UploadModal({ complianceId, onClose, onUploaded }: {
  complianceId: string;
  onClose: () => void;
  onUploaded: (doc: WalletDocument) => void;
}) {
  const [docType, setDocType] = useState('bank_statement')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) { setError('Please select a file.'); return }
    setUploading(true)
    setError('')
    try {
      const urlRes = await apiComplianceUploadUrl(complianceId, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        docType,
      })
      const put = await fetch(urlRes.signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!put.ok) throw new Error('Upload to storage failed.')

      const confirmed = await apiComplianceConfirmUpload(complianceId, {
        tokenId:      urlRes.tokenId,
        storagePath:  urlRes.storagePath,
        fileName:     file.name,
        mimeType:     file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
        docType,
        docLabel: label || file.name,
      })
      onUploaded(confirmed.document)
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.3)', padding: '2rem', width: '100%', maxWidth: 440 }}>
        <h3 style={{ ...S.h3, marginBottom: '1.5rem' }}>Upload Document</h3>

        {error && (
          <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#E74C3C' }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.4rem' }}>Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="input-field" style={{ display: 'block' }}>
              {Object.entries(DOC_TYPE_LABELS).filter(([k]) => !['15ca_pdf','15cb_pdf'].includes(k)).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.4rem' }}>Label (optional)</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. HDFC NRO Statement Mar 2026" className="input-field" style={{ display: 'block' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8BA0B4', display: 'block', marginBottom: '0.4rem' }}>File</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.82rem', color: '#FAF6F0' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button style={S.btn(uploading)} disabled={uploading} onClick={handleUpload}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <button style={{ ...S.btn(), background: 'transparent', color: '#8BA0B4', border: '1px solid rgba(201,150,58,0.2)' }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function ComplianceCard({ request, onDownload }: {
  request: ComplianceRequest;
  onDownload: (tokenId: string) => void;
}) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<WalletDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError] = useState('')

  const t = request.transfers
  const docCount = request.wallet_documents?.[0]?.count ?? 0

  async function expand() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (docs.length > 0) return
    setLoadingDocs(true)
    try {
      const { documents } = await apiGetComplianceRequest(request.id)
      setDocs(documents)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoadingDocs(false)
    }
  }

  return (
    <div style={S.card}>
      {showUpload && (
        <UploadModal
          complianceId={request.id}
          onClose={() => setShowUpload(false)}
          onUploaded={doc => setDocs(d => [doc, ...d])}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <StatusBadge status={request.status} />
            {request.fifteen_ca_part && (
              <span style={{ fontSize: '0.72rem', color: '#8BA0B4', background: 'rgba(201,150,58,0.08)', padding: '0.2rem 0.5rem', border: '1px solid rgba(201,150,58,0.2)' }}>
                Form 145 Part {request.fifteen_ca_part}
              </span>
            )}
          </div>
          {t && (
            <div style={{ fontSize: '0.88rem', color: '#FAF6F0', fontWeight: 500, marginBottom: '0.3rem' }}>
              {formatINR(t.amount_inr)} · {t.source_of_funds?.replace(/_/g,' ')}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: '#8BA0B4' }}>
            {new Date(request.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
            {' · '}{docCount} document{docCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          {request.status === 'pending' && (
            <button style={S.btn()} onClick={() => { setOpen(true); setShowUpload(true) }}>
              <Upload size={12} style={{ display: 'inline', marginRight: 4 }} />
              Upload Docs
            </button>
          )}
          <button style={S.btnSm} onClick={expand}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* CA feedback */}
      {request.status === 'approved' && (
        <div style={{ marginTop: '0.75rem', background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.2)', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#27AE60', marginBottom: '0.4rem' }}>CA Approved</div>
          {request.fifteen_cb_number && <div style={{ fontSize: '0.82rem', color: '#FAF6F0' }}>Form 146 No: <strong>{request.fifteen_cb_number}</strong></div>}
          {request.fifteen_ca_number && <div style={{ fontSize: '0.82rem', color: '#FAF6F0' }}>Form 145 No: <strong>{request.fifteen_ca_number}</strong></div>}
          {request.ca_remarks && <div style={{ fontSize: '0.82rem', color: '#8BA0B4', marginTop: '0.3rem' }}>{request.ca_remarks}</div>}
        </div>
      )}
      {request.status === 'rejected' && (
        <div style={{ marginTop: '0.75rem', background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E74C3C', marginBottom: '0.4rem' }}>Rejected</div>
          <div style={{ fontSize: '0.82rem', color: '#FAF6F0' }}>{request.rejection_reason}</div>
        </div>
      )}

      {open && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(201,150,58,0.12)', paddingTop: '1rem' }}>
          {error && <div style={{ fontSize: '0.82rem', color: '#E74C3C', marginBottom: '0.5rem' }}>{error}</div>}
          {loadingDocs ? (
            <div style={{ fontSize: '0.82rem', color: '#8BA0B4' }}>Loading documents…</div>
          ) : docs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0', gap: '0.75rem' }}>
              <FileText size={28} color="rgba(201,150,58,0.4)" />
              <p style={S.p}>No documents uploaded yet.</p>
              <button style={S.btn()} onClick={() => setShowUpload(true)}>
                Upload First Document
              </button>
            </div>
          ) : (
            <>
              {docs.map(d => <DocRow key={d.token_id} doc={d} onDownload={onDownload} />)}
              <button style={{ ...S.btnSm, marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => setShowUpload(true)}>
                <Upload size={12} /> Add Document
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Compliance() {
  const [requests, setRequests] = useState<ComplianceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    apiGetComplianceRequests()
      .then(setRequests)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleDownload(tokenId: string) {
    setDownloading(tokenId)
    try {
      const { url, fileName } = await apiGetWalletDocumentUrl(tokenId)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.target = '_blank'
      a.click()
    } catch (e: unknown) {
      alert((e as Error).message || 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '2rem' }}>
        <span style={S.sLabel}>CA Compliance</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>
          Compliance &amp; Document Wallet
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#8BA0B4' }}>
          Every outward transfer gets a CA review under IT Act 2025. Upload your supporting documents here — your CA will certify Form 146 and file Form 145 on your behalf.
        </p>
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {Object.entries(STATUS_MAP).map(([key, s]) => {
          const Icon = s.icon
          const count = requests.filter(r => r.status === key).length
          return (
            <div key={key} style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.15)', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon size={14} color={s.color} />
              <span style={{ fontSize: '0.78rem', color: '#8BA0B4' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: s.color }}>{count}</span>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#8BA0B4' }}>Loading compliance requests…</div>
      ) : error ? (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', padding: '1rem', color: '#E74C3C', fontSize: '0.85rem' }}>{error}</div>
      ) : requests.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '3rem' }}>
          <ShieldCheck size={36} color="rgba(201,150,58,0.4)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ ...S.h3, marginBottom: '0.5rem' }}>No compliance requests yet</h3>
          <p style={S.p}>Compliance requests are created automatically when you initiate a transfer.</p>
        </div>
      ) : (
        requests.map(r => (
          <ComplianceCard key={r.id} request={r} onDownload={downloading ? () => {} : handleDownload} />
        ))
      )}

      {/* How it works */}
      <div style={{ ...S.card, marginTop: '2rem', background: 'rgba(201,150,58,0.04)' }}>
        <span style={S.sLabel}>How it works</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          {[
            { step: '1', title: 'Transfer initiated', desc: 'A compliance request is automatically created.' },
            { step: '2', title: 'Upload documents', desc: 'Add bank statement, TDS certificate, or other required docs.' },
            { step: '3', title: 'CA reviews', desc: 'Our CA reviews your transfer and documents within 2–4 hours.' },
            { step: '4', title: 'Forms in your wallet', desc: 'Signed Form 146 and Form 145 appear here for download.' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: 24, height: 24, background: 'rgba(201,150,58,0.15)', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#C9963A', flexShrink: 0 }}>{item.step}</div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FAF6F0', marginBottom: '0.2rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#8BA0B4', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
