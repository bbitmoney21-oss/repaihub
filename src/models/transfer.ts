// [GREY] Transfer model — TypeScript interfaces matching Supabase transfers table

export interface TransferRow {
  id: string;
  user_id: string;
  amount_inr: number;
  amount_cad: number;
  exchange_rate: number;
  fee_cad: number;
  net_amount_cad: number;
  total_fees_cad: number;
  flat_fee_cad: number;
  commission_cad: number;
  purpose_code: string;
  source_of_funds: string;
  speed: 'standard' | 'express';
  status: string;
  reference: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  risk_score: number | null;
  ca_required: boolean;
  ca_blocking: boolean;
  fifteen_ca_part: 'A' | 'C' | 'EXEMPT' | null;
  fifteen_cb_number: string | null;
  fifteen_ca_number: string | null;
  ca_remarks: string | null;
  ca_approved_at: string | null;
  ca_approved_by: string | null;
  customer_model: 'p2p' | 'citizen_nro' | 'citizen_nre' | null;
  account_type: 'NRO' | 'NRE' | null;
  provider_reference: string | null;
  adapter_name: string | null;
  is_mock: boolean;
  swift_reference: string | null;
  completed_at: string | null;
  tds_deducted: boolean;
  tds_amount_inr: number;
  nro_bank_name: string | null;
  nro_branch_city: string | null;
  test_mode: boolean;
  created_at: string;
  updated_at: string;
}
