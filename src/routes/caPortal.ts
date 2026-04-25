import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  getAllTransfers,
  getTransferById,
  getPendingTransfers,
  updateTransferStatus,
  getCAUserByEmail,
} from '../data/store';
import { caAuthMiddleware, CARequest } from '../middleware/caAuth';
import { RBIPurposeCode, SourceOfFunds } from '../types/compliance';

const router = Router();

const ts = () => new Date().toISOString();

// ── Human-readable labels ─────────────────────────────────────────────────────

const SOURCE_LABELS: Record<SourceOfFunds, string> = {
  rental_income: 'Rental Income',
  dividend_income: 'Dividend Income',
  property_sale: 'Property Sale Proceeds',
  pension: 'Pension',
  salary_arrears: 'Salary Arrears',
  matured_investment: 'Matured Investment',
  gift_from_relative: 'Gift from Relative',
  other: 'Other',
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
router.get('/transfers', caAuthMiddleware, (req: CARequest, res: Response) => {
  const { status } = req.query as { status?: string };
  let transfers = getAllTransfers();
  if (status) {
    transfers = transfers.filter(t => t.status === status);
  }
  res.json({ transfers, count: transfers.length, timestamp: ts() });
});

// ── GET /ca/transfers/pending ─────────────────────────────────────────────────
// Must be declared before /transfers/:id to avoid "pending" being treated as an id
router.get('/transfers/pending', caAuthMiddleware, (_req: CARequest, res: Response) => {
  const pending = getPendingTransfers();
  res.json({ transfers: pending, count: pending.length, timestamp: ts() });
});

// ── GET /ca/transfers/:id ─────────────────────────────────────────────────────
router.get('/transfers/:id', caAuthMiddleware, (req: CARequest, res: Response) => {
  const transfer = getTransferById(req.params.id);
  if (!transfer) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }
  res.json({ transfer, timestamp: ts() });
});

// ── GET /ca/transfers/:id/form ────────────────────────────────────────────────
router.get('/transfers/:id/form', caAuthMiddleware, (req: CARequest, res: Response) => {
  const transfer = getTransferById(req.params.id);
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
      panDisplay: `PAN ending ****${transfer.panLast4}`,
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
      purposeDescription: PURPOSE_DESCRIPTIONS[transfer.purposeCode],
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
      assessee_pan: `PAN ending ****${transfer.panLast4}`,
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
router.post('/transfers/:id/approve', caAuthMiddleware, (req: CARequest, res: Response) => {
  const { cbNumber, remarks } = req.body as { cbNumber?: string; remarks?: string };
  if (!cbNumber || !remarks || remarks.length < 20) {
    res.status(400).json({
      error: 'cbNumber and remarks (minimum 20 characters) are required',
      timestamp: ts(),
    });
    return;
  }
  const updated = updateTransferStatus(req.params.id, '15CB_RECEIVED', {
    fifteenCBNumber: cbNumber,
    caRemarks: remarks,
    caApprovedAt: ts(),
    caApprovedBy: req.caUser?.name || 'CA',
  });
  if (!updated) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }
  res.json({ transfer: updated, message: '15CB certified successfully', timestamp: ts() });
});

// ── POST /ca/transfers/:id/reject ─────────────────────────────────────────────
router.post('/transfers/:id/reject', caAuthMiddleware, (req: CARequest, res: Response) => {
  const { reason } = req.body as { reason?: string };
  if (!reason || reason.trim().length === 0) {
    res.status(400).json({ error: 'reason is required', timestamp: ts() });
    return;
  }
  const updated = updateTransferStatus(req.params.id, 'FAILED', {
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
router.post('/transfers/:id/15ca-filed', caAuthMiddleware, (req: CARequest, res: Response) => {
  const { caNumber } = req.body as { caNumber?: string };
  if (!caNumber || caNumber.trim().length === 0) {
    res.status(400).json({ error: 'caNumber is required', timestamp: ts() });
    return;
  }
  const updated = updateTransferStatus(req.params.id, '15CA_FILED', {
    fifteenCANumber: caNumber,
  });
  if (!updated) {
    res.status(404).json({ error: 'Transfer not found', timestamp: ts() });
    return;
  }
  res.json({ transfer: updated, message: '15CA marked as filed', timestamp: ts() });
});

// ── GET /ca/stats ─────────────────────────────────────────────────────────────
router.get('/stats', caAuthMiddleware, (_req: CARequest, res: Response) => {
  const all = getAllTransfers();
  const pending = getPendingTransfers();
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
