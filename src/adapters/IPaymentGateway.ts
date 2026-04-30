// [GREEN] IPaymentGateway — the contract Fable must fulfill
// Adding Wise or any future gateway = one new file implementing this
// Switching providers = change one Supabase row, zero code changes

export interface RateResult {
  rate: number;            // e.g. 0.0160 for INR→CAD
  rateId: string;
  validForSeconds: number; // 1800 for outward, 900 for inward
  source: 'live' | 'mock';
  provider: string;        // 'fable' or 'mock_fable'
}

export interface LockedRate {
  lockedRate: number;
  lockId: string;
  lockedAt: string;
  lockedUntil: string;
  provider: string;
}

export interface OutwardInstruction {
  transferId: string;
  customerType: 'p2p' | 'citizen_nro' | 'citizen_nre'; // [GREEN] routing hint
  accountType: 'NRO' | 'NRE';
  amountINR: number;
  nroBankName: string;         // customer's Indian bank (e.g. HDFC)
  nroBranchCity: string;
  fifteenCANumber: string;     // required for NRO, not for NRE
  fifteenCBNumber: string;     // required when Part C, not for NRE
  purposeCode: string;         // P1301
  exchangeRate: number;
  beneficiaryCAD: {
    bankName: string;
    transitNumber: string;
    institutionNumber: string;
    accountNumber: string;     // fetched fresh from Flinks — never stored
    accountOwnerName: string;
  };
}
// Fable uses its AD bank (Kotak/partner) to debit the customer's Indian
// bank (nroBankName). REPAIHUB does not need to know which AD bank Fable uses.

export interface InwardCollectionInstruction {
  // [ORANGE] Fable collects CAD from customer's Canadian bank
  transferId: string;
  amountCAD: number;           // gross amount before fees
  netAmountCAD: number;        // after REPAIHUB fees — this is what Fable converts
  customerFlinksToken: string; // Fable uses this to identify Canadian bank
  customerBankName: string;    // e.g. RBC, TD, Scotiabank
  collectionMethod: 'interac' | 'eft' | 'wire'; // [ORANGE] Fable decides
  speed: 'standard' | 'express';
}

export interface InwardPayoutInstruction {
  // [PURPLE] Nium via Fable delivers INR to recipient's Indian bank
  transferId: string;
  amountINR: number;
  recipientName: string;
  recipientBankName: string;
  recipientAccountNo: string;  // decrypted at payout time only
  recipientIFSC: string;
  preferredRail: 'IMPS' | 'NEFT' | 'UPI' | 'RTGS';
  // Fable → Nium selects rail. REPAIHUB provides preference only.
}

export interface TransferResult {
  providerReference: string;
  status: 'accepted' | 'processing' | 'completed' | 'failed';
  estimatedCompletionAt: string;
  providerName: string;  // 'fable' or 'mock_fable'
  isMock: boolean;
}

export interface IPaymentGateway {
  // Rate operations — [ORANGE] Fable rate provider
  getRate(fromCurrency: string, toCurrency: string): Promise<RateResult>;
  lockRate(rateId: string, amount: number): Promise<LockedRate>;

  // Outward: NRO/NRE India → CAD Canada
  // [ORANGE] Fable AD bank (Kotak/partner) debits customer's Indian bank
  executeOutward(instruction: OutwardInstruction): Promise<TransferResult>;

  // Inward step 1: [ORANGE] Fable collects CAD (Interac/EFT/wire)
  collectCAD(instruction: InwardCollectionInstruction): Promise<TransferResult>;

  // Inward step 2: [ORANGE+PURPLE] Fable → Nium delivers INR to India
  payoutINR(instruction: InwardPayoutInstruction): Promise<TransferResult>;

  // Status polling
  getTransferStatus(providerReference: string): Promise<{
    status: string; updatedAt: string; details: object;
  }>;

  getProviderName(): string;
  isMock(): boolean;
}
