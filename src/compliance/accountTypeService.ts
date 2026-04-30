// [GREEN] AccountTypeService — determines routing based on customer type
// This drives whether 15CA/15CB is required and which compliance path applies

import { supabaseAdmin } from '../lib/supabaseServer.js';

export interface AccountTypeDecision {
  customerModel: 'p2p' | 'citizen_nro' | 'citizen_nre';
  accountType: 'NRO' | 'NRE';
  requires15CACB: boolean;
  fifteenCAPart: 'A' | 'C' | 'EXEMPT'; // EXEMPT for NRE
  description: string;
}

// ── Cumulative FY transfer total ──────────────────────────────────────────────

async function getCumulativeFYTransfers(userId: string): Promise<number> {
  try {
    const now = new Date();
    // Indian FY runs April 1 → March 31
    const fyStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)  // April 1 this year
      : new Date(now.getFullYear() - 1, 3, 1); // April 1 last year

    const { data } = await supabaseAdmin
      .from('transfers')
      .select('amount_inr')
      .eq('user_id', userId)
      .in('status', ['completed', 'bank_processing', '15ca_filed', '15cb_received', 'BANK_PROCESSING', 'COMPLETED'])
      .gte('created_at', fyStart.toISOString());

    return (data ?? []).reduce((sum, row) => sum + Number(row.amount_inr || 0), 0);
  } catch {
    return 0;
  }
}

// ── Main routing function ─────────────────────────────────────────────────────

export async function determineAccountRoute(
  residencyType: string,   // 'work_permit' | 'permanent_resident' | 'visitor' | 'citizen'
  accountType: string,     // 'NRO' | 'NRE'
  amountINR: number,
  userId: string,
): Promise<AccountTypeDecision> {

  // NRE is always fully repatriable — no 15CA/15CB regardless of residency
  if (accountType === 'NRE') {
    return {
      customerModel: 'citizen_nre',
      accountType: 'NRE',
      requires15CACB: false,
      fifteenCAPart: 'EXEMPT',
      description: 'NRE account — fully repatriable, no compliance forms required',
    };
  }

  // All NRO accounts follow the same 15CA/CB process regardless of residency type
  const cumulativeINR = await getCumulativeFYTransfers(userId);
  const part: 'A' | 'C' = (cumulativeINR + amountINR) > 500000 ? 'C' : 'A';

  if (residencyType === 'citizen') {
    return {
      customerModel: 'citizen_nro',
      accountType: 'NRO',
      requires15CACB: part === 'C',
      fifteenCAPart: part,
      description: part === 'C'
        ? 'Citizen NRO — 15CA Part C + 15CB CA certification required'
        : 'Citizen NRO — 15CA Part A auto-approved (below ₹5L cumulative)',
    };
  }

  // Work Permit, Permanent Resident, Visitor — P2P model
  return {
    customerModel: 'p2p',
    accountType: 'NRO',
    requires15CACB: part === 'C',
    fifteenCAPart: part,
    description: part === 'C'
      ? 'P2P — NRO account repatriation, 15CA Part C + 15CB required'
      : 'P2P — NRO account repatriation, 15CA Part A auto-approved (below ₹5L cumulative)',
  };
}
