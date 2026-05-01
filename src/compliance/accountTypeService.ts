// NOTE: Under India Income Tax Act 2025 (effective 1 Apr 2026):
// Form 15CA is now Form 145 | Form 15CB is now Form 146
// Section 195 is now Section 397(3)(d)
// This drives whether Form 145/146 is required and which compliance path applies

import { supabaseAdmin } from '../lib/supabaseServer.js';

export interface AccountTypeDecision {
  customerModel: 'p2p' | 'citizen_nro' | 'citizen_nre';
  accountType: 'NRO' | 'NRE';
  requiresForm145146: boolean;   // formerly requires15CACB
  form145Part: 'A' | 'C' | 'EXEMPT'; // EXEMPT for NRE; formerly fifteenCAPart
  description: string;
}

// ── Cumulative FY transfer total ──────────────────────────────────────────────

async function getCumulativeFYTransfers(userId: string): Promise<number> {
  try {
    const now = new Date();
    // Indian FY runs April 1 → March 31
    const fyStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);

    const { data } = await supabaseAdmin
      .from('transfers')
      .select('amount_inr')
      .eq('user_id', userId)
      .in('status', [
        'completed', 'bank_processing',
        'form145_filed', 'form146_received',       // new status names
        '15ca_filed', '15cb_received',             // legacy status names (pre-016)
        'BANK_PROCESSING', 'COMPLETED',
      ])
      .gte('created_at', fyStart.toISOString());

    return (data ?? []).reduce((sum, row) => sum + Number(row.amount_inr || 0), 0);
  } catch {
    return 0;
  }
}

export { getCumulativeFYTransfers };

// ── Main routing function ─────────────────────────────────────────────────────

export async function determineAccountRoute(
  residencyType: string,   // 'work_permit' | 'permanent_resident' | 'visitor' | 'citizen'
  accountType: string,     // 'NRO' | 'NRE'
  amountINR: number,
  userId: string,
): Promise<AccountTypeDecision> {

  // NRE is always fully repatriable — no Form 145/146 regardless of residency
  if (accountType === 'NRE') {
    return {
      customerModel: 'citizen_nre',
      accountType: 'NRE',
      requiresForm145146: false,
      form145Part: 'EXEMPT',
      description: 'NRE account — fully repatriable, no Form 145/146 required (IT Act 2025)',
    };
  }

  // All NRO accounts follow the same Form 145/146 process regardless of residency type
  const cumulativeINR = await getCumulativeFYTransfers(userId);
  const part: 'A' | 'C' = (cumulativeINR + amountINR) > 500000 ? 'C' : 'A';

  if (residencyType === 'citizen') {
    return {
      customerModel: 'citizen_nro',
      accountType: 'NRO',
      requiresForm145146: part === 'C',
      form145Part: part,
      description: part === 'C'
        ? 'Citizen NRO — Form 145 Part C + Form 146 CA certification required (IT Act 2025)'
        : 'Citizen NRO — Form 145 Part A auto-approved (below ₹5L cumulative)',
    };
  }

  // Work Permit, Permanent Resident, Visitor — P2P model
  return {
    customerModel: 'p2p',
    accountType: 'NRO',
    requiresForm145146: part === 'C',
    form145Part: part,
    description: part === 'C'
      ? 'P2P — NRO repatriation, Form 145 Part C + Form 146 required (IT Act 2025)'
      : 'P2P — NRO repatriation, Form 145 Part A auto-approved (below ₹5L cumulative)',
  };
}
