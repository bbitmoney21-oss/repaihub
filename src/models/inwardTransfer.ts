// [GREY] InwardTransfer model — TypeScript interfaces matching inward_transfers table

export interface InwardTransferRow {
  id: string;
  user_id: string;
  reference: string;
  amount_cad: number;
  exchange_rate: number;
  gross_amount_inr: number;
  net_amount_inr: number;
  total_fees_cad: number;
  flat_fee_cad: number;
  commission_cad: number;
  speed: 'standard' | 'express';
  status: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  risk_reason: string | null;
  ca_required: boolean;
  ca_blocking: boolean;
  fintrac_required: boolean;
  recipient_name: string;
  recipient_bank_name: string;
  recipient_account_last4: string | null;
  recipient_ifsc: string;
  recipient_upi: string | null;
  collection_method: string | null;
  collection_reference: string | null;
  payout_reference: string | null;
  adapter_name: string | null;
  is_mock: boolean;
  utr: string | null;
  rail_used: string | null;
  customer_bank_name: string | null;
  customer_bank_token: string | null;
  payment_received_at: string | null;
  completed_at: string | null;
  created_at: string;
}
