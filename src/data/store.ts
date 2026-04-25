// TODO: Replace all in-memory arrays with Prisma queries when Supabase is connected.
// Connection string goes in .env as DATABASE_URL=postgresql://...
// Each function maps 1:1 to a Prisma model — swap is find+replace.
//   getAllTransfers()         → prisma.transfer.findMany({ orderBy: { createdAt: 'desc' } })
//   getTransferById(id)       → prisma.transfer.findUnique({ where: { id } })
//   getPendingTransfers()     → prisma.transfer.findMany({ where: { status: { in: [...] } } })
//   updateTransferStatus()    → prisma.transfer.update({ where: { id }, data: { status, ...extras } })
//   createTransfer()          → prisma.transfer.create({ data })
//   getCAUserByEmail(email)   → prisma.cAUser.findUnique({ where: { email } })

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Transfer, CAUser, TransferStatus, FifteenCApart, SourceOfFunds } from '../types/compliance';

// TODO: Replace with prisma.transfer.findMany() when DB connected
const transfers: Transfer[] = [];

// TODO: Replace with prisma.cAUser.findMany() when DB connected
const caUsers: CAUser[] = [];

// Seed one CA user on startup — password from .env, fallback for local dev
// TODO: Remove seed and load from DB via prisma.cAUser.findFirst()
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

function determineFifteenCAPart(cumulativeINR: number): FifteenCApart {
  return cumulativeINR <= 500000 ? 'A' : 'C';
}

// Seed 5 realistic demo transfers so the dashboard has data on first launch
// TODO: Remove this function and load real data from Supabase
function seedDemoTransfers() {
  const demos: Array<{
    customerName: string;
    customerEmail: string;
    panLast4: string;
    amountINR: number;
    amountCAD: number;
    exchangeRate: number;
    feeCAD: number;
    sourceOfFunds: SourceOfFunds;
    sourceBreakdown: { type: SourceOfFunds; amountINR: number; tdsDeducted: boolean; tdsRate: number }[];
    purposeCode: 'P1301';
    tdsDeducted: boolean;
    tdsAmountINR: number;
    tdsReference: string;
    adBankName: string;
    nroBankName: string;
    nroBranchCity: string;
    canadianBankName: string;
    financialYearCumulativeINR: number;
    priority: 'standard' | 'express';
    status: TransferStatus;
  }> = [
    {
      customerName: 'Priya Venkataraman',
      customerEmail: 'priya.v@gmail.com',
      panLast4: '190K',
      amountINR: 2000000,
      amountCAD: 32000,
      exchangeRate: 0.0160,
      feeCAD: 45,
      sourceOfFunds: 'rental_income',
      sourceBreakdown: [
        { type: 'rental_income', amountINR: 1800000, tdsDeducted: true, tdsRate: 0.30 },
        { type: 'dividend_income', amountINR: 200000, tdsDeducted: true, tdsRate: 0.10 },
      ],
      purposeCode: 'P1301',
      tdsDeducted: true,
      tdsAmountINR: 560000,
      tdsReference: 'TDS2026-SBI-00412',
      adBankName: 'State Bank of India',
      nroBankName: 'HDFC Bank',
      nroBranchCity: 'Pune',
      canadianBankName: 'Royal Bank of Canada',
      financialYearCumulativeINR: 2000000,
      priority: 'standard',
      status: '15CB_REQUESTED',
    },
    {
      customerName: 'Raj Krishnamurthy',
      customerEmail: 'raj.k@hotmail.com',
      panLast4: '445P',
      amountINR: 3500000,
      amountCAD: 56000,
      exchangeRate: 0.0160,
      feeCAD: 45,
      sourceOfFunds: 'property_sale',
      sourceBreakdown: [
        { type: 'property_sale', amountINR: 3500000, tdsDeducted: true, tdsRate: 0.20 },
      ],
      purposeCode: 'P1301',
      tdsDeducted: true,
      tdsAmountINR: 700000,
      tdsReference: 'TDS2026-ICICI-00891',
      adBankName: 'ICICI Bank',
      nroBankName: 'ICICI Bank',
      nroBranchCity: 'Bangalore',
      canadianBankName: 'TD Canada Trust',
      financialYearCumulativeINR: 3500000,
      priority: 'express',
      status: '15CB_REQUESTED',
    },
    {
      customerName: 'Ananya Sharma',
      customerEmail: 'ananya.s@yahoo.com',
      panLast4: '782A',
      amountINR: 300000,
      amountCAD: 4800,
      exchangeRate: 0.0160,
      feeCAD: 25,
      sourceOfFunds: 'dividend_income',
      sourceBreakdown: [
        { type: 'dividend_income', amountINR: 300000, tdsDeducted: true, tdsRate: 0.10 },
      ],
      purposeCode: 'P1301',
      tdsDeducted: true,
      tdsAmountINR: 30000,
      tdsReference: 'TDS2026-AXIS-00234',
      adBankName: 'Axis Bank',
      nroBankName: 'Axis Bank',
      nroBranchCity: 'Mumbai',
      canadianBankName: 'Scotiabank',
      financialYearCumulativeINR: 300000,
      priority: 'standard',
      status: 'KYC_VERIFIED',
    },
    {
      customerName: 'Suresh Iyer',
      customerEmail: 'suresh.i@gmail.com',
      panLast4: '334M',
      amountINR: 1500000,
      amountCAD: 24000,
      exchangeRate: 0.0160,
      feeCAD: 35,
      sourceOfFunds: 'matured_investment',
      sourceBreakdown: [
        { type: 'matured_investment', amountINR: 1500000, tdsDeducted: true, tdsRate: 0.10 },
      ],
      purposeCode: 'P1301',
      tdsDeducted: true,
      tdsAmountINR: 150000,
      tdsReference: 'TDS2026-PNB-00667',
      adBankName: 'Punjab National Bank',
      nroBankName: 'Punjab National Bank',
      nroBranchCity: 'Delhi',
      canadianBankName: 'BMO Bank of Montreal',
      financialYearCumulativeINR: 1500000,
      priority: 'standard',
      status: '15CB_RECEIVED',
    },
    {
      customerName: 'Deepa Nair',
      customerEmail: 'deepa.n@gmail.com',
      panLast4: '519D',
      amountINR: 800000,
      amountCAD: 12800,
      exchangeRate: 0.0160,
      feeCAD: 30,
      sourceOfFunds: 'rental_income',
      sourceBreakdown: [
        { type: 'rental_income', amountINR: 800000, tdsDeducted: true, tdsRate: 0.30 },
      ],
      purposeCode: 'P1301',
      tdsDeducted: true,
      tdsAmountINR: 240000,
      tdsReference: 'TDS2026-KVB-00112',
      adBankName: 'Karur Vysya Bank',
      nroBankName: 'Karur Vysya Bank',
      nroBranchCity: 'Chennai',
      canadianBankName: 'CIBC',
      financialYearCumulativeINR: 800000,
      priority: 'express',
      status: '15CA_FILED',
    },
  ];

  demos.forEach(d => {
    const part = determineFifteenCAPart(d.financialYearCumulativeINR);
    const hasCB = d.status === '15CB_RECEIVED' || d.status === '15CA_FILED';
    const hasCA = d.status === '15CA_FILED';
    transfers.push({
      ...d,
      id: uuidv4(),
      panHash: crypto.createHash('sha256').update('DEMO_' + d.panLast4).digest('hex'),
      fifteenCAPart: part,
      fifteenCBRequired: part === 'C',
      fifteenCBNumber: hasCB
        ? `CB2026-04-${d.panLast4}-${Math.floor(Math.random() * 9000 + 1000)}`
        : null,
      fifteenCANumber: hasCA
        ? `CA2026-04-${d.panLast4}-${Math.floor(Math.random() * 9000 + 1000)}`
        : null,
      caRemarks: hasCB ? 'Verified on Form 26AS and WISEMAN. TDS confirmed. DTAA relief assessed.' : '',
      caApprovedAt: hasCB ? new Date(Date.now() - Math.random() * 3600000).toISOString() : null,
      caApprovedBy: hasCB ? 'CA Partner' : '',
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}

seedDemoTransfers();

// ── Store functions ───────────────────────────────────────────────────────────
// TODO: Each function below maps 1:1 to a Prisma query — see header comment

export function getAllTransfers(): Transfer[] {
  // TODO: return await prisma.transfer.findMany({ orderBy: { createdAt: 'desc' } })
  return [...transfers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getTransferById(id: string): Transfer | undefined {
  // TODO: return await prisma.transfer.findUnique({ where: { id } })
  return transfers.find(t => t.id === id);
}

export function getPendingTransfers(): Transfer[] {
  // TODO: return await prisma.transfer.findMany({ where: { status: { in: ['15CB_REQUESTED','KYC_VERIFIED'] } } })
  return transfers
    .filter(t => t.status === '15CB_REQUESTED' || t.status === 'KYC_VERIFIED')
    .sort((a, b) => {
      // Express always before standard
      if (a.priority === 'express' && b.priority !== 'express') return -1;
      if (b.priority === 'express' && a.priority !== 'express') return 1;
      // Oldest first within same priority
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

export function updateTransferStatus(
  id: string,
  status: TransferStatus,
  extras: Partial<Transfer> = {},
): Transfer | null {
  // TODO: return await prisma.transfer.update({ where: { id }, data: { status, ...extras, updatedAt: new Date() } })
  const idx = transfers.findIndex(t => t.id === id);
  if (idx === -1) return null;
  transfers[idx] = { ...transfers[idx], ...extras, status, updatedAt: new Date().toISOString() };
  return transfers[idx];
}

export function createTransfer(
  data: Omit<Transfer, 'id' | 'fifteenCAPart' | 'fifteenCBRequired' | 'createdAt' | 'updatedAt'>,
): Transfer {
  // TODO: return await prisma.transfer.create({ data: { ...data, fifteenCAPart: part, fifteenCBRequired: part === 'C' } })
  const part = determineFifteenCAPart(data.financialYearCumulativeINR);
  const transfer: Transfer = {
    ...data,
    id: uuidv4(),
    fifteenCAPart: part,
    fifteenCBRequired: part === 'C',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  transfers.push(transfer);
  return transfer;
}

export function getCAUserByEmail(email: string): CAUser | undefined {
  // TODO: return await prisma.cAUser.findUnique({ where: { email } })
  return caUsers.find(u => u.email === email);
}
