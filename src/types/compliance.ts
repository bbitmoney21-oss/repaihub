export type TransferStatus =
  | 'INITIATED'
  | 'KYC_VERIFIED'
  | '15CB_REQUESTED'
  | '15CB_RECEIVED'
  | '15CA_FILED'
  | 'BANK_PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type FifteenCApart = 'A' | 'B' | 'C' | 'D';

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
  | 'P1301'  // Repatriation of NRO funds
  | 'P1302'  // Repatriation of NRE funds
  | 'P0001'  // Indian investment abroad
  | 'S0001'  // Software services
  | 'P1101'; // Family maintenance

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
  panLast4: string;         // Last 4 chars of PAN for display — e.g. "190K"
  amountINR: number;
  amountCAD: number;
  exchangeRate: number;
  feeCAD: number;
  sourceOfFunds: SourceOfFunds;
  sourceBreakdown: SourceBreakdownItem[];
  purposeCode: RBIPurposeCode;
  tdsDeducted: boolean;
  tdsAmountINR: number;
  tdsReference: string;     // TDS certificate number if available
  adBankName: string;       // Authorised Dealer bank name
  nroBankName: string;      // Customer's NRO account bank
  nroBranchCity: string;
  canadianBankName: string;
  financialYearCumulativeINR: number; // Customer's total transfers this FY
  fifteenCAPart: FifteenCApart;       // Auto-determined: A if cumulative <= 500000, else C
  fifteenCBRequired: boolean;         // true when fifteenCAPart is C
  fifteenCBNumber: string | null;     // Populated after CA certifies
  fifteenCANumber: string | null;     // Populated after IT portal filing
  caRemarks: string;
  caApprovedAt: string | null;
  caApprovedBy: string;
  status: TransferStatus;
  priority: 'standard' | 'express';
  createdAt: string;
  updatedAt: string;
}

export interface CAUser {
  id: string;
  name: string;
  email: string;
  icaiMembership: string; // ICAI membership number
  passwordHash: string;
  role: 'ca_partner';
}
