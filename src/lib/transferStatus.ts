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

// REQ-09: Status timeline — Submitted → Forms certified/filed (NRO only) →
// Bank verification → FX conversion & SWIFT → Credited.
// NRE skips the forms state (no Form 145/146 required).
const OUTWARD: Partial<Record<TransferStatus, StatusDetail>> = {
  INITIATED:           { step: 1, totalSteps: 5, label: 'Submitted — verifying KYC',              etaHint: 'A few minutes' },
  KYC_VERIFIED:        { step: 2, totalSteps: 5, label: 'Filing Form 145',                        etaHint: '~30 minutes' },
  FORM145_FILED:       { step: 3, totalSteps: 5, label: 'Form 145 filed · CA certifying Form 146', etaHint: 'Within 1 business day' },
  FORM146_RECEIVED:    { step: 4, totalSteps: 5, label: 'Forms certified — bank verification',    etaHint: '~1–2 hours' },
  BANK_PROCESSING:     { step: 4, totalSteps: 5, label: 'Bank verification · FX conversion',      etaHint: 'Within 1–2 business days' },
  SWIFT_SENT:          { step: 5, totalSteps: 5, label: 'SWIFT sent · awaiting credit',            etaHint: 'Within 1 business day' },
  // Legacy IT Act 1961 status names — backward compat with existing DB rows
  '15CA_FILED':        { step: 3, totalSteps: 5, label: 'Form 145 filed · CA certifying Form 146', etaHint: 'Within 1 business day' },
  '15CB_CERTIFIED':    { step: 4, totalSteps: 5, label: 'Forms certified — bank verification',    etaHint: '~1–2 hours' },
}

// Inward = Canada → India. No Form 145/146 required (Indian IT-Act forms
// gate OUTWARD remittance only). FINTRAC review for amounts ≥ CAD 10,000.
const INWARD: Partial<Record<TransferStatus, StatusDetail>> = {
  INITIATED:        { step: 1, totalSteps: 3, label: 'Transfer initiated',           etaHint: 'A few seconds' },
  KYC_VERIFIED:     { step: 2, totalSteps: 3, label: 'Bank verification',             etaHint: 'Within 1 business day' },
  BANK_PROCESSING:  { step: 2, totalSteps: 3, label: 'Bank verification · ops queue', etaHint: 'Within 1 business day' },
  FORM145_FILED:    { step: 2, totalSteps: 3, label: 'Bank verification',             etaHint: 'Within 1 business day' },
  FORM146_RECEIVED: { step: 3, totalSteps: 3, label: 'FX conversion · routing',      etaHint: 'Minutes' },
  SWIFT_SENT:       { step: 3, totalSteps: 3, label: 'Credited to recipient account', etaHint: 'Minutes' },
  '15CA_FILED':     { step: 2, totalSteps: 3, label: 'Bank verification',             etaHint: 'Within 1 business day' },
  '15CB_CERTIFIED': { step: 3, totalSteps: 3, label: 'FX conversion · routing',      etaHint: 'Minutes' },
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
