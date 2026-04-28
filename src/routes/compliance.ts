import { Router, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';

const router = Router();
const BUCKET = 'wallet-docs';
const ts = () => new Date().toISOString();
const currentYear = () => new Date().getFullYear();

function generateTokenId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── GET /compliance ───────────────────────────────────────────────────────────
// List user's compliance requests with linked document counts.
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ requests: [], count: 0, timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .select(`
      *,
      wallet_documents(count)
    `)
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.json({ requests: data ?? [], count: (data ?? []).length, timestamp: ts() });
});

// ── GET /compliance/:id ───────────────────────────────────────────────────────
// Single compliance request with all linked wallet documents.
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(404).json({ error: 'Not found', timestamp: ts() });
    return;
  }

  const { data: request, error } = await supabaseAdmin
    .from('compliance_requests')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (error || !request) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  const { data: documents } = await supabaseAdmin
    .from('wallet_documents')
    .select('*')
    .eq('compliance_request_id', req.params.id)
    .order('created_at', { ascending: false });

  res.json({ request, documents: documents ?? [], timestamp: ts() });
});

// ── POST /compliance/:id/upload-url ──────────────────────────────────────────
// Request a signed upload URL linked to a compliance request.
// Returns tokenId + signed URL; client uploads directly to Supabase Storage.
router.post('/:id/upload-url', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { fileName, mimeType, docType, year } = req.body as {
    fileName?: string; mimeType?: string; docType?: string; year?: number;
  };

  if (!fileName || !docType) {
    res.status(400).json({ error: 'fileName and docType are required', timestamp: ts() });
    return;
  }

  const validTypes = [
    'bank_statement','tds_certificate','pan_card','aadhaar',
    'property_deed','investment_proof','15ca_pdf','15cb_pdf','other',
  ];
  if (!validTypes.includes(docType)) {
    res.status(400).json({ error: `Invalid docType. Must be one of: ${validTypes.join(', ')}`, timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Storage not configured', timestamp: ts() });
    return;
  }

  // Verify the compliance request belongs to this user
  const { data: request, error: reqErr } = await supabaseAdmin
    .from('compliance_requests')
    .select('id, transfer_id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (reqErr || !request) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  const tokenId = generateTokenId();
  const fileYear = year ?? currentYear();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath = `${req.userId}/${fileYear}/${tokenId}_${safeFileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error) {
    res.status(500).json({ error: 'Failed to create upload URL: ' + error.message, timestamp: ts() });
    return;
  }

  res.json({
    tokenId,
    storagePath,
    signedUrl: data.signedUrl,
    year: fileYear,
    complianceRequestId: req.params.id,
    transferId: request.transfer_id,
    timestamp: ts(),
  });
});

// ── POST /compliance/:id/confirm-upload ──────────────────────────────────────
// Called after client successfully PUT the file to Supabase Storage.
// Saves metadata to wallet_documents, linked to both compliance_request + transfer.
router.post('/:id/confirm-upload', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    tokenId, storagePath, fileName, mimeType, fileSizeBytes, docType, docLabel, year,
  } = req.body as {
    tokenId?: string; storagePath?: string; fileName?: string;
    mimeType?: string; fileSizeBytes?: number; docType?: string;
    docLabel?: string; year?: number;
  };

  if (!tokenId || !storagePath || !fileName || !docType) {
    res.status(400).json({ error: 'tokenId, storagePath, fileName, and docType are required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Storage not configured', timestamp: ts() });
    return;
  }

  // Verify ownership
  const { data: request, error: reqErr } = await supabaseAdmin
    .from('compliance_requests')
    .select('id, transfer_id')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (reqErr || !request) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin.from('wallet_documents').insert({
    token_id:              tokenId,
    user_id:               req.userId,
    compliance_request_id: req.params.id,
    transfer_id:           request.transfer_id,
    doc_type:              docType,
    doc_label:             docLabel ?? fileName,
    storage_path:          storagePath,
    bucket_name:           BUCKET,
    file_name:             fileName,
    file_size_bytes:       fileSizeBytes ?? null,
    mime_type:             mimeType ?? null,
    year:                  year ?? currentYear(),
    uploaded_by:           'user',
  }).select().single();

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.status(201).json({ document: data, timestamp: ts() });
});

export default router;
