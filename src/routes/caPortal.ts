import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  getAllTransfers,
  getTransferById,
  getPendingTransfers,
  updateTransferStatus,
  getCAUserByEmail,
} from '../data/store';
import { caAuthMiddleware, CARequest } from '../middleware/caAuth';
import { RBIPurposeCode, SourceOfFunds } from '../types/compliance';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { orchestrateAfterCAApproval } from '../orchestrator/outwardOrchestrator';
import { buildWisemanFields } from '../compliance/fifteenCBService';

const BUCKET = 'wallet-docs';

const router = Router();

const ts = () => new Date().toISOString();

// ── Human-readable labels ─────────────────────────────────────────────────────

const SOURCE_LABELS: Record<SourceOfFunds, string> = {
  rental_income:      'Rental Income',
  dividend_income:    'Dividend Income',
  property_sale:      'Property Sale Proceeds',
  pension:            'Pension',
  salary_arrears:     'Salary Arrears',
  matured_investment: 'Matured Investment',
  gift_from_relative: 'Gift from Relative',
  other:              'Other',
};

const PURPOSE_DESCRIPTIONS: Record<RBIPurposeCode, string> = {
  P1301: 'Repatriation of NRO funds — FEMA Section 6(4)',
  P1302: 'Repatriation of NRE funds — FEMA Section 6(4)',
  P0001: 'Indian investment abroad',
  S0001: 'Software services',
  P1101: 'Family maintenance',
};

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

// ── POST /ca/auth/login ───────────────────────────────────────────────────────
router.post('/auth/login', async (req, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password required', timestamp: ts() });
    return;
  }
  const user = getCAUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials', timestamp: ts() });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials', timestamp: ts() });
    return;
  }
  const secret = process.env.CA_JWT_SECRET || 'ca_secret_change_in_production';
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, icaiMembership: user.icaiMembership },
    secret,
    { expiresIn: '8h' },
  );
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, icaiMembership: user.icaiMembership },
    timestamp: ts(),
  });
});

// ── GET /ca/transfers ─────────────────────────────────────────────────────────
router.get('/transfers', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { status } = req.query as { status?: string };
  let transfers = await getAllTransfers();
  if (status) {
    transfers = transfers.filter(t => t.status === status);
  }
  res.json({ transfers, count: transfers.length, timestamp: ts() });
});

// ── GET /ca/transfers/pending ─────────────────────────────────────────────────
// Must be declared before /transfers/:id to avoid "pending" being treated as an id
router.get('/transfers/pending', caAuthMiddleware, async (_req: CARequest, res: Response) => {
  const pending = await getPendingTransfers();

  const enriched = pending.map(t => {
    const tRaw = t as unknown as Record<string, unknown>;
    const customerModel = tRaw['customer_model'] as string ?? 'p2p';
    const accountType   = tRaw['account_type'] as string ?? 'NRO';
    const nroBankName   = tRaw['nro_bank_name'] as string ?? t.nroBankName ?? 'Unknown';
    const nroBranchCity = tRaw['nro_branch_city'] as string ?? t.nroBranchCity ?? 'Unknown';
    const tdsRate       = t.tdsDeducted ? 0.30 : 0;

    const customerModelLabel =
      customerModel === 'citizen_nre' ? 'Citizen — NRE Account (EXEMPT)' :
      customerModel === 'citizen_nro' ? 'Citizen — NRO Account' :
      'P2P — NRO Account';

    const accountTypeLabel = `${accountType} (${nroBankName}, ${nroBranchCity})`;

    const fifteenCAPartLabel = t.fifteenCAPart === 'EXEMPT'
      ? 'EXEMPT — NRE account, no 15CA/15CB required'
      : `Part ${t.fifteenCAPart} — CA certification required`;

    const wiseman_fields = buildWisemanFields(
      t.panLast4 ?? 'N/A',
      t.customerName,
      t.sourceOfFunds,
      t.amountINR,
      t.amountCAD,
      t.purposeCode,
      tdsRate * 100,
    );

    return {
      ...t,
      customerModelLabel,
      accountTypeLabel,
      fifteenCAPartLabel,
      wiseman_fields,
      fableNote: 'Banking rails operated by Fable Fintech. FINTRAC filed by Fable for ≥ CAD 10K.',
    };
  });

  res.json({
    transfers: enriched,
    count: enriched.length,
    fableAttribution: 'Transfer execution via Fable Fintech (AD Cat-I bank + SWIFT). REPAIHUB handles compliance.',
    timestamp: ts(),
  });
});

// ── GET /ca/transfers/:id ─────────────────────────────────────────────────────
router.get('/transfers/:id', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const transfer = await getTransferById(req.params.id as string);
  if (!transfer) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }
  res.json({ transfer, timestamp: ts() });
});

// ── GET /ca/transfers/:id/form ────────────────────────────────────────────────
router.get('/transfers/:id/form', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const transfer = await getTransferById(req.params.id as string);
  if (!transfer) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  const created = new Date(transfer.createdAt);
  const slaHours = transfer.priority === 'express' ? 4 : 24;
  const deadlineMs = created.getTime() + slaHours * 3600000;
  const deadline = new Date(deadlineMs);
  const slaHoursRemaining = Math.max(0, (deadlineMs - Date.now()) / 3600000);

  const primaryTdsRate = transfer.sourceBreakdown[0]?.tdsRate ?? 0.30;

  const form = {
    formMeta: {
      generatedAt: ts(),
      transferId: transfer.id,
      fifteenCAPart: transfer.fifteenCAPart,
      fifteenCBRequired: transfer.fifteenCBRequired,
      filingDeadline: deadline.toISOString(),
      slaHoursRemaining: parseFloat(slaHoursRemaining.toFixed(2)),
    },

    remitterDetails: {
      fullName: transfer.customerName,
      email: transfer.customerEmail,
      panDisplay: transfer.panLast4 === 'N/A' ? 'PAN not provided' : `PAN ending ****${transfer.panLast4}`,
      panHash: transfer.panHash,
      residencyStatus: 'Non-Resident Indian — Canada',
      countryOfResidence: 'Canada',
    },

    bankDetails: {
      nroBank: transfer.nroBankName,
      nroBranch: transfer.nroBranchCity,
      adBank: transfer.adBankName,
      canadianBank: transfer.canadianBankName,
      swiftCountry: 'Canada',
    },

    remittanceDetails: {
      amountINR: transfer.amountINR,
      amountCAD: transfer.amountCAD,
      exchangeRate: transfer.exchangeRate,
      purposeCode: transfer.purposeCode,
      purposeDescription: PURPOSE_DESCRIPTIONS[transfer.purposeCode] ?? transfer.purposeCode,
      sourceOfFunds: SOURCE_LABELS[transfer.sourceOfFunds] || transfer.sourceOfFunds,
      sourceBreakdown: transfer.sourceBreakdown.map(s => ({
        type: SOURCE_LABELS[s.type] || s.type,
        amountINR: s.amountINR,
        tdsDeducted: s.tdsDeducted,
        tdsRate: `${(s.tdsRate * 100).toFixed(0)}%`,
      })),
      financialYearCumulative: transfer.financialYearCumulativeINR,
      isFirstRemittanceThisYear: transfer.financialYearCumulativeINR === transfer.amountINR,
    },

    taxDetails: {
      tdsDeducted: transfer.tdsDeducted,
      tdsAmountINR: transfer.tdsAmountINR,
      tdsReference: transfer.tdsReference,
      taxableUnderITA: true,
      applicableDTAA: 'India-Canada DTAA — 1996',
      dtaaArticle: 'Article 23 — Other Income',
      withholdingTaxRate: transfer.tdsDeducted ? `${(primaryTdsRate * 100).toFixed(0)}%` : '0%',
      tdsVerificationRequired: true,
    },

    fifteenCBChecklist: {
      sourceOfFundsVerified: false,
      tdsVerifiedIn26AS: false,
      dtaaReliefAssessed: false,
      femaComplianceConfirmed: false,
      remittancePurposeVerified: false,
      wisemanInputReady: false,
    },

    wisemanFields: {
      assessee_pan: transfer.panLast4 === 'N/A' ? 'PAN not provided' : `PAN ending ****${transfer.panLast4}`,
      assessee_name: transfer.customerName,
      nature_of_remittance: SOURCE_LABELS[transfer.sourceOfFunds] || transfer.sourceOfFunds,
      amount_in_inr: formatINR(transfer.amountINR),
      amount_in_foreign_currency: transfer.amountCAD.toFixed(2),
      foreign_currency_code: 'CAD',
      country_of_remittance: 'Canada',
      bank_name: transfer.adBankName,
      purpose_code: transfer.purposeCode,
      tds_amount: formatINR(transfer.tdsAmountINR),
      tds_section: '195',
      rate_of_tds: transfer.tdsDeducted ? `${(primaryTdsRate * 100).toFixed(0)}%` : '0%',
      dtaa_applicable: 'Yes — India-Canada DTAA 1996',
      dtaa_article: 'Article 23 — Other Income',
      ca_name: req.caUser?.name || '',
      ca_icai_no: req.caUser?.icaiMembership || '',
      ca_date: new Date().toLocaleDateString('en-IN'),
    },
  };

  res.json({ form, timestamp: ts() });
});

// ── POST /ca/transfers/:id/approve ────────────────────────────────────────────
router.post('/transfers/:id/approve', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { cbNumber, remarks } = req.body as { cbNumber?: string; remarks?: string };
  if (!cbNumber || !remarks || remarks.length < 20) {
    res.status(400).json({
      error: 'cbNumber and remarks (minimum 20 characters) are required',
      timestamp: ts(),
    });
    return;
  }
  const updated = await updateTransferStatus(req.params.id as string, '15CB_RECEIVED', {
    fifteenCBNumber: cbNumber,
    caRemarks: remarks,
    caApprovedAt: ts(),
    caApprovedBy: req.caUser?.name || 'CA',
  });
  if (!updated) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  // Trigger Fable execution now that CA has certified 15CB
  // [ORANGE] Fable will debit the customer's Indian bank via AD bank and SWIFT
  setImmediate(() => {
    orchestrateAfterCAApproval(req.params.id as string).catch(err =>
      console.error('[CA-PORTAL] orchestrateAfterCAApproval failed (non-critical):', err));
  });

  res.json({
    transfer: updated,
    message: '15CB certified successfully. Fable will now execute transfer via AD bank.',
    note: 'SWIFT execution handled by Fable Fintech. REPAIHUB will receive webhook on completion.',
    timestamp: ts(),
  });
});

// ── POST /ca/transfers/:id/reject ─────────────────────────────────────────────
router.post('/transfers/:id/reject', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { reason } = req.body as { reason?: string };
  if (!reason || reason.trim().length === 0) {
    res.status(400).json({ error: 'reason is required', timestamp: ts() });
    return;
  }
  const updated = await updateTransferStatus(req.params.id as string, 'FAILED', {
    caRemarks: `REJECTED: ${reason}`,
    caApprovedAt: ts(),
    caApprovedBy: req.caUser?.name || 'CA',
  });
  if (!updated) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }
  res.json({ transfer: updated, message: 'Transfer rejected', timestamp: ts() });
});

// ── POST /ca/transfers/:id/15ca-filed ─────────────────────────────────────────
router.post('/transfers/:id/15ca-filed', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { caNumber } = req.body as { caNumber?: string };
  if (!caNumber || caNumber.trim().length === 0) {
    res.status(400).json({ error: 'caNumber is required', timestamp: ts() });
    return;
  }
  const updated = await updateTransferStatus(req.params.id as string, '15CA_FILED', {
    fifteenCANumber: caNumber,
  });
  if (!updated) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }
  res.json({ transfer: updated, message: '15CA marked as filed', timestamp: ts() });
});

// ── GET /ca/compliance ────────────────────────────────────────────────────────
// List all compliance requests (CA sees all). Filterable by status.
router.get('/compliance', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ requests: [], count: 0, timestamp: ts() });
    return;
  }

  const { status } = req.query as { status?: string };

  let query = supabaseAdmin
    .from('compliance_requests')
    .select(`
      *,
      transfers (
        id, amount_inr, amount_cad, exchange_rate, purpose_code,
        source_of_funds, speed, reference, status,
        commission_cad, flat_fee_cad, total_fees_cad, net_amount_cad
      ),
      wallet_documents (count)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.json({ requests: data ?? [], count: (data ?? []).length, timestamp: ts() });
});

// ── GET /ca/compliance/:id ────────────────────────────────────────────────────
router.get('/compliance/:id', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data: request, error } = await supabaseAdmin
    .from('compliance_requests')
    .select(`
      *,
      transfers (*, profiles!transfers_user_id_fkey(full_name, email)),
      wallet_documents (*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !request) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  res.json({ request, timestamp: ts() });
});

// ── POST /ca/compliance/:id/approve ──────────────────────────────────────────
router.post('/compliance/:id/approve', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { cbNumber, remarks, fifteen_ca_part } = req.body as {
    cbNumber?: string; remarks?: string; fifteen_ca_part?: string;
  };

  if (!cbNumber || !remarks || remarks.length < 10) {
    res.status(400).json({ error: 'cbNumber and remarks (min 10 chars) are required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .update({
      status:           'approved',
      fifteen_cb_number: cbNumber,
      ca_remarks:       remarks,
      ca_reviewed_by:   req.caUser?.name || 'CA',
      ca_reviewed_at:   ts(),
      ...(fifteen_ca_part ? { fifteen_ca_part } : {}),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  res.json({ request: data, message: '15CB certified — compliance request approved', timestamp: ts() });
});

// ── POST /ca/compliance/:id/reject ────────────────────────────────────────────
router.post('/compliance/:id/reject', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { reason } = req.body as { reason?: string };
  if (!reason || reason.trim().length === 0) {
    res.status(400).json({ error: 'reason is required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .update({
      status:           'rejected',
      rejection_reason: reason,
      ca_reviewed_by:   req.caUser?.name || 'CA',
      ca_reviewed_at:   ts(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  res.json({ request: data, message: 'Compliance request rejected', timestamp: ts() });
});

// ── POST /ca/compliance/:id/upload-pdf-url ────────────────────────────────────
// CA requests a signed upload URL to upload 15CB/15CA PDF into the user's wallet.
router.post('/compliance/:id/upload-pdf-url', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { fileName, mimeType, docType } = req.body as {
    fileName?: string; mimeType?: string; docType?: string;
  };

  if (!fileName || !docType) {
    res.status(400).json({ error: 'fileName and docType are required', timestamp: ts() });
    return;
  }
  if (!['15ca_pdf', '15cb_pdf'].includes(docType)) {
    res.status(400).json({ error: 'docType must be 15ca_pdf or 15cb_pdf', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Storage not configured', timestamp: ts() });
    return;
  }

  const { data: request, error: reqErr } = await supabaseAdmin
    .from('compliance_requests')
    .select('id, user_id, transfer_id')
    .eq('id', req.params.id)
    .single();

  if (reqErr || !request) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  const tokenId = crypto.randomBytes(32).toString('hex');
  const year = new Date().getFullYear();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath = `${request.user_id}/${year}/${tokenId}_${safeFileName}`;

  const { data: urlData, error: urlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (urlErr) {
    res.status(500).json({ error: 'Failed to create upload URL: ' + urlErr.message, timestamp: ts() });
    return;
  }

  res.json({
    tokenId,
    storagePath,
    signedUrl: urlData.signedUrl,
    userId: request.user_id,
    transferId: request.transfer_id,
    timestamp: ts(),
  });
});

// ── POST /ca/compliance/:id/confirm-pdf ──────────────────────────────────────
// CA confirms upload of 15CB/15CA PDF — saves to user's wallet as 'ca' upload.
router.post('/compliance/:id/confirm-pdf', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const {
    tokenId, storagePath, fileName, mimeType, fileSizeBytes, docType, docLabel,
  } = req.body as {
    tokenId?: string; storagePath?: string; fileName?: string;
    mimeType?: string; fileSizeBytes?: number; docType?: string; docLabel?: string;
  };

  if (!tokenId || !storagePath || !fileName || !docType) {
    res.status(400).json({ error: 'tokenId, storagePath, fileName, docType are required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data: request, error: reqErr } = await supabaseAdmin
    .from('compliance_requests')
    .select('id, user_id, transfer_id')
    .eq('id', req.params.id)
    .single();

  if (reqErr || !request) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin.from('wallet_documents').insert({
    token_id:              tokenId,
    user_id:               request.user_id,
    compliance_request_id: req.params.id,
    transfer_id:           request.transfer_id,
    doc_type:              docType,
    doc_label:             docLabel ?? fileName,
    storage_path:          storagePath,
    bucket_name:           BUCKET,
    file_name:             fileName,
    file_size_bytes:       fileSizeBytes ?? null,
    mime_type:             mimeType ?? null,
    year:                  new Date().getFullYear(),
    uploaded_by:           'ca',
  }).select().single();

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.status(201).json({ document: data, message: 'PDF uploaded to user wallet', timestamp: ts() });
});

// ── POST /ca/compliance/:id/file-15ca ─────────────────────────────────────────
router.post('/compliance/:id/file-15ca', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { caNumber } = req.body as { caNumber?: string };
  if (!caNumber || caNumber.trim().length === 0) {
    res.status(400).json({ error: 'caNumber is required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .update({ fifteen_ca_number: caNumber.trim() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  res.json({ request: data, message: '15CA number recorded', timestamp: ts() });
});

// ── GET /ca/compliance/:id/wallet-doc/:tokenId/url ────────────────────────────
// CA can generate a signed download URL for any document in a compliance request.
router.get('/compliance/:id/wallet-doc/:tokenId/url', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Storage not configured', timestamp: ts() });
    return;
  }

  const { data: doc, error } = await supabaseAdmin
    .from('wallet_documents')
    .select('storage_path, bucket_name, file_name, compliance_request_id')
    .eq('token_id', req.params.tokenId)
    .maybeSingle();

  if (error || !doc) {
    res.status(404).json({ error: 'Document not found', timestamp: ts() });
    return;
  }

  if (doc.compliance_request_id !== req.params.id) {
    res.status(403).json({ error: 'Document does not belong to this compliance request', timestamp: ts() });
    return;
  }

  const { data: urlData, error: urlErr } = await supabaseAdmin.storage
    .from(doc.bucket_name)
    .createSignedUrl(doc.storage_path, 3600);

  if (urlErr || !urlData?.signedUrl) {
    res.status(500).json({ error: 'Failed to generate download URL', timestamp: ts() });
    return;
  }

  res.json({ url: urlData.signedUrl, fileName: doc.file_name, expiresIn: 3600, timestamp: ts() });
});

// ── GET /ca/stats ─────────────────────────────────────────────────────────────
router.get('/stats', caAuthMiddleware, async (_req: CARequest, res: Response) => {
  const all = await getAllTransfers();
  const pending = await getPendingTransfers();
  const today = new Date().toDateString();
  const now = new Date();

  const approvedToday = all.filter(
    t => t.caApprovedAt && new Date(t.caApprovedAt).toDateString() === today,
  ).length;

  const expressCount = pending.filter(t => t.priority === 'express').length;

  const monthlyVolumeINR = all
    .filter(t => {
      const d = new Date(t.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amountINR, 0);

  res.json({
    pendingCount: pending.length,
    approvedToday,
    expressCount,
    monthlyVolumeINR,
    monthlyVolumeFormatted: formatINR(monthlyVolumeINR),
    timestamp: ts(),
  });
});

export default router;
