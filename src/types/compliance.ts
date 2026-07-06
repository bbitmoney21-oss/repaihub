// NOTE: Under India Income Tax Act 2025 (effective 1 Apr 2026):
// Form 15CA is now Form 145 | Form 15CB is now Form 146
// Section 195 is now Section 397(3)(d)
// Thresholds unchanged: Part A below Rs 5L, Part C above Rs 5L

export type TransferStatus =
  | 'INITIATED'
  | 'KYC_VERIFIED'
  | 'FORM146_REQUESTED'   // was '15CB_REQUESTED' under IT Act 1961
  | 'FORM146_RECEIVED'    // was '15CB_RECEIVED'
  | 'FORM145_FILED'       // was '15CA_FILED'
  | 'BANK_PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING_REVIEW'
  | 'CANCELLED'
  | 'GATEWAY_RETRY'
  // Legacy 3-tier decision statuses (backward compat)
  | 'pending_ca_approval'
  | 'processing_with_compliance'
  | 'processing'
  | 'failed';

// Form 145 Part (formerly 15CA Part) — unchanged concept, new form number
export type Form145Part = 'A' | 'B' | 'C' | 'D' | 'EXEMPT';
// Backward-compat alias — remove after full migration
export type FifteenCApart = Form145Part;

export type SourceOfFunds =
  | 'rental_income'
  | 'dividend_income'
  | 'property_sale'
  | 'pension'
  | 'salary_arrears'
  | 'matured_investment'
  | 'gift_from_relative'
  | 'other';

export type RBIPurposeCode =
  | 'S0014'  // Repatriation of non-resident deposits (correct RBI code for NRO outward — REQ-03)
  | 'P1302'  // Repatriation of NRE funds
  | 'P0001'  // Indian investment abroad
  | 'S0001'  // Software services
  | 'P1101'; // Family maintenance
// NOTE: P1301 was a legacy wrong code. All NRO outward transfers must use S0014.

export interface SourceBreakdownItem {
  type: SourceOfFunds;
  amountINR: number;
  tdsDeducted: boolean;
  tdsRate: number; // e.g. 0.30 for 30%
}

export interface Transfer {
  id: string;
  customerName: string;
  customerEmail: string;
  panHash: string;          // SHA-256 hash — never plain PAN
  panLast4: string;         // Last 4 chars of PAN for display
  amountINR: number;
  amountCAD: number;
  exchangeRate: number;
  feeCAD: number;
  sourceOfFunds: SourceOfFunds;
  sourceBreakdown: SourceBreakdownItem[];
  purposeCode: RBIPurposeCode;
  tdsDeducted: boolean;
  tdsAmountINR: number;
  tdsReference: string;
  adBankName: string;
  nroBankName: string;
  nroBranchCity: string;
  canadianBankName: string;
  financialYearCumulativeINR: number;
  // IT Act 2025 form fields (formerly 15CA/15CB)
  form145Part: Form145Part;        // Auto-determined: A if cumulative <= 500000, else C
  form146Required: boolean;        // true when form145Part is C
  form146Number: string | null;    // Populated after CA certifies Form 146
  form145Number: string | null;    // Populated after IT portal filing of Form 145
  caRemarks: string;
  caApprovedAt: string | null;
  caApprovedBy: string;
  status: TransferStatus;
  priority: 'standard' | 'express';
  createdAt: string;
  updatedAt: string;
  // Risk engine fields
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  risk_score?: number | null;
  risk_breakdown?: Record<string, number> | null;
  // Cancellation
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  // Rate fields
  indicativeRate?: number | null;       // Rate at initiation
  finalExecutionRate?: number | null;   // Rate at actual execution (set by CA approval)
  // Certificate fields
  swiftReference?: string | null;
  completedAt?: string | null;
}

export interface CAUser {
  id: string;
  name: string;
  email: string;
  icaiMembership: string;
  passwordHash: string;
  role: 'ca_partner';
}
