import type { TransferStatus } from '../store/useStore'

// ─────────────────────────────────────────────────────────────────────────────
// Per-status detail used by the Dashboard's Active Transfers panel.
// Keeps the UI from leaking enum names ('15CA_FILED') to the customer and
// gives the same status a different meaning depending on direction (outward
// repatriation vs inward Canada→India).
//
// The schema is purposefully tiny:
//   step:           1-5, where 5 means "ready to deliver / delivered"
//   totalSteps:     5 for outward (full RBI flow), 3 for inward (FINTRAC only)
//   label:          short, customer-facing description of what's happening
//   etaHint:        rough wait time (no false precision)
//   actionRequired: set ONLY when the transfer is blocked on user input.
//                   When non-null, the dashboard renders a Pending Action
//                   banner above the active list and a 'Action needed' chip
//                   on the card itself.
// ─────────────────────────────────────────────────────────────────────────────

export type ActionKind = 'pan' | 'document' | 'kyc'

export interface StatusDetail {
  step: number       // 1-based, <= totalSteps
  totalSteps: number // outward = 5, inward = 3 (no Form 15CA/15CB stages)
  label: string
  etaHint?: string
  actionRequired?: { kind: ActionKind; message: string; href?: string }
}

const OUTWARD: Partial<Record<TransferStatus, StatusDetail>> = {
  INITIATED:        { step: 1, totalSteps: 5, label: 'Verifying KYC',                       etaHint: 'A few minutes' },
  KYC_VERIFIED:     { step: 2, totalSteps: 5, label: 'Filing Form 15CA',                    etaHint: '~30 minutes' },
  '15CA_FILED':     { step: 3, totalSteps: 5, label: 'Form 15CA filed · CA reviewing 15CB', etaHint: 'Within 1 business day' },
  '15CB_CERTIFIED': { step: 4, totalSteps: 5, label: 'CA certified · queued for bank',      etaHint: '~1–2 hours' },
  BANK_PROCESSING:  { step: 5, totalSteps: 5, label: 'Bank processing transfer',            etaHint: 'Within 1–2 business days' },
  SWIFT_SENT:       { step: 5, totalSteps: 5, label: 'SWIFT sent · awaiting delivery',      etaHint: 'Within 1 business day' },
}

// Inward = Canada -> India.  No 15CA / 15CB required (those are Indian
// IT-Act forms gating OUTWARD remittance from India). Only check is FINTRAC
// for amounts >= CAD 10,000 — above that, status = 'fintrac_review' until ops
// clears the transfer.  Below the threshold, the backend marks the transfer
// 'completed' immediately, so the entries below are reached only when a
// transfer is actually in flight (FINTRAC review or stuck for any reason).
const INWARD: Partial<Record<TransferStatus, StatusDetail>> = {
  INITIATED:        { step: 1, totalSteps: 3, label: 'Transfer initiated',          etaHint: 'A few seconds' },
  KYC_VERIFIED:     { step: 2, totalSteps: 3, label: 'FINTRAC review',              etaHint: 'Within 1 business day' },
  BANK_PROCESSING:  { step: 2, totalSteps: 3, label: 'FINTRAC review · ops queue',  etaHint: 'Within 1 business day' },
  '15CA_FILED':     { step: 2, totalSteps: 3, label: 'FINTRAC review',              etaHint: 'Within 1 business day' },
  '15CB_CERTIFIED': { step: 3, totalSteps: 3, label: 'Routing to recipient bank',   etaHint: 'Minutes' },
  SWIFT_SENT:       { step: 3, totalSteps: 3, label: 'Payout to recipient bank',    etaHint: 'Minutes' },
}

export function getStatusDetail(
  status: TransferStatus,
  direction: 'outward' | 'inward',
): StatusDetail | null {
  if (status === 'COMPLETED' || status === 'FAILED') return null
  const map = direction === 'inward' ? INWARD : OUTWARD
  return map[status] ?? null
}

// True when the transfer is in motion (not delivered, not failed).
export function isActive(status: TransferStatus): boolean {
  return status !== 'COMPLETED' && status !== 'FAILED'
}
