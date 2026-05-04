import type { TransferStatus } from '../store/useStore'

// ─────────────────────────────────────────────────────────────────────────────
// Per-status detail used by the Dashboard's Active Transfers panel.
// Keeps the UI from leaking enum names ('15CA_FILED') to the customer and
// gives the same status a different meaning depending on direction (outward
// repatriation vs inward Canada→India).
//
// The schema is purposefully tiny:
//   step:           1-5, where 5 means "ready to deliver / delivered"
//   totalSteps:     always 5 — the dashboard renders 5 dots
//   label:          short, customer-facing description of what's happening
//   etaHint:        rough wait time (no false precision)
//   actionRequired: set ONLY when the transfer is blocked on user input.
//                   When non-null, the dashboard renders a Pending Action
//                   banner above the active list and a 'Action needed' chip
//                   on the card itself.
// ─────────────────────────────────────────────────────────────────────────────

export type ActionKind = 'pan' | 'document' | 'kyc'

export interface StatusDetail {
  step: 1 | 2 | 3 | 4 | 5
  totalSteps: 5
  label: string
  etaHint?: string
  actionRequired?: { kind: ActionKind; message: string; href?: string }
}

const OUTWARD: Partial<Record<TransferStatus, StatusDetail>> = {
  INITIATED:        { step: 1, totalSteps: 5, label: 'Verifying KYC',                       etaHint: 'A few minutes' },
  KYC_VERIFIED:     { step: 2, totalSteps: 5, label: 'Filing Form 145',                     etaHint: '~30 minutes' },
  '15CA_FILED':     { step: 3, totalSteps: 5, label: 'Form 145 filed · CA reviewing 146',   etaHint: 'Typically 4–8 hours' },
  '15CB_CERTIFIED': { step: 4, totalSteps: 5, label: 'CA certified · queued for bank',      etaHint: '~1–2 hours' },
  BANK_PROCESSING:  { step: 5, totalSteps: 5, label: 'Bank processing transfer',            etaHint: '~24–48 hours' },
  SWIFT_SENT:       { step: 5, totalSteps: 5, label: 'SWIFT sent · awaiting delivery',      etaHint: '~24 hours' },
}

const INWARD: Partial<Record<TransferStatus, StatusDetail>> = {
  INITIATED:        { step: 1, totalSteps: 5, label: 'Transfer initiated',                  etaHint: 'A few minutes' },
  KYC_VERIFIED:     { step: 2, totalSteps: 5, label: 'Compliance check passed',             etaHint: '~10 minutes' },
  '15CA_FILED':     { step: 3, totalSteps: 5, label: 'Collecting from your Canadian bank',  etaHint: '~1–2 hours' },
  '15CB_CERTIFIED': { step: 4, totalSteps: 5, label: 'FX converted · routing to recipient', etaHint: '~30 minutes' },
  BANK_PROCESSING:  { step: 4, totalSteps: 5, label: 'Routing to recipient bank',           etaHint: '~30 minutes' },
  SWIFT_SENT:       { step: 5, totalSteps: 5, label: 'Payout to recipient bank',            etaHint: '~1–2 hours' },
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
