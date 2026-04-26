import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Transfer, CAUser, TransferStatus, FifteenCApart, SourceOfFunds, RBIPurposeCode } from '../types/compliance';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';

// ── Status mapping ────────────────────────────────────────────────────────────

const DB_TO_CA: Record<string, TransferStatus> = {
  initiated:        'INITIATED',
  kyc_verified:     'KYC_VERIFIED',
  '15cb_requested': '15CB_REQUESTED',
  '15cb_received':  '15CB_RECEIVED',
  '15ca_filed':     '15CA_FILED',
  bank_processing:  'BANK_PROCESSING',
  completed:        'COMPLETED',
  failed:           'FAILED',
};

const CA_TO_DB: Record<TransferStatus, string> = {
  INITIATED:        'initiated',
  KYC_VERIFIED:     'kyc_verified',
  '15CB_REQUESTED': '15cb_requested',
  '15CB_RECEIVED':  '15cb_received',
  '15CA_FILED':     '15ca_filed',
  BANK_PROCESSING:  'bank_processing',
  COMPLETED:        'completed',
  FAILED:           'failed',
};

function mapStatus(dbStatus: string): TransferStatus {
  return DB_TO_CA[dbStatus?.toLowerCase()] ?? 'INITIATED';
}

// ── Supabase row → Transfer ───────────────────────────────────────────────────

interface ProfileRow { id: string; full_name: string | null; email: string | null }
interface IndiaRow   { user_id: string; bank_name: string | null; branch: string | null }
interface CanadaRow  { user_id: string; institution: string | null }

function mapRow(
  row: Record<string, any>,
  profile?: ProfileRow,
  india?: IndiaRow,
  canada?: CanadaRow,
): Transfer {
  const amountINR = Number(row.amount_inr);
  const part: FifteenCApart = amountINR <= 500000 ? 'A' : 'C';
  const hasCB = ['15CB_RECEIVED', '15CA_FILED', 'BANK_PROCESSING', 'COMPLETED'].includes(
    mapStatus(row.status),
  );

  return {
    id: row.id,
    customerName: profile?.full_name || 'Unknown',
    customerEmail: profile?.email || '',
    panHash: crypto.createHash('sha256').update(row.user_id).digest('hex'),
    panLast4: 'N/A',
    amountINR,
    amountCAD: Number(row.amount_cad),
    exchangeRate: Number(row.exchange_rate),
    feeCAD: Number(row.fee_cad),
    sourceOfFunds: (row.source_of_funds as SourceOfFunds) || 'other',
    sourceBreakdown: [{
      type: (row.source_of_funds as SourceOfFunds) || 'other',
      amountINR,
      tdsDeducted: row.tds_deducted ?? false,
      tdsRate: 0.30,
    }],
    purposeCode: (row.purpose_code as RBIPurposeCode) || 'P1301',
    tdsDeducted: row.tds_deducted ?? false,
    tdsAmountINR: Number(row.tds_amount_inr) || 0,
    tdsReference: row.tds_reference || '',
    adBankName: india?.bank_name || 'N/A',
    nroBankName: india?.bank_name || 'N/A',
    nroBranchCity: india?.branch || 'N/A',
    canadianBankName: canada?.institution || 'N/A',
    financialYearCumulativeINR: amountINR,
    fifteenCAPart: part,
    fifteenCBRequired: part === 'C',
    fifteenCBNumber: row.fifteen_cb_number || null,
    fifteenCANumber: row.fifteen_ca_number || null,
    caRemarks: row.ca_remarks || '',
    caApprovedAt: row.ca_approved_at || null,
    caApprovedBy: row.ca_approved_by || '',
    status: mapStatus(row.status),
    priority: (row.priority as 'standard' | 'express') || (row.speed as 'standard' | 'express') || 'standard',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

async function fetchAllFromSupabase(): Promise<Transfer[]> {
  const { data: rows, error } = await supabaseAdmin
    .from('transfers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const userIds = [...new Set(rows.map(r => r.user_id as string))];

  const [profilesRes, indiaRes, canadaRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, email').in('id', userIds),
    supabaseAdmin.from('india_nro_accounts').select('user_id, bank_name, branch').in('user_id', userIds),
    supabaseAdmin.from('canada_bank_accounts').select('user_id, institution').in('user_id', userIds),
  ]);

  const profileMap = new Map<string, ProfileRow>(
    (profilesRes.data ?? []).map(p => [p.id, p]),
  );
  const indiaMap = new Map<string, IndiaRow>(
    (indiaRes.data ?? []).map(a => [a.user_id, a]),
  );
  const canadaMap = new Map<string, CanadaRow>(
    (canadaRes.data ?? []).map(a => [a.user_id, a]),
  );

  return rows.map(row =>
    mapRow(row, profileMap.get(row.user_id), indiaMap.get(row.user_id), canadaMap.get(row.user_id)),
  );
}

// ── In-memory demo store (fallback when Supabase is not configured) ───────────

const _demo: Transfer[] = [];
const caUsers: CAUser[] = [];

function determineFifteenCAPart(cumulativeINR: number): FifteenCApart {
  return cumulativeINR <= 500000 ? 'A' : 'C';
}

(async () => {
  const hash = await bcrypt.hash(
    process.env.CA_DEFAULT_PASSWORD || 'repaihub_ca_2026',
    12,
  );
  caUsers.push({
    id: uuidv4(),
    name: 'CA Partner',
    email: process.env.CA_EMAIL || 'ca@repaihub.com',
    icaiMembership: process.env.CA_ICAI || '123456',
    passwordHash: hash,
    role: 'ca_partner',
  });
})();

function seedDemoIfEmpty() {
  if (_demo.length > 0) return;

  type DemoSeed = {
    customerName: string; customerEmail: string; panLast4: string;
    amountINR: number; amountCAD: number; exchangeRate: number; feeCAD: number;
    sourceOfFunds: SourceOfFunds;
    sourceBreakdown: { type: SourceOfFunds; amountINR: number; tdsDeducted: boolean; tdsRate: number }[];
    purposeCode: 'P1301'; tdsDeducted: boolean; tdsAmountINR: number; tdsReference: string;
    adBankName: string; nroBankName: string; nroBranchCity: string; canadianBankName: string;
    financialYearCumulativeINR: number; priority: 'standard' | 'express'; status: TransferStatus;
  };

  const demos: DemoSeed[] = [
    { customerName: 'Priya Venkataraman', customerEmail: 'priya.v@gmail.com', panLast4: '190K', amountINR: 2000000, amountCAD: 32000, exchangeRate: 0.0160, feeCAD: 45, sourceOfFunds: 'rental_income', sourceBreakdown: [{ type: 'rental_income', amountINR: 1800000, tdsDeducted: true, tdsRate: 0.30 }, { type: 'dividend_income', amountINR: 200000, tdsDeducted: true, tdsRate: 0.10 }], purposeCode: 'P1301', tdsDeducted: true, tdsAmountINR: 560000, tdsReference: 'TDS2026-SBI-00412', adBankName: 'State Bank of India', nroBankName: 'HDFC Bank', nroBranchCity: 'Pune', canadianBankName: 'Royal Bank of Canada', financialYearCumulativeINR: 2000000, priority: 'standard', status: '15CB_REQUESTED' },
    { customerName: 'Raj Krishnamurthy', customerEmail: 'raj.k@hotmail.com', panLast4: '445P', amountINR: 3500000, amountCAD: 56000, exchangeRate: 0.0160, feeCAD: 45, sourceOfFunds: 'property_sale', sourceBreakdown: [{ type: 'property_sale', amountINR: 3500000, tdsDeducted: true, tdsRate: 0.20 }], purposeCode: 'P1301', tdsDeducted: true, tdsAmountINR: 700000, tdsReference: 'TDS2026-ICICI-00891', adBankName: 'ICICI Bank', nroBankName: 'ICICI Bank', nroBranchCity: 'Bangalore', canadianBankName: 'TD Canada Trust', financialYearCumulativeINR: 3500000, priority: 'express', status: '15CB_REQUESTED' },
    { customerName: 'Ananya Sharma', customerEmail: 'ananya.s@yahoo.com', panLast4: '782A', amountINR: 300000, amountCAD: 4800, exchangeRate: 0.0160, feeCAD: 25, sourceOfFunds: 'dividend_income', sourceBreakdown: [{ type: 'dividend_income', amountINR: 300000, tdsDeducted: true, tdsRate: 0.10 }], purposeCode: 'P1301', tdsDeducted: true, tdsAmountINR: 30000, tdsReference: 'TDS2026-AXIS-00234', adBankName: 'Axis Bank', nroBankName: 'Axis Bank', nroBranchCity: 'Mumbai', canadianBankName: 'Scotiabank', financialYearCumulativeINR: 300000, priority: 'standard', status: 'KYC_VERIFIED' },
    { customerName: 'Suresh Iyer', customerEmail: 'suresh.i@gmail.com', panLast4: '334M', amountINR: 1500000, amountCAD: 24000, exchangeRate: 0.0160, feeCAD: 35, sourceOfFunds: 'matured_investment', sourceBreakdown: [{ type: 'matured_investment', amountINR: 1500000, tdsDeducted: true, tdsRate: 0.10 }], purposeCode: 'P1301', tdsDeducted: true, tdsAmountINR: 150000, tdsReference: 'TDS2026-PNB-00667', adBankName: 'Punjab National Bank', nroBankName: 'Punjab National Bank', nroBranchCity: 'Delhi', canadianBankName: 'BMO Bank of Montreal', financialYearCumulativeINR: 1500000, priority: 'standard', status: '15CB_RECEIVED' },
    { customerName: 'Deepa Nair', customerEmail: 'deepa.n@gmail.com', panLast4: '519D', amountINR: 800000, amountCAD: 12800, exchangeRate: 0.0160, feeCAD: 30, sourceOfFunds: 'rental_income', sourceBreakdown: [{ type: 'rental_income', amountINR: 800000, tdsDeducted: true, tdsRate: 0.30 }], purposeCode: 'P1301', tdsDeducted: true, tdsAmountINR: 240000, tdsReference: 'TDS2026-KVB-00112', adBankName: 'Karur Vysya Bank', nroBankName: 'Karur Vysya Bank', nroBranchCity: 'Chennai', canadianBankName: 'CIBC', financialYearCumulativeINR: 800000, priority: 'express', status: '15CA_FILED' },
  ];

  demos.forEach(d => {
    const part = determineFifteenCAPart(d.financialYearCumulativeINR);
    const hasCB = d.status === '15CB_RECEIVED' || d.status === '15CA_FILED';
    const hasCA = d.status === '15CA_FILED';
    _demo.push({
      ...d,
      id: uuidv4(),
      panHash: crypto.createHash('sha256').update('DEMO_' + d.panLast4).digest('hex'),
      fifteenCAPart: part,
      fifteenCBRequired: part === 'C',
      fifteenCBNumber: hasCB ? `CB2026-04-${d.panLast4}-${Math.floor(Math.random() * 9000 + 1000)}` : null,
      fifteenCANumber: hasCA ? `CA2026-04-${d.panLast4}-${Math.floor(Math.random() * 9000 + 1000)}` : null,
      caRemarks: hasCB ? 'Verified on Form 26AS and WISEMAN. TDS confirmed. DTAA relief assessed.' : '',
      caApprovedAt: hasCB ? new Date(Date.now() - Math.random() * 3600000).toISOString() : null,
      caApprovedBy: hasCB ? 'CA Partner' : '',
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}

// ── Public store API (all async) ──────────────────────────────────────────────

export async function getAllTransfers(): Promise<Transfer[]> {
  if (supabaseAdminConfigured) {
    return fetchAllFromSupabase();
  }
  seedDemoIfEmpty();
  return [..._demo].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getTransferById(id: string): Promise<Transfer | undefined> {
  if (supabaseAdminConfigured) {
    const all = await fetchAllFromSupabase();
    return all.find(t => t.id === id);
  }
  seedDemoIfEmpty();
  return _demo.find(t => t.id === id);
}

export async function getPendingTransfers(): Promise<Transfer[]> {
  const all = await getAllTransfers();
  return all
    .filter(t => t.status === '15CB_REQUESTED' || t.status === 'KYC_VERIFIED' || t.status === 'INITIATED')
    .sort((a, b) => {
      if (a.priority === 'express' && b.priority !== 'express') return -1;
      if (b.priority === 'express' && a.priority !== 'express') return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

export async function updateTransferStatus(
  id: string,
  status: TransferStatus,
  extras: Partial<Transfer> = {},
): Promise<Transfer | null> {
  if (supabaseAdminConfigured) {
    const updateData: Record<string, unknown> = {
      status: CA_TO_DB[status],
    };
    if (extras.fifteenCBNumber !== undefined) updateData.fifteen_cb_number = extras.fifteenCBNumber;
    if (extras.fifteenCANumber !== undefined) updateData.fifteen_ca_number = extras.fifteenCANumber;
    if (extras.caRemarks       !== undefined) updateData.ca_remarks         = extras.caRemarks;
    if (extras.caApprovedAt    !== undefined) updateData.ca_approved_at      = extras.caApprovedAt;
    if (extras.caApprovedBy    !== undefined) updateData.ca_approved_by      = extras.caApprovedBy;

    const { error } = await supabaseAdmin
      .from('transfers')
      .update(updateData)
      .eq('id', id);

    if (error) return null;
    return getTransferById(id) ?? null;
  }

  seedDemoIfEmpty();
  const idx = _demo.findIndex(t => t.id === id);
  if (idx === -1) return null;
  _demo[idx] = { ..._demo[idx], ...extras, status, updatedAt: new Date().toISOString() };
  return _demo[idx];
}

export async function createTransfer(
  data: Omit<Transfer, 'id' | 'fifteenCAPart' | 'fifteenCBRequired' | 'createdAt' | 'updatedAt'>,
): Promise<Transfer> {
  const part = determineFifteenCAPart(data.financialYearCumulativeINR);
  const transfer: Transfer = {
    ...data,
    id: uuidv4(),
    fifteenCAPart: part,
    fifteenCBRequired: part === 'C',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!supabaseAdminConfigured) {
    seedDemoIfEmpty();
    _demo.push(transfer);
  }
  // When Supabase is configured, transfers are created by the React frontend
  // directly via the Supabase client — the CA portal doesn't create them.

  return transfer;
}

export function getCAUserByEmail(email: string): CAUser | undefined {
  return caUsers.find(u => u.email === email);
}
