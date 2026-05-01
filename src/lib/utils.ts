export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatCAD = (amount: number): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatDate = (iso: string): string => {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export const formatDateShort = (iso: string): string => {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

export const statusLabel: Record<string, string> = {
  INITIATED:              'Initiated',
  initiated:              'Initiated',
  KYC_VERIFIED:           'KYC Verified',
  kyc_verified:           'KYC Verified',
  FORM146_REQUESTED:      'Form 146 Requested',
  form146_requested:      'Form 146 Requested',
  FORM146_RECEIVED:       'Form 146 Received',
  form146_received:       'Form 146 Received',
  FORM145_FILED:          'Form 145 Filed',
  form145_filed:          'Form 145 Filed',
  BANK_PROCESSING:        'Bank Processing',
  bank_processing:        'Bank Processing',
  COMPLETED:              'Completed',
  completed:              'Completed',
  FAILED:                 'Failed',
  failed:                 'Failed',
  CANCELLED:              'Cancelled',
  cancelled:              'Cancelled',
  PENDING_REVIEW:         'Pending Review',
  pending_review:         'Pending Review',
  // Legacy IT Act 1961 — backward compat
  '15CB_REQUESTED':       'Form 146 Requested',
  '15CB_CERTIFIED':       'Form 146 Certified',
  '15CA_FILED':           'Form 145 Filed',
}

export const statusColor: Record<string, string> = {
  INITIATED:          '#8BA0B4',
  initiated:          '#8BA0B4',
  KYC_VERIFIED:       '#F39C12',
  kyc_verified:       '#F39C12',
  FORM146_REQUESTED:  '#F39C12',
  form146_requested:  '#F39C12',
  FORM146_RECEIVED:   '#9B59B6',
  form146_received:   '#9B59B6',
  FORM145_FILED:      '#3498DB',
  form145_filed:      '#3498DB',
  BANK_PROCESSING:    '#F39C12',
  bank_processing:    '#F39C12',
  COMPLETED:          '#27AE60',
  completed:          '#27AE60',
  FAILED:             '#E74C3C',
  failed:             '#E74C3C',
  CANCELLED:          '#8BA0B4',
  cancelled:          '#8BA0B4',
  PENDING_REVIEW:     '#F39C12',
  pending_review:     '#F39C12',
  '15CB_REQUESTED':   '#F39C12',
  '15CB_CERTIFIED':   '#9B59B6',
  '15CA_FILED':       '#3498DB',
}

export const residencyLabels: Record<string, string> = {
  citizen:     'Canadian Citizen',
  pr:          'Permanent Resident',
  oci:         'OCI Card Holder',
  work_permit: 'Work Permit Holder',
}

export const generateRef = (): string => {
  const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date()).toUpperCase()
  const num   = Math.floor(Math.random() * 900) + 100
  return `RH-${num}-${month}`
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
