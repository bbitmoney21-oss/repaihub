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
  INITIATED:        'Initiated',
  KYC_VERIFIED:     'KYC Verified',
  '15CB_REQUESTED': 'CA Review Pending',
  '15CB_CERTIFIED': 'Form 15CB Certified',
  '15CA_FILED':     'Form 15CA Filed',
  BANK_PROCESSING:  'Bank Processing',
  SWIFT_SENT:       'SWIFT Sent',
  COMPLETED:        'Completed',
  FAILED:           'Failed',
}

export const statusColor: Record<string, string> = {
  INITIATED:        '#8BA0B4',
  KYC_VERIFIED:     '#F39C12',
  '15CB_REQUESTED': '#F39C12',
  '15CB_CERTIFIED': '#9B59B6',
  '15CA_FILED':     '#3498DB',
  BANK_PROCESSING:  '#F39C12',
  SWIFT_SENT:       '#3498DB',
  COMPLETED:        '#27AE60',
  FAILED:           '#E74C3C',
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
