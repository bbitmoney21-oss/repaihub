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
  unavailable?: boolean; // true when the check could not run — the transfer is held (fail closed)
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

  // D1 fix (Q-002, approved 2026-11-20): FAIL CLOSED. If the limit cannot be
  // verified, the transfer is held — never allowed on a default of ₹0 used.
  // Every transfer this FY counts unless it was cancelled, failed or rejected,
  // so in-flight transfers are included (conservative).
  const unavailable = (): FemaCheckResult => ({
    allowed: false, unavailable: true, remainingINR: 0, usedINR: 0, maxINR: FEMA_MAX_INR,
    fyResetDate: nextFYResetDate(),
    message: 'We could not verify your annual FEMA limit right now, so this transfer has not been sent. Please try again in a few minutes.',
  });
  let usedINR = 0;
  try {
    const { data, error } = await supabaseAdmin
      .from('transfers')
      .select('amount_inr, status')
      .eq('user_id', userId)
      .gte('created_at', fyStart.toISOString());
    if (error || !data) return unavailable();
    usedINR = data
      .filter(row => !/^(cancelled|failed|rejected|CANCELLED|FAILED|REJECTED)$/.test(String(row.status ?? '')))
      .reduce((sum, row) => sum + Number(row.amount_inr || 0), 0);
  } catch {
    return unavailable();
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
