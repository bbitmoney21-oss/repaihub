// NOTE: Under India Income Tax Act 2025 (effective 1 Apr 2026):
// Form 15CA is now Form 145 | Form 15CB is now Form 146
// Section 195 is now Section 397(3)(d)
// File on: incometax.gov.in → e-File → Income Tax Forms → Form 146

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
import { withRetry } from '../services/retryService';

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
// CHALLENGE 5 FIX: CA only sees what requires their action.
// Split into two queues: BLOCKED (caBlocking=true) and PARALLEL (caBlocking=false).
// Never shows: LOW risk, NRE, inward, completed transfers.
router.get('/transfers/pending', caAuthMiddleware, async (_req: CARequest, res: Response) => {
  const allPending = await getPendingTransfers();

  // Filter: only transfers where Form 146 is required AND status = FORM146_REQUESTED
  const caQueue = allPending.filter(t => {
    // Skip NRE (form146Required=false, form145Part=EXEMPT)
    if (t.form145Part === 'EXEMPT') return false;
    // Skip LOW risk auto-approvals (form146Required=false)
    if (!t.form146Required) return false;
    // Only show FORM146_REQUESTED status
    if (t.status !== 'FORM146_REQUESTED') return false;
    return true;
  });

  const enriched = caQueue.map(t => {
    const tRaw = t as unknown as Record<string, unknown>;
    const customerModel = tRaw['customer_model'] as string ?? 'p2p';
    const accountType   = tRaw['account_type'] as string ?? 'NRO';
    const nroBankName   = tRaw['nro_bank_name'] as string ?? t.nroBankName ?? 'Unknown';
    const nroBranchCity = tRaw['nro_branch_city'] as string ?? t.nroBranchCity ?? 'Unknown';
    const tdsRate       = t.tdsDeducted ? 0.30 : 0;
    const caBlocking    = (tRaw['ca_blocking'] as boolean) ?? false;

    const form145PartLabel = t.form145Part === 'EXEMPT'
      ? 'EXEMPT — NRE account, no Form 145/146 required'
      : `Part ${t.form145Part} — Form 146 certification required (IT Act 2025)`;

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
      customerModelLabel: customerModel === 'citizen_nre' ? 'Citizen — NRE Account (EXEMPT)' :
        customerModel === 'citizen_nro' ? 'Citizen — NRO Account' : 'P2P — NRO Account',
      accountTypeLabel: `${accountType} (${nroBankName}, ${nroBranchCity})`,
      form145PartLabel,
      caBlocking,
      wiseman_fields,
      fableNote: 'Banking rails operated by Fable Fintech. FINTRAC filed by Fable for ≥ CAD 10K.',
    };
  });

  // Split into two queues
  const blocked  = enriched.filter(t => t.caBlocking);   // HIGH risk — BLOCKS transfer
  const parallel = enriched.filter(t => !t.caBlocking);  // MEDIUM risk — transfer proceeds in parallel

  // Sort: oldest first (most urgent)
  blocked.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  parallel.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({
    blocked,
    parallel,
    blockedCount:  blocked.length,
    parallelCount: parallel.length,
    // Backward-compat: merged list for old dashboard code
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
  const slaHoursRemaining = Math.max(0, (deadlineMs - Date.now()) / 3600000);
  const primaryTdsRate = transfer.sourceBreakdown[0]?.tdsRate ?? 0.30;

  const form = {
    formMeta: {
      generatedAt: ts(),
      transferId: transfer.id,
      // IT Act 2025 form names
      form145Part: transfer.form145Part,
      form146Required: transfer.form146Required,
      filingDeadline: new Date(deadlineMs).toISOString(),
      slaHoursRemaining: parseFloat(slaHoursRemaining.toFixed(2)),
      taxActVersion: '2025',
      note: 'Form 15CB renamed to Form 146, Form 15CA renamed to Form 145 under IT Act 2025',
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
      // IT Act 2025: Section 397(3)(d) replaces Section 195
      tdsSection: '397(3)(d) [IT Act 2025] / 195 [IT Act 1961 — legacy]',
      withholdingTaxRate: transfer.tdsDeducted ? `${(primaryTdsRate * 100).toFixed(0)}%` : '0%',
      tdsVerificationRequired: true,
    },

    form146Checklist: {
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
      // IT Act 2025: Section 397(3)(d) replaces Section 195
      tds_section: '397(3)(d) [IT Act 2025] / 195 [IT Act 1961 — legacy]',
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

// ── GET /ca/transfers/:id/wiseman-export ──────────────────────────────────────
// Returns pre-formatted WISEMAN data for Form 146 preparation.
// Frontend uses this to generate the downloadable .txt file.
router.get('/transfers/:id/wiseman-export', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const transfer = await getTransferById(req.params.id as string);
  if (!transfer) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  const primaryTdsRate = transfer.sourceBreakdown[0]?.tdsRate ?? 0.30;
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const lines = [
    '================================',
    'REPAIHUB — Form 146 Data Export',
    `Transfer ID: ${transfer.id}`,
    `Reference: ${(transfer as unknown as Record<string, unknown>)['reference'] ?? 'N/A'}`,
    `Generated: ${now} IST`,
    '================================',
    `ASSESSEE_NAME: ${transfer.customerName}`,
    `ASSESSEE_PAN: ****${transfer.panLast4}`,
    `NATURE_OF_REMITTANCE: ${SOURCE_LABELS[transfer.sourceOfFunds] || transfer.sourceOfFunds}`,
    `AMOUNT_INR: ₹${transfer.amountINR.toLocaleString('en-IN')}`,
    `AMOUNT_FOREIGN_CURRENCY: CAD ${transfer.amountCAD.toFixed(2)}`,
    `CURRENCY_CODE: CAD`,
    `COUNTRY_OF_REMITTANCE: Canada`,
    `AD_BANK: ${transfer.adBankName} (via Fable Fintech)`,
    `PURPOSE_CODE: ${transfer.purposeCode}`,
    `TDS_SECTION: 397(3)(d) [IT Act 2025] / 195 [IT Act 1961 — legacy]`,
    `TDS_RATE: ${transfer.tdsDeducted ? `${(primaryTdsRate * 100).toFixed(0)}%` : '0%'}`,
    `TDS_AMOUNT_INR: ₹${transfer.tdsAmountINR.toLocaleString('en-IN')}`,
    `TDS_CERTIFICATE_REF: ${transfer.tdsReference || 'N/A'}`,
    `DTAA_APPLICABLE: Yes`,
    `DTAA_ARTICLE: Article 23 — India-Canada DTAA 1996`,
    `FINANCIAL_YEAR: ${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-${String(new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear()).slice(-2)}`,
    `FORM_145_PART: Part ${transfer.form145Part}`,
    `CUMULATIVE_TRANSFERS_FY: ₹${transfer.financialYearCumulativeINR.toLocaleString('en-IN')}`,
    '================================',
    'CA CHECKLIST:',
    '[ ] Form 26AS downloaded and verified',
    '[ ] TDS certificate checked against Form 26AS',
    '[ ] DTAA applicability confirmed (Article 23 — India-Canada DTAA 1996)',
    '[ ] Source of funds documents reviewed',
    '[ ] Remittance amount matches bank statement',
    '[ ] FEMA compliance confirmed (USD 1M annual limit)',
    '================================',
    'ENTER AFTER FILING ON INCOMETAX.GOV.IN:',
    'Form 146 Ack Number: _________________________',
    'Filed on IT Portal (date): ___________________',
    `CA Name: ${req.caUser?.name || '____________________________________'}`,
    `ICAI Membership Number: ${req.caUser?.icaiMembership || '_____________________'}`,
    '================================',
    'After filing, enter the Form 146 Ack Number',
    'in the REPAIHUB CA Portal and click CERTIFY.',
    '================================',
  ];

  res.json({
    exportText: lines.join('\n'),
    transferId: transfer.id,
    customerName: transfer.customerName,
    timestamp: ts(),
  });
});

// ── POST /ca/transfers/:id/approve ────────────────────────────────────────────
// CA certifies Form 146 — marks transfer as FORM146_RECEIVED and triggers Fable.
// CHALLENGE 4 FIX: Fetches fresh exchange rate at CA approval time.
router.post('/transfers/:id/approve', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { cbNumber, remarks } = req.body as { cbNumber?: string; remarks?: string };
  if (!cbNumber || !remarks || remarks.length < 20) {
    res.status(400).json({
      error: 'cbNumber (Form 146 Ack number) and remarks (minimum 20 characters) are required',
      timestamp: ts(),
    });
    return;
  }

  const updated = await updateTransferStatus(req.params.id as string, 'FORM146_RECEIVED', {
    form146Number: cbNumber,
    caRemarks: remarks,
    caApprovedAt: ts(),
    caApprovedBy: req.caUser?.name || 'CA',
  });
  if (!updated) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }

  // Notify customer that Form 146 is certified (non-blocking)
  if (supabaseAdminConfigured) {
    void (async () => {
      try {
        const { data: xfer } = await supabaseAdmin.from('transfers').select('user_id, amount_inr, amount_cad').eq('id', req.params.id).single();
        if (xfer) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', xfer.user_id).single();
          if (profile) {
            const { notifyTransferStatusChange } = await import('../services/notifications.js');
            await notifyTransferStatusChange({
              customerEmail: profile.email ?? '',
              customerName:  profile.full_name ?? 'Customer',
              transferId:    req.params.id as string,
              amountINR:     Number(xfer.amount_inr ?? 0),
              amountCAD:     Number(xfer.amount_cad ?? 0),
              status:        'form146_received',
            });
          }
        }
      } catch { /* non-critical */ }
    })();
  }

  // Challenge 4: Refresh rate at CA certification time — orchestrateAfterCAApproval
  // fetches fresh rate from Fable before building the execution instruction.
  setImmediate(() => {
    withRetry(
      () => orchestrateAfterCAApproval(req.params.id as string),
      { label: 'orchestrateAfterCAApproval', maxAttempts: 3 },
    ).catch(err =>
      console.error('[CA-PORTAL] orchestrateAfterCAApproval failed after retries:', err));
  });

  res.json({
    transfer: updated,
    message: 'Form 146 certified successfully. Fable will now execute transfer via AD bank.',
    note: 'Rate refreshed at CA approval time (IT Act 2025 compliance). SWIFT execution via Fable Fintech.',
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

// ── POST /ca/transfers/:id/form145-filed ─────────────────────────────────────
// CA records Form 145 acknowledgement number after filing on IT portal.
router.post('/transfers/:id/form145-filed', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { caNumber } = req.body as { caNumber?: string };
  if (!caNumber || caNumber.trim().length === 0) {
    res.status(400).json({ error: 'caNumber (Form 145 Ack number) is required', timestamp: ts() });
    return;
  }
  const updated = await updateTransferStatus(req.params.id as string, 'FORM145_FILED', {
    form145Number: caNumber,
  });
  if (!updated) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }
  res.json({ transfer: updated, message: 'Form 145 marked as filed (IT Act 2025)', timestamp: ts() });
});

// ── GET /ca/compliance ────────────────────────────────────────────────────────
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

  // 'needs_action' is a meta-filter that surfaces every compliance row a CA
  // still has to touch — both 'pending' (Part A audit rows + HIGH-risk holds)
  // AND 'under_review' (Form 146 in-progress).  Without it the dashboard chip
  // would only show under_review and silently hide the AUDIT_REVIEW queue.
  if (status === 'needs_action') {
    query = query.in('status', ['pending', 'under_review']);
  } else if (status) {
    query = query.eq('status', status);
  }

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

const UDIN_REGEX = /^\d{18}$/;

// ── POST /ca/compliance/:id/approve ──────────────────────────────────────────
router.post('/compliance/:id/approve', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { cbNumber, remarks, fifteen_ca_part, udin } = req.body as {
    cbNumber?: string; remarks?: string; fifteen_ca_part?: string; udin?: string;
  };

  if (!cbNumber || !remarks || remarks.length < 10) {
    res.status(400).json({ error: 'cbNumber and remarks (min 10 chars) are required', timestamp: ts() });
    return;
  }
  if (udin && !UDIN_REGEX.test(udin)) {
    res.status(400).json({ error: 'Invalid UDIN format — must be exactly 18 digits', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .update({
      status:            'approved',
      fifteen_cb_number: cbNumber,   // legacy column (always exists)
      form146_number:    cbNumber,   // IT Act 2025 column (exists after migration 022)
      ca_remarks:        remarks,
      ca_reviewed_by:    req.caUser?.name || 'CA',
      ca_reviewed_at:    ts(),
      ...(fifteen_ca_part ? { fifteen_ca_part, form145_part: fifteen_ca_part } : {}),
      ...(udin ? { udin } : {}),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  res.json({ request: data, message: 'Form 146 certified — compliance request approved (IT Act 2025)', timestamp: ts() });
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
router.post('/compliance/:id/upload-pdf-url', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { fileName, mimeType, docType } = req.body as {
    fileName?: string; mimeType?: string; docType?: string;
  };

  if (!fileName || !docType) {
    res.status(400).json({ error: 'fileName and docType are required', timestamp: ts() });
    return;
  }
  // Accept both old (15ca_pdf/15cb_pdf) and new (form145_pdf/form146_pdf) doc types
  const validDocTypes = ['15ca_pdf', '15cb_pdf', 'form145_pdf', 'form146_pdf'];
  if (!validDocTypes.includes(docType)) {
    res.status(400).json({ error: `docType must be one of: ${validDocTypes.join(', ')}`, timestamp: ts() });
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

  res.json({ tokenId, storagePath, signedUrl: urlData.signedUrl, userId: request.user_id, transferId: request.transfer_id, timestamp: ts() });
});

// ── POST /ca/compliance/:id/confirm-pdf ──────────────────────────────────────
router.post('/compliance/:id/confirm-pdf', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { tokenId, storagePath, fileName, mimeType, fileSizeBytes, docType, docLabel } = req.body as {
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

// ── POST /ca/compliance/:id/file-form145 ──────────────────────────────────────
// CA records Form 145 Ack Number after filing on IT portal.
router.post('/compliance/:id/file-form145', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { caNumber } = req.body as { caNumber?: string };
  if (!caNumber || caNumber.trim().length === 0) {
    res.status(400).json({ error: 'caNumber (Form 145 Ack number) is required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .update({
      fifteen_ca_number: caNumber.trim(),  // legacy column (always exists)
      form145_number:    caNumber.trim(),  // IT Act 2025 column (exists after migration 022)
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }

  res.json({ request: data, message: 'Form 145 Ack number recorded (IT Act 2025)', timestamp: ts() });
});

// Backward-compat alias — old endpoint name redirects to file-form145
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
    .update({
      fifteen_ca_number: caNumber.trim(),
      form145_number:    caNumber.trim(),
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'Compliance request not found', timestamp: ts() });
    return;
  }
  res.json({ request: data, message: 'Form 145 Ack number recorded', timestamp: ts() });
});

// ── GET /ca/compliance/:id/wallet-doc/:tokenId/url ────────────────────────────
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

  const blockedCount = pending.filter(t => {
    const tRaw = t as unknown as Record<string, unknown>;
    return t.form146Required && t.status === 'FORM146_REQUESTED' && tRaw['ca_blocking'] === true;
  }).length;

  res.json({
    pendingCount: pending.length,
    blockedCount,
    approvedToday,
    expressCount,
    monthlyVolumeINR,
    monthlyVolumeFormatted: formatINR(monthlyVolumeINR),
    timestamp: ts(),
  });
});

// ── GET /ca/queue ─────────────────────────────────────────────────────────────
// Alias for /ca/compliance?status=pending,under_review — surfaces the CA filing queue
// from the existing compliance_requests table (no new table required).
router.get('/queue', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ queue: [], blockedCount: 0, parallelCount: 0, timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .select(`
      *,
      transfers (
        id, amount_inr, amount_cad, net_amount_cad, exchange_rate,
        purpose_code, source_of_funds, speed, reference, status,
        form145_part, fifteen_ca_part, ca_blocking, risk_level,
        nro_bank_name, nro_branch_city, account_type, customer_model
      )
    `)
    .in('status', ['pending', 'under_review'])
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  const queue = data ?? [];
  const blocked  = queue.filter(r => (r as Record<string,unknown>).transfers &&
    ((r as Record<string,unknown>).transfers as Record<string,unknown>).ca_blocking === true);
  const parallel = queue.filter(r => !blocked.includes(r));

  res.json({
    queue,
    blocked,
    parallel,
    blockedCount:  blocked.length,
    parallelCount: parallel.length,
    totalCount:    queue.length,
    caQueueEnabled: true,
    note: 'Queue sourced from compliance_requests table. UDIN required on submit.',
    timestamp: ts(),
  });
});

// ── POST /ca/queue/:id/submit ─────────────────────────────────────────────────
// CA submits UDIN + Form 146 cert number for a compliance_request in the queue.
// This is equivalent to /ca/compliance/:id/approve but enforces UDIN presence.
router.post('/queue/:id/submit', caAuthMiddleware, async (req: CARequest, res: Response) => {
  const { cbNumber, udin, remarks } = req.body as {
    cbNumber?: string; udin?: string; remarks?: string;
  };

  if (!cbNumber || cbNumber.trim().length < 5) {
    res.status(400).json({ error: 'cbNumber (Form 146 Ack number) is required', timestamp: ts() });
    return;
  }
  if (!udin) {
    res.status(400).json({ error: 'udin is required for queue submission (18-digit ICAI code)', timestamp: ts() });
    return;
  }
  if (!UDIN_REGEX.test(udin)) {
    res.status(400).json({ error: 'Invalid UDIN — must be exactly 18 digits as issued by ICAI portal', timestamp: ts() });
    return;
  }
  if (!remarks || remarks.trim().length < 10) {
    res.status(400).json({ error: 'remarks (min 10 chars) are required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'DB not configured', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_requests')
    .update({
      status:            'approved',
      fifteen_cb_number: cbNumber.trim(),
      form146_number:    cbNumber.trim(),
      ca_remarks:        remarks.trim(),
      ca_reviewed_by:    req.caUser?.name || 'CA',
      ca_reviewed_at:    ts(),
      udin:              udin.trim(),
    })
    .eq('id', req.params.id)
    .in('status', ['pending', 'under_review'])
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Compliance request not found or already processed', timestamp: ts() });
    return;
  }

  res.json({
    request: data,
    message: 'Form 146 certified with UDIN — compliance request approved (IT Act 2025)',
    udinRecorded: udin,
    timestamp: ts(),
  });
});

export default router;
