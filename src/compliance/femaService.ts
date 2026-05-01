// FEMA compliance — annual repatriation limit check for outward transfers.
// FEMA Section 6(4): NRI can repatriate up to USD 1,000,000 per financial year from NRO account.
// At INR 83/USD the ceiling is approximately ₹8,30,00,000.

import { supabaseAdmin } from '../lib/supabaseServer';

// USD 1M at INR 83/USD — update when RBI revises reference rate significantly
const FEMA_MAX_INR = 83_000_000;

export interface FemaCheckResult {
  allowed: boolean;
  remainingINR: number;
  usedINR: number;
  maxINR: number;
  message?: string;
  fyResetDate: string; // ISO date of next FY reset
}

function currentFYStart(): Date {
  const now = new Date();
  return now.getMonth() >= 3           // April = month 3 (0-indexed)
    ? new Date(now.getFullYear(), 3, 1)
    : new Date(now.getFullYear() - 1, 3, 1);
}

function nextFYResetDate(): string {
  const fyStart = currentFYStart();
  return new Date(fyStart.getFullYear() + 1, 3, 1).toISOString().split('T')[0];
}

export async function checkFemaLimit(
  userId: string,
  newTransferINR: number,
): Promise<FemaCheckResult> {
  const fyStart = currentFYStart();

  let usedINR = 0;
  try {
    const { data } = await supabaseAdmin
      .from('transfers')
      .select('amount_inr')
      .eq('user_id', userId)
      .in('status', [
        'completed', 'bank_processing',
        'form145_filed', 'form146_received',
        '15ca_filed', '15cb_received',           // legacy pre-016
        'COMPLETED', 'BANK_PROCESSING',
      ])
      .gte('created_at', fyStart.toISOString());

    usedINR = (data ?? []).reduce((sum, row) => sum + Number(row.amount_inr || 0), 0);
  } catch {
    // If DB is unavailable, allow the transfer (fail open, not closed)
    return { allowed: true, remainingINR: FEMA_MAX_INR, usedINR: 0, maxINR: FEMA_MAX_INR, fyResetDate: nextFYResetDate() };
  }

  const remainingINR = Math.max(0, FEMA_MAX_INR - usedINR);

  if (usedINR + newTransferINR > FEMA_MAX_INR) {
    return {
      allowed: false,
      remainingINR,
      usedINR,
      maxINR: FEMA_MAX_INR,
      fyResetDate: nextFYResetDate(),
      message:
        `FEMA annual repatriation limit: ₹${FEMA_MAX_INR.toLocaleString('en-IN')} (USD 1,000,000). ` +
        `Used this FY: ₹${usedINR.toLocaleString('en-IN')}. ` +
        `Remaining: ₹${remainingINR.toLocaleString('en-IN')}. ` +
        `This transfer of ₹${newTransferINR.toLocaleString('en-IN')} exceeds the remaining limit.`,
    };
  }

  return {
    allowed: true,
    remainingINR,
    usedINR,
    maxINR: FEMA_MAX_INR,
    fyResetDate: nextFYResetDate(),
  };
}

export { FEMA_MAX_INR };
