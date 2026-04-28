import { Router, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';

const router = Router();
const BUCKET = 'wallet-docs';
const ts = () => new Date().toISOString();
const currentYear = () => new Date().getFullYear();

function generateTokenId(): string {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex, non-guessable
}

// ── POST /wallet/upload-url ───────────────────────────────────────────────────
// Step 1 of 2: client requests a signed upload URL.
// Server generates a token_id + Supabase Storage signed upload URL.
// Client PUT's the file directly to Supabase (never passes through Express).
router.post('/upload-url', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { fileName, mimeType, docType, year, complianceRequestId } = req.body as {
    fileName?: string;
    mimeType?: string;
    docType?: string;
    year?: number;
    complianceRequestId?: string;
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
    complianceRequestId: complianceRequestId ?? null,
    timestamp: ts(),
  });
});

// ── POST /wallet/confirm ──────────────────────────────────────────────────────
// Step 2 of 2: called AFTER client successfully PUT the file.
// Saves metadata to wallet_documents and returns the document record.
router.post('/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    tokenId, storagePath, fileName, mimeType, fileSizeBytes,
    docType, docLabel, year, complianceRequestId, transferId,
  } = req.body as {
    tokenId?: string; storagePath?: string; fileName?: string;
    mimeType?: string; fileSizeBytes?: number; docType?: string;
    docLabel?: string; year?: number; complianceRequestId?: string; transferId?: string;
  };

  if (!tokenId || !storagePath || !fileName || !docType) {
    res.status(400).json({ error: 'tokenId, storagePath, fileName, and docType are required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Storage not configured', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin.from('wallet_documents').insert({
    token_id:              tokenId,
    user_id:               req.userId,
    compliance_request_id: complianceRequestId ?? null,
    transfer_id:           transferId ?? null,
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

// ── GET /wallet ───────────────────────────────────────────────────────────────
// List all documents in the user's wallet.
// Query params: year (number), docType (string), complianceRequestId (uuid)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { year, docType, complianceRequestId } = req.query as {
    year?: string; docType?: string; complianceRequestId?: string;
  };

  if (!supabaseAdminConfigured) {
    res.json({ documents: [], count: 0, timestamp: ts() });
    return;
  }

  let query = supabaseAdmin
    .from('wallet_documents')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false });

  if (year) query = query.eq('year', parseInt(year));
  if (docType) query = query.eq('doc_type', docType);
  if (complianceRequestId) query = query.eq('compliance_request_id', complianceRequestId);

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.json({ documents: data ?? [], count: (data ?? []).length, timestamp: ts() });
});

// ── GET /wallet/:tokenId/url ──────────────────────────────────────────────────
// Returns a 1-hour signed download URL for a document the caller owns.
router.get('/:tokenId/url', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Storage not configured', timestamp: ts() });
    return;
  }

  const { data: doc, error: docErr } = await supabaseAdmin
    .from('wallet_documents')
    .select('storage_path, bucket_name, user_id, file_name')
    .eq('token_id', req.params.tokenId)
    .maybeSingle();

  if (docErr || !doc) {
    res.status(404).json({ error: 'Document not found', timestamp: ts() });
    return;
  }

  if (doc.user_id !== req.userId) {
    res.status(403).json({ error: 'Access denied', timestamp: ts() });
    return;
  }

  const { data: urlData, error: urlErr } = await supabaseAdmin.storage
    .from(doc.bucket_name)
    .createSignedUrl(doc.storage_path, 3600); // 1 hour

  if (urlErr || !urlData?.signedUrl) {
    res.status(500).json({ error: 'Failed to generate download URL', timestamp: ts() });
    return;
  }

  res.json({
    url: urlData.signedUrl,
    fileName: doc.file_name,
    expiresIn: 3600,
    timestamp: ts(),
  });
});

// ── GET /wallet/years ─────────────────────────────────────────────────────────
// Returns distinct years for which the user has documents (for filter dropdown).
router.get('/years', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ years: [], timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('wallet_documents')
    .select('year')
    .eq('user_id', req.userId!)
    .order('year', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  const years = [...new Set((data ?? []).map(d => d.year))];
  res.json({ years, timestamp: ts() });
});

export default router;
